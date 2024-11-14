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
 * SQL starting keywords to detect inside the template literal.
 */

const sqlKeywords = /^`\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WITH|GRANT|BEGIN|DROP)\b/i;

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

        // Check if the template literal has SQL.
        const hasSQL = sqlKeywords.test(context.sourceCode.getText(node));

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
