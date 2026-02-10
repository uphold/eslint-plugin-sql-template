/**
 * Module dependencies.
 */

const { defineConfig } = require('eslint/config');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const js = require('@eslint/js');
const eslintPluginSqlTemplate = require('.');

/**
 * Export ESLint config.
 */

module.exports = defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      sourceType: 'commonjs'
    },
    plugins: {
      'sql-template': eslintPluginSqlTemplate
    },
    name: 'eslint-plugin-sql-template/config',
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
    }
  },
  eslintPluginPrettierRecommended
]);
