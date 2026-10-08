'use strict';

/**
 * Rule-level probe for `eslint-plugin-sql-template`'s `no-unsafe-query` rule.
 *
 * Confirms that the injection shapes the rule exists to block are reported, and that the
 * allow-listed "provably constant" shapes are still not reported.
 */

const { RuleTester } = require('eslint');
const rule = require('../../rules/no-unsafe-query');

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' }
});

const SUGGESTED = { messageId: 'missingSqlTag', suggestions: 1 };

ruleTester.run('no-unsafe-query', rule, {
  valid: [
    // Constant interpolations are still allowed.
    'db.query(`SELECT * FROM t WHERE id = ${1}`);',
    "db.query(`SELECT * FROM t WHERE id = ${'a' + 'b'}`);",

    // Already tagged with `sql`.
    'db.query(sql`SELECT * FROM t WHERE id = ${userId}`);',

    // Not SQL at all.
    'const msg = `hello ${name}`;',
    "const path = 'items/' + id;",
    "console.log('total: ' + count);",
    "db.query('SELECT * FROM t WHERE id = ' + 1);"
  ],
  invalid: [
    {
      code: "db.query('SELECT * FROM t WHERE id = ' + userId);",
      errors: [{ messageId: 'unsafeConcatenation' }]
    },
    {
      code: "db.query('SELECT * FROM t WHERE id = ' + userId + ' AND x = 1');",
      errors: [{ messageId: 'unsafeConcatenation' }]
    },
    {
      code: 'db.query(`REPLACE INTO t (a) VALUES (${userId})`);',
      errors: [SUGGESTED]
    },
    {
      code: 'db.query(`EXECUTE sp_who ${userId}`);',
      errors: [SUGGESTED]
    },
    {
      code: 'db.query(`PRAGMA table_info(${tableName})`);',
      errors: [SUGGESTED]
    },
    {
      code: 'db.query(`SHOW ${column}`);',
      errors: [SUGGESTED]
    },
    {
      code: 'db.query(`SELECT * FROM t WHERE id = ${userId}`);',
      errors: [SUGGESTED]
    },
    {
      // A leading interpolation must not disable detection.
      code: 'db.query(`${prefix} SELECT * FROM t WHERE id = ${userId}`);',
      errors: [SUGGESTED]
    }
  ]
});

// eslint-disable-next-line no-undef -- this probe is executed directly by `node`, not linted as a Node script.
console.log('no-unsafe-query probe: all cases behaved as expected');
