'use strict';

/**
 * Module dependencies.
 */

const { RuleTester } = require('eslint');
const rule = require('../../rules/no-unsafe-query');

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2022
  }
});

/**
 * Test `no-unsafe-query`.
 */

const ruleTester = new RuleTester();

ruleTester.run('no-unsafe-query', rule, {
  invalid: [
    {
      code: 'const column = "*"; foo.query(`SELECT ${column} FROM foobar`);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral'
        }
      ]
    },
    {
      code: 'const column = "*"; const query = `SELECT ${column} FROM foobar`; foo.query(query);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral'
        }
      ]
    },
    {
      code: 'const column = "*"; foo.query(foobar`SELECT ${column} FROM foobar`);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral'
        }
      ]
    },
    {
      code: 'const column = "*"; const query = foobar`SELECT ${column} FROM foobar`; foo.query(query);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral'
        }
      ]
    }
  ],
  valid: [
    'const column = "*"; foo.query(sql`SELECT ${column} FROM foobar`);',
    'const column = "*"; const query = sql`SELECT ${column} FROM foobar`; foo.query(query);',
    'foo.query(`SELECT column FROM foobar`);',
    'const query = `SELECT column FROM foobar`; foo.query(query);',
    'const foo = "bar"; baz.greet(`hello ${foo}`);',
    'const foo = "bar"; const baz = `hello ${foo}`; qux.greet(baz);',
    'foo.greet(`hello`);',
    'const foo = `bar`; baz.greet(foo);'
  ]
});
