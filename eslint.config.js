/**
 * Module dependencies.
 */

const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');
const js = require('@eslint/js');
const eslintPluginSqlTemplate = require('.');

/**
 * Export `eslint-config`.
 */

module.exports = [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      'sql-template': eslintPluginSqlTemplate
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          printWidth: 120,
          singleQuote: true,
          trailingComma: 'none'
        }
      ],
      'sql-template/no-unsafe-query': 'error'
    },
    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.node
      }
    }
  }
];
