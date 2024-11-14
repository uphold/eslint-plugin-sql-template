'use strict';

/**
 * Module dependencies.
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 * @typedef {import('estree').Node} ASTNode
 * @typedef {import('eslint').Rule.RuleContext} RuleContext
 */

const parser = require('sql-parse');

/**
 * Constants.
 */

// Common SQL keywords used for pattern detection.
const SQL_KEYWORDS = {
  commands: /\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i,
  clauses: /\b(FROM|WHERE|SET|JOIN|GROUP|HAVING|ORDER)\b/i,
  operators: /\b(AND|OR|IN|BETWEEN|LIKE|IS|NOT)\b/i
};

/**
 * Checks if a query string contains SQL syntax.
 * @param {string} query - The query string to check.
 * @returns {boolean} True if the string appears to be SQL.
 */
function isSqlQuery(query) {
  if (!query) return false;

  // Quick pattern check before expensive parsing
  const hasCommonSqlPatterns = Object.values(SQL_KEYWORDS).some(pattern => pattern.test(query));

  if (!hasCommonSqlPatterns) return false;

  try {
    const result = parser.parse(query.trim());
    return !!result.type;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // If parsing fails but it matches SQL patterns, consider it SQL.
    return true;
  }
}

/**
 * Detects if a node is within a logging context.
 * @param {ASTNode} node - The node to check.
 * @returns {boolean} True if the node is in a logging context.
 */
function isLoggingContext(node) {
  if (node.parent?.type === 'CallExpression' && node.parent.callee?.type === 'MemberExpression') {
    const callee = node.parent.callee;
    const objectName = callee.object.name;
    const propertyName = callee.property.name;

    // Check for common logging patterns
    return (
      objectName === 'log' ||
      objectName === 'console' ||
      objectName === 'logger' ||
      /log$/i.test(objectName) ||
      ['log', 'info', 'warn', 'error', 'debug', 'trace'].includes(propertyName)
    );
  }
  return false;
}

/**
 * Recursively checks if a node is in a SQL context.
 * @param {ASTNode} node - The node to check
 * @returns {boolean} True if the node is in a SQL context
 */
function findSqlContext(node) {
  if (!node?.parent) return false;

  // Check direct SQL usage
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property.name === 'query'
  ) {
    return true;
  }

  // Check SQL-related identifiers
  if (node.type === 'Identifier' && /^(?:sql|query)/i.test(node.name)) {
    return true;
  }

  return findSqlContext(node.parent);
}

/**
 * Determines if a node is in a SQL execution context
 * @param {ASTNode} node - The node to check
 * @returns {boolean} True if the node is in a SQL context
 */
function isSqlContext(node) {
  if (!node?.parent) return false;

  // Check for direct query calls
  if (
    node.parent.type === 'CallExpression' &&
    node.parent.callee?.type === 'MemberExpression' &&
    node.parent.callee.property.name === 'query'
  ) {
    return true;
  }

  // Check for SQL variable assignments
  if (node.parent.type === 'VariableDeclarator') {
    return /^(?:sql|query)/i.test(node.parent.id.name);
  }

  // Handle tagged templates
  if (node.parent.type === 'TaggedTemplateExpression') {
    const tagName = node.parent.tag.name;
    // Whitelist certain tags
    if (['sql', 'sha1'].includes(tagName)) return false;
    return findSqlContext(node.parent);
  }

  // Check function contexts
  if (node.parent.type === 'ArrowFunctionExpression') {
    return findSqlContext(node.parent);
  }

  return false;
}

/**
 * Checks if node is a nested template literal
 * @param {ASTNode} node - The node to check
 * @returns {boolean} True if the node is nested in another template
 */
function isNestedTemplate(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'TemplateLiteral') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Validates a template literal node for unsafe SQL usage
 * @param {ASTNode} node - The node to validate
 * @param {RuleContext} context - The rule context
 */
function validateNode(node, context) {
  // Only check interpolated template literals
  if (node?.type !== 'TemplateLiteral' || node.expressions.length === 0) return;

  // Skip already safe contexts
  if (node.parent?.type === 'TaggedTemplateExpression' && node.parent.tag.name === 'sql') return;
  if (isLoggingContext(node)) return;

  // Skip nested templates to avoid double reporting
  if (isNestedTemplate(node) && node.parent?.type !== 'TaggedTemplateExpression') return;

  // Check for SQL usage
  const queryString = node.quasis.map(quasi => quasi.value.raw).join('?');
  const hasSqlContent = isSqlQuery(queryString);
  const isInSqlContext = isSqlContext(node);

  if (hasSqlContent || isInSqlContext) {
    context.report({
      node,
      message: 'Use the `sql` tagged template literal for raw queries',
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
    schema: []
  },

  create(context) {
    return {
      TemplateLiteral: node => validateNode(node, context)
    };
  }
};
