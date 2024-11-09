const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const proxy = require('express-http-proxy');
const corsMiddleWare = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');

const {getMocks} = require('./mock');
const {respondMock} = require('./response');
const {record} = require('./recorder');

function createServer(options) {
  options = getOptions(options);

  const app = express()
    .disable('x-powered-by')
    .set('port', options.port)
    .set('host', options.host)
    .set('https', options.https)
    .use(bodyParser.urlencoded({extended: true}))
    .use(bodyParser.json({strict: false}))
    .use(multer().any());

  let allowedOrigins = options.cors ? options.cors.split(',') : [];
  allowedOrigins = allowedOrigins.map((val) => val.trim());
  if (allowedOrigins.length === 0 || allowedOrigins.includes('all')) {
    app.use(corsMiddleWare());
  } else {
    app.use(
      corsMiddleWare({
        origin: (origin, callback) => {
          /**
           * Allow requests with no 'origin'
           * i.e. mobile apps, curl etc.
           */
          if (!origin) return callback(null, true);

          if (!allowedOrigins.includes(origin)) {
            const msg = `The CORS policy for this mock does not allow access from the specified origin: ${origin}. For details on how to whitelist requests from this origin, refer to --help.`;
            return callback(new Error(msg), false);
          }

          return callback(null, true);
        }
      })
    );
  }

  let hooks = {before: [], after: []};

  if (options.logs) {
    const morgan = require('morgan');
    app.use(morgan('dev'));
  }

  if (options.hooks) {
    try {
      const hooksFile = path.isAbsolute(options.hooks) ? options.hooks : path.join(process.cwd(), options.hooks);
      hooks = require(hooksFile) || {};
      hooks.before = Array.isArray(hooks.before) ? hooks.before : [];
      hooks.after = Array.isArray(hooks.after) ? hooks.after : [];
    } catch (error) {
      process.exitCode = -1;
      return console.error(`Cannot setup middleware hooks: ${error.message}`);
    }
  }

  return app.all('*', hooks.before, asyncMiddleware(processRequest(options)), hooks.after, sendResponse);
}

function startServer(app) {
  const port = app.get('port');
  const host = app.get('host');
  const useHttps = app.get('https');

  let server;

  if (useHttps) {
    const key = fs.readFileSync(path.join(__dirname, '/../ssl/selfsigned.key'));
    const cert = fs.readFileSync(path.join(__dirname, '/../ssl/selfsigned.crt'));
    server = https.createServer({key, cert}, app);
  } else {
    server = http.createServer(app);
  }

  server.listen(port, host, () => {
    console.log(`Server started on: http${useHttps ? 's' : ''}://${host}:${port}`);
  });
}

function getOptions(options) {
  options = options || {};
  return {
    basePath: options.basePath || '',
    port: options.port || 3000,
    host: options.host || 'localhost',
    set: options.set || null,
    notFound: options.notFound || '404.*',
    ignore: options.ignore ? [options.ignore] : [],
    hooks: options.hooks || null,
    proxy: options.record || options.proxy || null,
    logs: options.logs || false,
    record: Boolean(options.record),
    collection: options.collection || null,
    depth: typeof options.depth === 'number' ? options.depth : 1,
    saveHeaders: options.saveHeaders || false,
    saveQueryParams: options.saveQueryParams || false,
    cors: options.cors || null,
    https: options.https || false
  };
}

function matchMock(mock, method, set, query) {
  return (
    (!mock.methods || mock.methods.includes(method)) &&
    (!mock.set || mock.set === set) &&
    (!mock.params || Object.entries(mock.params).every(([k, v]) => query[k] === v))
  );
}

function processRequest(options) {
  return async (req, res, next) => {
    const {query, headers, body, files} = req;
    const reqPath = req.path.slice(1);
    const method = req.method.toLowerCase();
    const data = {method, query, params: {}, headers, body, files};
    const ignore = options.ignore.concat(options.hooks ? [options.hooks] : []);
    const mocks = await getMocks(options.basePath, [options.notFound, ...ignore]);
    const matches = mocks.reduce((allMatches, mock) => {
      const match = reqPath.match(mock.regexp);

      if (match) {
        const accept = req.accepts(mock.type);

        if (accept && matchMock(mock, method, options.set, query)) {
          const score =
            (mock.methods ? 1 : 0) + (mock.set ? 2 : 0) + (mock.params ? 4 : 0) + (mock.data === undefined ? 0.5 : 0);
          allMatches.push({match, mock, score});
        }
      }

      return allMatches;
    }, []);

    if (matches.length === 0) {
      if (options.proxy) {
        console.info(`No mock found for ${req.path}, proxying request to ${options.proxy}`);
        return proxy(options.proxy, {
          limit: '10mb',
          userResDecorator: async (proxyRes, proxyResData, userReq) => {
            if (options.record) {
              await record(userReq, proxyRes, proxyResData, options);
            }

            return proxyResData;
          }
        })(req, res, next);
      }

      // Search for 404 mocks, matching accept header
      const notFoundMocks = await getMocks(options.basePath, ignore, [options.notFound]);
      const types = notFoundMocks.length > 0 ? notFoundMocks.map((mock) => mock.type) : null;
      const accept = types && req.accepts(types);
      const mock = accept && notFoundMocks.find((mock) => mock.ext === accept);

      if (mock) {
        await respondMock(res, mock, data, 404);
      } else {
        res.status(404).type('txt');
        res.body = 'Not Found';
      }
    } else {
      const sortedMatches = matches.sort((a, b) => b.score - a.score);
      const accept = req.accepts(sortedMatches.map((match) => match.mock.type));
      const {match, mock} = sortedMatches.find((match) => accept === match.mock.type);

      // Fill in route params
      mock.keys.forEach((key, index) => {
        data.params[key.name] = match[index + 1];
      });

      await respondMock(res, mock, data);
    }

    next();
  };
}

function sendResponse(_req, res) {
  if (res.body === null) {
    res.end();
  } else {
    res.send(res.body);
  }
}

function asyncMiddleware(middleware) {
  return (req, res, next) => Promise.resolve(middleware(req, res, next)).catch(next);
}

module.exports = {
  createServer,
  startServer
};
