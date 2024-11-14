'use strict';

/**
 * Module dependencies.
 */

const { RuleTester } = require('eslint');
const rule = require('../../rules/no-unsafe-query');

/**
 * Configure the rule tester.
 */

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
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
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: 'const column = "*"; foo.query(sql`SELECT ${column} FROM foobar`);'
            }
          ]
        }
      ]
    },
    {
      code: 'const column = "*"; const query = `SELECT ${column} FROM foobar`; foo.query(query);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: 'const column = "*"; const query = sql`SELECT ${column} FROM foobar`; foo.query(query);'
            }
          ]
        }
      ]
    },
    {
      code: 'const column = "*"; foo.query(foobar`SELECT ${column} FROM foobar`);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: 'const column = "*"; foo.query(sql`SELECT ${column} FROM foobar`);'
            }
          ]
        }
      ]
    },
    {
      code: 'const column = "*"; const query = foobar`SELECT ${column} FROM foobar`; foo.query(query);',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: 'const column = "*"; const query = sql`SELECT ${column} FROM foobar`; foo.query(query);'
            }
          ]
        }
      ]
    },
    {
      code: 'const foo = { id: 123 }; fooManager.query(`UPDATE "Foo" SET "setAt" = NULL WHERE id = \'${foo.id}\'`, { transaction });',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output:
                'const foo = { id: 123 }; fooManager.query(sql`UPDATE "Foo" SET "setAt" = NULL WHERE id = \'${foo.id}\'`, { transaction });'
            }
          ]
        }
      ]
    },
    {
      code: 'const batchSize = 100; const query = `WITH selected AS ( SELECT id FROM "foobar" WHERE "default" IS NULL LIMIT ${batchSize} FOR NO KEY UPDATE SKIP LOCKED )`;',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output:
                'const batchSize = 100; const query = sql`WITH selected AS ( SELECT id FROM "foobar" WHERE "default" IS NULL LIMIT ${batchSize} FOR NO KEY UPDATE SKIP LOCKED )`;'
            }
          ]
        }
      ]
    },
    {
      code: `const skipped = ['abc']; const query = \` SELECT count(*) as total FROM "foobar" WHERE "bizbaz" = 'foobiz' AND foo - 'bar' - 'biz' - 'baz' = '{}' \${skipped.length > 0 ? \`AND biz NOT IN (\${skipped.map(foo => \`'\${foo}'\`).join(',')}))\` : ''}\``,
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: `const skipped = ['abc']; const query = sql\` SELECT count(*) as total FROM "foobar" WHERE "bizbaz" = 'foobiz' AND foo - 'bar' - 'biz' - 'baz' = '{}' \${skipped.length > 0 ? \`AND biz NOT IN (\${skipped.map(foo => \`'\${foo}'\`).join(',')}))\` : ''}\``
            }
          ]
        }
      ]
    },
    {
      code: `async function updateRecords() { const [updated] = await queryInterface.sequelize.query(\` WITH selected AS ( SELECT id FROM "Foobiz" WHERE "default" IS NULL LIMIT \${batchSize} FOR NO KEY UPDATE SKIP LOCKED ), "foobar" AS ( SELECT up.id FROM "FooBarBiz" up, selected s WHERE up.id = s.id AND up.main IS TRUE AND up."deletedAt" IS NULL ) UPDATE "Foobiz" am SET "default" = CASE WHEN fooo.id IS NULL THEN FALSE ELSE TRUE END FROM selected s LEFT JOIN "foobar" fooo ON s.id = fooo.id WHERE am.id = s.id RETURNING am.id \`, { transaction }); }`,
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output: `async function updateRecords() { const [updated] = await queryInterface.sequelize.query(sql\` WITH selected AS ( SELECT id FROM "Foobiz" WHERE "default" IS NULL LIMIT \${batchSize} FOR NO KEY UPDATE SKIP LOCKED ), "foobar" AS ( SELECT up.id FROM "FooBarBiz" up, selected s WHERE up.id = s.id AND up.main IS TRUE AND up."deletedAt" IS NULL ) UPDATE "Foobiz" am SET "default" = CASE WHEN fooo.id IS NULL THEN FALSE ELSE TRUE END FROM selected s LEFT JOIN "foobar" fooo ON s.id = fooo.id WHERE am.id = s.id RETURNING am.id \`, { transaction }); }`
            }
          ]
        }
      ]
    },
    {
      code: 'const totalQuery = () => `SELECT COUNT(*) as total FROM "foo" u WHERE NOT EXISTS (SELECT 1 FROM "fooBar" ue WHERE ue."FooId" = u.id LIMIT 1) ${foobiz()};`;',
      errors: [
        {
          message: 'Use the `sql` tagged template literal for raw queries',
          type: 'TemplateLiteral',
          suggestions: [
            {
              desc: 'Wrap with sql tag',
              output:
                'const totalQuery = () => sql`SELECT COUNT(*) as total FROM "foo" u WHERE NOT EXISTS (SELECT 1 FROM "fooBar" ue WHERE ue."FooId" = u.id LIMIT 1) ${foobiz()};`;'
            }
          ]
        }
      ]
    }
  ],
  valid: [
    { code: 'const column = "*"; foo.query(sql`SELECT ${column} FROM foobar`);' },
    { code: 'const column = "*"; const query = sql`SELECT ${column} FROM foobar`; foo.query(query);' },
    { code: 'const query = sql`SELECT column FROM foobar`; foo.query(query);' },
    { code: 'foo.query(sql`SELECT ${column} FROM foobar`);' },
    { code: 'const query = sql`SELECT ${column} FROM foobar`; foo.query(query);' },
    { code: 'const foo = "bar"; baz.greet(`hello ${foo}`);' },
    { code: 'const foo = "bar"; const baz = `hello ${foo}`; qux.greet(baz);' },
    { code: 'foo.greet(`hello`);' },
    { code: 'const foo = `bar`; baz.greet(foo);' },
    { code: 'db.query(`SELECT foo FROM bar`);' }, // Raw SQL without interpolation is valid
    { code: 'const query = `SELECT * FROM users WHERE active = true`;' }, // Also valid
    { code: 'foo.query(`SELECT * FROM table WHERE id = 1`);' }, // Also valid
    { code: 'log.info(`This will update ${total} records`)' },
    { code: 'const token = crypto.generateToken(32); redis.set(sha1`password-reset:token:${token}`);' }
  ]
});
