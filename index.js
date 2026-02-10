'use strict';

const { name, version } = require('./package.json');

/**
 * Export rules.
 * @type {import('eslint').ESLint.Plugin}
 */
module.exports = {
  meta: {
    name,
    version,
    namespace: 'sql-template'
  },
  rules: {
    'no-unsafe-query': require('./rules/no-unsafe-query')
  }
};
