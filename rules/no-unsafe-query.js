'use strict';

/**
 * Module dependencies.
 */

const parser = require('sql-parse');

/**
 * Check if `literal` is an SQL query.
 */

function isSqlQuery(literal) {
  if (!literal) {
    return false;
  }

  try {
    parser.parse(literal);

    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }

  return true;
}

/**
 * Validate node.
 */

function validate(node, context) {
  if (!node) {
    return;
  }

  if (node.type === 'TaggedTemplateExpression' && node.tag.name !== 'sql') {
    node = node.quasi;
  }

  if (node.type === 'TemplateLiteral' && node.expressions.length) {
    const literal = node.quasis.map(quasi => quasi.value.raw).join('x');

    if (isSqlQuery(literal)) {
      context.report({
        node,
        message: 'Use the `sql` tagged template literal for raw queries'
      });
    }
  }
}

/**
 * Export `no-unsafe-query`.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow unsafe SQL queries',
      recommended: false,
      url: 'https://github.com/uphold/eslint-plugin-sql-template#rules'
    },
    schema: [] // no options
  },
  create(context) {
    return {
      CallExpression(node) {
        node.arguments.forEach(argument => validate(argument, context));
      },
      VariableDeclaration(node) {
        node.declarations.forEach(declaration => validate(declaration.init, context));
      }
    };
  }
};
