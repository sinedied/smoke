## [3.1.1](https://github.com/sinedied/smoke/compare/3.1.0...3.1.1) (2021-01-11)


### Bug Fixes

* update dependencies ([894de5f](https://github.com/sinedied/smoke/commit/894de5f1868d9a691f791f7d5b4684eaa277700c))

# 3.1.0
- Add CORS option (PR https://github.com/sinedied/smoke/pull/11)

# 3.0.0
- Bump dependencies and fix vulnerabilities

## Breaking changes
- Require Node.js >= 10

# 2.2.4
- Bump dependencies and fix vulnerabilities

# 2.2.3
- Bump dependencies and fix vulnerabilities

# 2.2.2
- Fix route matching with empty path components

# 2.2.1
- Fix route matching when filename has no route

# 2.2.0
- Prettify recorded JSON mocks
- Fix recorded mock content type in some cases

## Deprecation notice
- Change route params prefix from `:` to `@` to fix Windows-naming issue
  **Note**: old syntax with `:` still works, but mocks using this syntax will
  not be working on Windows filesystem.

# 2.1.1
- Update documentation regarding collection recording

# 2.1.0
- Add `--collection` option to allow recording to a mock collection
- Add `--save-query` option to save query parameters when recording
- Add `--depth` option for mock conversion
- Change shorthand param for `--ignore` from `-g` to `-i`
- Fix `--ignore` param for `smoke-conv` tool

# 2.0.0
- Add support for single file mock collections
- Add mock collection conversion utility

## Breaking changes
- Change mock set prefix to `__`

# 1.4.0
- Add support for query params matching

# 1.3.0
- Add fallback proxy option

# 1.2.0
- Add support for middleware hooks

# 1.1.0
- Add mock recording
- Add support for base64 encoded body in js/json files
- Add ignore glob option
- Fix wrong argument used as base path

# 1.0.0
- Initial release
