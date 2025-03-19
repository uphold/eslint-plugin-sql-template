'use strict';

/**
 * Helper function to check if an expression contains a variable.
 */

function containsVariableExpression(expression) {
  if (!expression) return false;

  if (['Identifier', 'CallExpression', 'MemberExpression'].includes(expression.type)) {
    return true;
  }

  if (expression.type === 'ConditionalExpression') {
    return containsVariableExpression(expression.consequent) || containsVariableExpression(expression.alternate);
  }

  if (expression.type === 'TemplateLiteral') {
    return expression.expressions.some(containsVariableExpression);
  }

  return false;
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
 * SQL starter keywords that strongly indicate the beginning of a SQL query
 */
const sqlStrongKeywords =
  /^`\s*(SELECT|INSERT\s+INTO|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE|BEGIN\s+TRANSACTION|COMMIT|ROLLBACK)\s/i;

/**
 * SQL keywords that might indicate a SQL query when combined with other factors
 */
const sqlWeakKeywords = /^`\s*(UPDATE|WITH|GRANT|SET|VALUES)\s/i;

/**
 * SQL context clues that strongly suggest we're dealing with a SQL query
 */
const sqlStrongContextClues =
  /\s(FROM\s+"?\w+"?|WHERE\s+\w+|JOIN\s+"?\w+"?|GROUP\s+BY|ORDER\s+BY|HAVING\s+|ON\s+"?\w+"?\s*=\s*"?\w+"?|LIMIT\s+\d+|OFFSET\s+\d+)\s/i;

/**
 * Patterns that strongly suggest we're NOT dealing with a SQL query
 */
const nonSqlPatterns = [
  // Event names pattern (e.g., 'update:foo:bar')
  /^`[\w-]+:[\w-]+:[\w-]+/,
  // URL/route paths
  /^`\/[\w-]+\/[\w-]+/,
  // Configuration keys
  /^`config:/,
  // Message templates
  /^`(Success|Error|Warning|Info):/i
];

/**
 * Check if the variable is used in a database context
 */
function isInDatabaseContext(node) {
  let current = node;
  let depth = 0;
  const max_depth = 3; // Limit how far up we check

  while (current && depth < max_depth) {
    // Check for database-related variable/property names
    if (
      current.type === 'VariableDeclarator' &&
      ['query', 'sql', 'db', 'database', 'repo', 'repository'].some(term =>
        current.id?.name?.toLowerCase().includes(term)
      )
    ) {
      return true;
    }

    // Look for typical database methods on objects
    if (current.type === 'CallExpression' && current.callee?.type === 'MemberExpression') {
      const obj = current.callee.object?.name?.toLowerCase();
      const method = current.callee.property?.name?.toLowerCase();

      if (
        method &&
        ['query', 'execute', 'run', 'all', 'each', 'get', 'select', 'insert', 'update', 'delete'].includes(method)
      ) {
        return true;
      }

      if (
        obj &&
        ['db', 'database', 'sql', 'sequelize', 'knex', 'pg', 'mysql', 'mongoose', 'orm'].some(term =>
          obj.includes(term)
        )
      ) {
        return true;
      }
    }

    current = current.parent;
    depth++;
  }

  return false;
}

/**
 * Check if a template literal is being used for a SQL query.
 * Uses a scoring system to determine likelihood.
 */
function isSqlTemplateLiteral(node, sourceCode) {
  const text = sourceCode.getText(node);
  let score = 0;

  // Check for patterns that almost certainly indicate this is NOT SQL
  for (const pattern of nonSqlPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Strong indicators this IS SQL
  if (sqlStrongKeywords.test(text)) {
    score += 10;
  }

  // Weaker keywords that might indicate SQL
  if (sqlWeakKeywords.test(text)) {
    score += 5;
  }

  // Strong contextual clues
  if (sqlStrongContextClues.test(text)) {
    score += 7;
  }

  // Consider database connection/query context
  if (isInDatabaseContext(node)) {
    score += 8;
  }

  // Count SQL-specific characters and patterns
  const quotedIdentifiers = (text.match(/"/g) || []).length;
  const sqlParentheses = (text.match(/\(\s*\w+\s*\)/g) || []).length;

  score += Math.min(quotedIdentifiers / 2, 3); // Cap at 3 points
  score += Math.min(sqlParentheses, 2); // Cap at 2 points

  // Penalize for patterns that suggest this isn't SQL
  if (text.includes('${') && text.includes('}:')) {
    score -= 5; // Looks like a template with named sections
  }

  return score >= 7; // Threshold for considering this SQL
}

/**
 * Rule definition.
 */

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
      missingSqlTag: 'Use the `sql` tagged template literal for raw queries'
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

        // Check if the template literal is likely used for SQL
        const hasSQL = isSqlTemplateLiteral(node, context.sourceCode);

        // Recursively check if any expression is a variable (Identifier, MemberExpression, or nested TemplateLiteral)
        const hasVariableExpression = node.expressions.some(containsVariableExpression);

        if (hasSQL && hasVariableExpression) {
          context.report({
            node,
            messageId: 'missingSqlTag',
            suggest: [
              {
                desc: 'Wrap with sql tag',
                fix(fixer) {
                  if (node.parent?.type === 'TaggedTemplateExpression') {
                    return fixer.replaceText(node.parent.tag, 'sql');
                  }

                  return fixer.insertTextBefore(node, 'sql');
                }
              }
            ]
          });
        }
      }
    };
  }
};
