# eslint-plugin-sql-template

ESLint plugin with rules for using the `sql` template tag from a library such as [sql-tag](https://github.com/seegno/sql-tag) on raw SQL queries.

That library escapes data provided to an SQL query statement via interpolation. This prevents, for instance, potential SQL injection attacks.

This ESLint plugin helps teams enforce the usage of that tag, to avoid overlooked vulnerabilities from creeping into their codebases.

## Installation

```sh
$ npm install eslint eslint-plugin-sql-template --save-dev
```

## Usage

Create an `.eslint.yml` file with the following:

```yaml
plugins:
  - sql-template
```

Then, you can add the custom rules to the `.eslint.yml` file:

```yaml
rules:
  - sql-template/no-unsafe-query: 2
```

To lint your project with ESLint, add the following `script` to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

and run the linter with:

```sh
$ npm run lint
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
