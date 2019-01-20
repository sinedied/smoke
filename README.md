# :dash: smoke

[![NPM version](https://img.shields.io/npm/v/smoke.svg)](https://www.npmjs.com/package/smoke)
[![Build status](https://img.shields.io/travis/sinedied/smoke/master.svg)](https://travis-ci.org/sinedied/smoke)
![Node version](https://img.shields.io/node/v/smoke.svg)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Simple yet powerful file-based mock server with recording abilities

![demo](https://user-images.githubusercontent.com/593151/49312821-9f2cc680-f4e5-11e8-900a-117120c38422.gif)

Just drop a bunch of (JSON) files in a folder and you're ready to go!

### Basic mock example
1. Start the server: `smoke`
2. Create a file named `get_api#hello.json`:
    ```json
    {
      "message": "hello world!"
    }
    ```
3. Test the mock: `curl http://localhost:3000/api/hello`

### Features

**Smoke** is a file-based, convention over configuration mock server that can fill your API mocking needs without any
complex setup. Yet, it supports many advanced features and dynamic mocks for almost any situation:

- Generate mocks quickly by recording responses from an existing server
- Use folders and file names to describe API routes and REST methods
- Use templates to generate responses based on input queries and route parameters
- Add / edit / remove mocks without restarting the server
- Generate mocks with JavaScript for more complex responses
- Define different mock sets to simulate various scenarii (errors...), with fallback
- Customize headers and status code if needed, automatically detect content-type if not specified
- Add custom middlewares to modify requests/responses
- Mock only specific requests and proxy the rest to an existing server

## Installation

```bash
npm install -g smoke
```

## Usage

See [some example mocks](test/mocks) to quickly get a grasp of the syntax and possibilities.

CLI usage is quite straightforward you can just run `smoke` unless you want to add some options:
```
Usage: smoke [<mocks_folder>] [options]

Base options:
  -p, --port <num>        Server port           [default: 3000]
  -h, --host <host>       Server host           [default: "localhost"]
  -s, --set <name>        Mocks set to use      [default: none]
  -n, --not-found <glob>  Mocks for 404 errors  [default: "404.*"]
  -g, --ignore <glob>     Files to ignore       [default: none]
  -k, --hooks <file>      Middleware hooks      [default: none]
  -x, --proxy <host>      Fallback proxy if no mock found
  -l, --logs              Enable server logs
  -v, --version           Show version
  --help                  Show help

Mock recording:
  -r, --record <host>     Proxy & record requests if no mock found
  -d, --depth <N>         Folder depth for mocks  [default: 1]
  -a, --save-headers      Save response headers
```

### File naming

**General format:** `methods_api#route#:routeParam$queryParam=value.__et.extension`

The path and file name of the mock is used to determinate:

#### Supported HTTP methods
Optionally prefix your file by the HTTP method supported followed by an underscore (for example `get_`).
You can specify multiple methods at once using a `+` to separate them (for example `post+put_`);
If no method is specified, the mock will be used for any HTTP method.

#### Server route and named route parameters
Use any combination of folders or hash-separated components to specify the server route.

For example `api/example/get_hello.json` is equivalent to `get_api#example#hello.json` and will repond to
`GET api/example/hello` requests.

Additionaly, any route component can be defined as a route parameter by prefixing the name with `:`, for example
`api#resource#:id.json` will match `GET api/resource/1` and expose `1` as the value for the `id` parameter that can be
used in dynamic mocks (templates or JavaScript).

#### Query parameters
You can further discriminate mocks by adding query parameters to match after defining the route, using a `$` (instead
of the regular `?`) like you would specify them in a request.

For example `get_api#hello?who=john.json` will match the request `api/get_hello?who=john.json`.

Multiple query parameters to match can be added with `&`, for example `get_api#hello?who=john&greet=hi.json`.
Any specified query parameter in the file name must be matched (in any order) by the request, but the opposite is not
needed.

Note that special characters must be URL-encoded, for example use `get_api#hello?who=john%20doe.json` to set the
parameter `who` with the value `john doe`.

> Tip: If you need to URL-encode a string, just run `node -p "encodeURIComponent('some string')"` in a terminal.

#### Content type
The file extension will determine the content type of the response if it's not already specified in a
[custom header](#custom-status-and-headers).

Files with no extension will use the default MIME type `application/octet-stream`.

You can have multiple mocks with the same API route and different file extensions, the server will then use the best
mock depending of the [`Accept` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) of the
request.

#### Mock set
You can optionally specify a mock set before the file extension by using a `__set-name` suffix after the file name.

For example `get_api#hello__error.json` will only be used if you start the server with the `error` set enabled:
`smoke --set error`.

If you do not specify a mock set on your file name, it will be considered as the default mock for the specified route
and will be used as a fallback if no mock with this set matched.

#### Templates
If you add an underscore `_` after the file extension, the mock will be processed as a template before being sent to
the client. Templates works only on text-based formats.

For example `get_hello.html_` or `get_hello.json_` will be treated as templates. 

Every template can use an implicit context object that have these properties defined:
- `method`: the HTTP method of the request (ex: `'GET'`, `'POST'`)
- `query`: map with query parameters that were part of the request URL. For example, matched URL
  `http://server/hello?who=world` will result in the query value: `{ who: 'world' }`.
- `params`: map containing matched route parameters. For example the mock `resource#:id.json` with the matched URL
  `http://server/resource/123` will result in the params value: `{ id: '123' }`.
- `headers`: map containing request headers
- `body`: the request body. JSON bodies are automatically parsed.
- `files`: if the request includes `multipart/form-data`, this will be the array of uploaded files (see
  [multer documentation](https://github.com/expressjs/multer) for more details)

##### Template syntax

- `{{ }}` interpolates data in place

  For example, create **get_hello.txt_** with this:
  ```
  Hello {{query.name}}!
  ```

  Then `curl "http://localhost:3000/hello?name=John"` returns `Hello John!`

- `{{{ }}}` escapes HTML special chars from interpolated string

  For example, create **get_hello.html_** with this:
  ```html
  <h1>Hello {{{query.name}}}!</h1>
  ```

  Then `curl "http://localhost:3000/hello?name=%3CJack%26Jones%3E"` returns:
  ```html
  <h1>Hello &lt;Jack&amp;Jones&gt;!</h1>
  ```

- `<{ }>` evaluates JavaScript to generate data

  For example, create **get_hello.html_** with this:
  ```html
  Hello to:
  <ul>
    <{ query.name.forEach(name => { }><li>{{name}}</li><{ }); }>
  </ul>
  ```

  Then `curl "http://localhost:3000/hello?name=Jack&name=Jones"` returns:
  ```html
  Hello to:
  <ul>
    <li>Jack</li><li>Jones</li>
  </ul>
  ```

### Custom status and headers

By default all mocks responses are sent with a status code `200` (OK), or `204` (No content) if a mock file is empty.

You can customize the response status and (optionally) headers with JSON and [JavaScript](#javascript-mocks) files,
using this syntax:
```js
{
  "statusCode": 400,
  "body": {
    "error": "Bad request"
  },
  // headers can be omitted, only use if you want to customize them
  "headers": {
    "Content-Type": "text/plain"
  } 
}
```

You can also use non-string content type if you encode the content as a base64 string in the `body` property and add
the property `"buffer": true` to the mock:
```js
{
  "statusCode": 200,
  "body": "U21va2Ugcm9ja3Mh",
  "buffer": true,
  "headers": {
    "Content-Type": "application/octet-stream"
  } 
}
```

### Mock formats

Any file format is supported for mocks, and the file extension will be used to determine the response content type.
Files with no extension will use the default MIME type `application/octet-stream`.

Text formats (for example `.json`, `.html`, `.txt`...) can be processed as [templates](#templates) by adding an
underscore to the file extension.

Note that JSON files and templates must use `UTF-8` encoding.

#### JavaScript mocks

In addition, you can define dynamic mocks using JavaScript by using the `.js` extension, that will be loaded as a regular
NodeJS module.

In that case, your JS module is expected to export a function that take an input data object with the
[same properties](#templates) as for templates and must returns the response body or an
[object](#custom-status-and-headers) containing the status code, headers and body.

Example:
```js
module.exports = (data) => `Your user agent is: ${data.headers['user-agent']}`;
```

Note that by default, JS mocks use `application/json` for the response content type. If you want to use another type,
you must set the `Content-Type` header yourself, for example:
```js
module.exports = data => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'text/plain'
  },
  body: `Your user agent is: ${data.headers['user-agent']}`
});
```

### Fallback proxy

If you want to override responses of an existing server, you can use the `--proxy <host>` option. This will proxy
every request for which a mock does not exist to the specified host.

This can also be useful for mocking yet-to-be-implemented APIs and keep using real implemented APIs.

### Mock recording

To quickly create a mock set of an existing server (to allow working offline for example), you can use the
`--record <host>` option. This will proxy every request for which a mock does not exist to the specified host, and
record the resulting response as a mock file.

You can change the maximum folder depth for mock files created this way using the `--depth` option.

The recorded mock set can also be changed using the `--set` option.

Note that by default response headers are not saved and simple mocks are generated. To change this behavior, you can
enable the `--save-headers` option.

### Middleware hooks

For more advanced usages, you can hook on any standard
[Express middleware](https://expressjs.com/en/guide/writing-middleware.html) to modify the request and/or the response
returned by the server.

To hook on your own middlewares, use the `--hooks` to specify a JavaScript module with exports setup like this:
```js
module.exports = {
  before: [], // middlewares to be executed before the request is processed
  after: []   // middlewares to be executed after the request has been processed
};
```

Middlewares executed before the request is processed can be used to bypass regular mock response, for example to
randomly simulate a server failure with an early error 500 response.

On the other hand, middlewares executed after the request have been processed can be used to augment or modify the
response, for example by adding header or changing the response status. You can also access and modify the response
body by using the special `res.body` property.

Remember that once you have used `.send()`, `.sendStatus` or `.json()` in a middleware the response cannot be altered
anymore, that's why you should use the `res.body` property instead if you plan to alter the response later on.

See some [example hooks](test/hooks.js).

### Single file mock collection

You can regroup multiple mocks in a special single file with the extension `.mocks.js`, using this format:
```js
module.exports = {
  '<file_name>': '<file_content>' // can be a string, an object (custom response) or a function (JavaScript mock)
};
```
See this [example mock collection](test/mocks/collection.mocks.js) to get an idea of all possibilities.

The format of file name is the same as for individual mock files, and will be used to match the request using the same
rules. As for the mock content, the format is also the same as what you would put in single file mock. If a request
matches both a mock file and a mock within a collection with the same specificity, the mock file will always be used
over the collection.

As the format is the same, you can convert a bunch of files to a single file mock collection and conversely.
To convert separate mock files to a collection:
```sh
smoke-conv <glob> <output_file>  // Will create <output_file>.mocks.js from all mocks found
```

To convert a mock collection to separate files:
```sh
smoke-conv <file> <output_folder>  // Will extract separate mocks into <output_folder>
```

Note that only text-based file content will be inserted directly, other file content will be converted to a base64
string.

:warning: There is a limitation regarding JavaScript mocks: only the exported function will be converted for a given
mock, meaning that if you have non-exported functions, variables or imports they will be lost during the conversion.

## Other mock servers

If you cannot find what you need here, you might want to check out one of these other NodeJS mock servers:

- [JSON Server](https://github.com/typicode/json-server)
- [mockserver](https://github.com/namshi/mockserver)
- [node-mock-server](https://github.com/smollweide/node-mock-server)
- [node-easymock](https://github.com/CyberAgent/node-easymock)
- [mockserver-node](https://github.com/jamesdbloom/mockserver-node)
