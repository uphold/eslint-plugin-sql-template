'use strict';

/**
 * Helper function to check if an interpolated expression is a provably constant value.
 *
 * WHY: the rule's contract is "SQL templates must use the `sql` tag for any interpolation
 * that is not a literal constant". This function is an allowlist: only expression shapes
 * whose value is fully determined at parse time are treated as constant. Everything else
 * (identifiers, member access, calls, `new`, `await`, binary/logical/unary operators over
 * non-constants, functions, classes, and any node type this code does not know about)
 * returns `false`, so the caller reports the template. Failing open — towards reporting –
 * is deliberate: an unproven expression that slips through is a potential SQL injection
 * (false negative), while an over-eager report only forces the harmless `sql` tag
 * (false positive), which the suggestion fix applies automatically.
 */

function isConstantExpression(expression) {
  if (!expression) return true;

  switch (expression.type) {
    // String, numeric, boolean, null, bigint and regexp literals are constants.
    case 'Literal':
      return true;

    // A template literal is constant only when every interpolated part is constant.
    case 'TemplateLiteral':
      return expression.expressions.every(isConstantExpression);

    // Arithmetic/comparison operators over constants fold to constants.
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isConstantExpression(expression.left) && isConstantExpression(expression.right);

    // Both branches (and the test) must be constant.
    case 'ConditionalExpression':
      return (
        isConstantExpression(expression.test) &&
        isConstantExpression(expression.consequent) &&
        isConstantExpression(expression.alternate)
      );

    // `-1`, `!flag` over a literal, etc. `delete`/`void` produce no meaningful value
    // and `await`/`yield` are never constant, so they are rejected outright.
    case 'UnaryExpression':
      return (
        !['delete', 'void', 'await', 'yield'].includes(expression.operator) && isConstantExpression(expression.argument)
      );

    // Literal arrays are constants; a spread (`...ids`) falls through to `default` and
    // is rejected because its elements are only known at runtime.
    case 'ArrayExpression':
      return expression.elements.every(element => element === null || isConstantExpression(element));

    // Literal objects are constants; computed keys must also be constant.
    case 'ObjectExpression':
      return expression.properties.every(property => {
        if (property.type === 'SpreadElement') return false;

        return (!property.computed || isConstantExpression(property.key)) && isConstantExpression(property.value);
      });

    // Optional chaining (`user?.id`) is wrapped in a ChainExpression by ESTree parsers;
    // unwrap it so the non-constant MemberExpression underneath is what gets judged.
    case 'ChainExpression':
      return isConstantExpression(expression.expression);

    // Parentheses and TypeScript-only wrappers do not change the value.
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return isConstantExpression(expression.expression);

    // Identifiers, member expressions, calls, `new`, `await`, tagged templates,
    // functions and classes cannot be proven constant — they require the `sql` tag.
    default:
      return false;
  }
}

/**
 * Helper function to check if a node has a parent that is a template literal.
 */

function hasParentTemplateLiteral(node) {
  if (!node?.parent) return false;

  if (node.parent.type === 'TemplateLiteral') {
    return true;
  }

  return hasParentTemplateLiteral(node.parent);
}

/**
 * Report whether `node` is part of a `+` concatenation chain.
 *
 * WHY: only the outermost `BinaryExpression` of a chain is reported, so `'SELECT * FROM t WHERE
 * id = ' + userId + ' AND x = 1'` produces one diagnostic instead of one per link.
 */

function hasParentBinaryExpression(node) {
  if (!node?.parent) return false;

  if (node.parent.type === 'BinaryExpression' && node.parent.operator === '+') {
    return true;
  }

  return hasParentBinaryExpression(node.parent);
}

/**
 * Report whether `node` statically contains SQL statement text.
 *
 * Only text that can be read at parse time counts: string literals, template literals and
 * concatenation chains thereof. Identifiers, calls and member expressions are deliberately *not*
 * treated as SQL, because doing so would report every ordinary string concatenation in a codebase
 * (`'items/' + id`, `'total: ' + count`) and the rule would be turned off rather than satisfied.
 * A concatenation is unsafe when SQL text is statically visible *and* some operand's value is not
 * provably constant.
 */

function containsStaticSqlText(node) {
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && sqlKeyword.test(stripLeadingTrivia(node.value));

    case 'TemplateLiteral':
      return node.quasis.some(quasi => sqlKeyword.test(stripLeadingTrivia(quasi.value.raw)));

    case 'BinaryExpression':
      return node.operator === '+' && (containsStaticSqlText(node.left) || containsStaticSqlText(node.right));

    default:
      return false;
  }
}

/**
 * SQL statement starting keywords. The match is anchored at the start of the (stripped)
 * static text of the template and requires a word boundary, so `SELECT${cols}` and
 * `INSERT OR REPLACE INTO ...` are detected while `selected ${x}` is not.
 *
 * WHY the extended list: the previous allowlist omitted `REPLACE`, `MERGE`, `EXEC`, `EXECUTE`,
 * `PRAGMA`, `SHOW`, `DESC`, `EXPLAIN`, `CALL`, `COPY`, `VACUUM` and `ANALYZE`, so an
 * interpolated `REPLACE INTO … VALUES (${userId})` passed the very rule that exists to stop
 * exactly that.
 */

