# eslint-plugin-sql-template

ESLint plugin with rules for using the `sql` template tag from a library such as [sql-tag](https://github.com/ruimarinho/sql-tag) on raw SQL queries.

That library escapes data provided to an SQL query statement via interpolation. This prevents, for instance, potential SQL injection attacks.

This ESLint plugin helps teams enforce the usage of that tag, to avoid overlooked vulnerabilities from creeping into their codebases.

## Status

[![npm version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]

## Installation

```sh
npm install eslint eslint-plugin-sql-template --save-dev
```

## Usage

Add `sql-template` to both the `plugins` and `rules` sections of your `ESLint` configuration file. Example:

```js
// eslint.config.js
import sqlTemplate from 'eslint-plugin-sql-template';

module.exports = [
  {
    plugins: {
      'sql-template': sqlTemplate
    },
    rules: {
      'sql-template/no-unsafe-query': 'error'
    }
  }
];
```

## Rules

This plugin includes the following list of rules.

### `no-unsafe-query`

Disallows the usage of raw SQL templates with interpolation when not protected with the `sql` tag. Use this rule when you want to enforce protection against SQL injection attacks on all queries.

#### Example

Examples of **incorrect** code for this rule:

```js
/*eslint sql-template/no-unsafe-query: "error"*/

const value = 42;
const query = `SELECT * FROM users WHERE id = ${value}`;
db.query(query);

const columns = 'id, name';
Users.query(`SELECT ${columns} FROM users`);
```

Examples of **correct** code for this rule:

```js
/*eslint sql-template/no-unsafe-query: "error"*/

const value = 42;
const query = sql`SELECT * FROM users WHERE id = ${value}`;
db.query(query);

Users.query(`SELECT id, name FROM users`);

const punctuation = '!';
foo.bar(`Not SQL${punctuation}`);
```

## License

[MIT](https://opensource.org/licenses/MIT)

## Contributing

### Development

Install dependencies:

```sh
npm i
```

Run tests:

```sh
npm run test
```

### Cutting a release

The release process is automated via the [release](https://github.com/uphold/eslint-plugin-sql-template/actions/workflows/release.yaml) GitHub workflow. Run it by clicking the "Run workflow" button.

[npm-image]: https://img.shields.io/npm/v/eslint-plugin-sql-template.svg
[npm-url]: https://www.npmjs.com/package/eslint-plugin-sql-template
[ci-image]: https://github.com/uphold/eslint-plugin-sql-template/actions/workflows/ci.yaml/badge.svg?branch=master
[ci-url]: https://github.com/uphold/eslint-plugin-sql-template/actions/workflows/ci.yaml