const sqlKeyword =
  /^(SELECT|INSERT|REPLACE|UPDATE|DELETE|MERGE|UPSERT|WITH|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|DROP|TRUNCATE|CREATE|ALTER|RENAME|SHOW|DESC|DESCRIBE|EXPLAIN|PRAGMA|VACUUM|ANALYZE|CALL|EXEC|EXECUTE|COPY)\b/i;

/**
 * Strip leading trivia that SQL statements may start with — whitespace, `--` line comments,
 * `/* ... *\/` block comments, parentheses and semicolons — so that queries written as
 * `-- comment\nSELECT ...` or `(SELECT ...)` are still recognised as SQL.
 * WHY: without this, an attacker-controlled interpolation in such a template was silently
 * accepted because the keyword regex never matched.
 */

function stripLeadingTrivia(text) {
  let stripped = text;
  let previous;

  do {
    previous = stripped;
    stripped = stripped
      .replace(/^\s+/, '')
      .replace(/^--[^\n]*(?:\n|$)/, '')
      .replace(/^\/\*[\s\S]*?\*\//, '')
      .replace(/^[();]+/, '');
  } while (stripped !== previous);

  return stripped;
}

/**
 * Rule definition.
 */

/**
 * Return `true` when any static chunk of `node` starts with a SQL statement keyword.
 *
 * Checking only the first quasi let a leading interpolation disable detection entirely:
 * `` `${prefix} SELECT * FROM t WHERE id = ${userId}` `` was accepted because the first chunk was
 * empty. Every quasi is inspected instead.
 */

function containsSqlStatement(node) {
  return node.quasis.some(quasi => sqlKeyword.test(stripLeadingTrivia(quasi.value.raw)));
}

/**
 * Report `node` as an unsafe query.
 *
 * @param context The ESLint rule context.
 * @param node The offending node.
 * @param messageId Which diagnostic to emit.
 * @param suggest Whether to attach the "wrap with `sql`" suggestion. It is omitted for string
 * concatenation, because prefixing a `BinaryExpression` with the `sql` tag would not compile
 * (`sql'…' + x`); that case has to be rewritten by hand into a tagged template.
 */

function report(context, node, messageId = 'missingSqlTag', suggest = true) {
  const report = { node, messageId };

  if (suggest) {
    report.suggest = [
      {
        desc: 'Wrap with sql tag',
        fix(fixer) {
          if (node.parent?.type === 'TaggedTemplateExpression') {
            return fixer.replaceText(node.parent.tag, 'sql');
          }

          return fixer.insertTextBefore(node, 'sql');
        }
      }
    ];
  }

  context.report(report);
}

module.exports = {
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    fixable: 'code',
    docs: {
      description: 'Enforce safe SQL query handling using tagged templates',
      recommended: false,
      url: 'https://github.com/uphold/eslint-plugin-sql-template#rules'
    },
    messages: {
      missingSqlTag: 'Use the `sql` tagged template literal for raw queries',
      unsafeConcatenation: 'Use the `sql` tagged template literal instead of string concatenation to build a query'
    },
    schema: []
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        // Only check interpolated template literals.
        if (node?.type !== 'TemplateLiteral' || node.expressions.length === 0) {
          return;
        }

        // Skip if the template literal has in it's chain a parent that is a TemplateLiteral.
        if (hasParentTemplateLiteral(node)) {
          return;
        }

        // Skip if the template literal is already tagged with `sql`.
        if (node.parent.type === 'TaggedTemplateExpression' && node.parent.tag.name === 'sql') {
          return;
        }

        // Check if any static chunk starts with SQL, after stripping leading trivia.
        const hasSQL = containsSqlStatement(node);

        // Report unless every interpolated expression is a provably constant value.
        const allExpressionsConstant = node.expressions.every(isConstantExpression);

        if (hasSQL && !allExpressionsConstant) {
          report(context, node);
        }
      },

      /**
       * Report SQL built by string concatenation.
       *
       * WHY: the rule only visited `TemplateLiteral`, so `'SELECT * FROM t WHERE id = ' + userId`
       * — the most common SQL injection shape — was never reported, while the README claims the
       * rule enforces protection "on all queries". Only the outermost link of a concatenation chain
       * is reported, so a three-part query yields one diagnostic rather than three.
       */
      BinaryExpression(node) {
        if (node.operator !== '+') {
          return;
        }

        if (hasParentTemplateLiteral(node) || hasParentBinaryExpression(node)) {
          return;
        }

        if (!containsStaticSqlText(node) || isConstantExpression(node)) {
          return;
        }

        report(context, node, 'unsafeConcatenation', false);
      }
    };
  }
};
