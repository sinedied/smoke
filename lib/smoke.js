import process from 'node:process';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import proxy from 'express-http-proxy';
import corsMiddleWare from 'cors';
import {getMocks} from './mock.js';
import {respondMock} from './response.js';
import {record} from './recorder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer(options) {
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
        origin(origin, callback) {
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
        },
      }),
    );
  }

  const hooks = {before: [], after: []};

  if (options.logs) {
    const morgan = (await import('morgan')).default;
    app.use(morgan('dev'));
  }

  if (options.hooks) {
    try {
      const hooksFile = path.isAbsolute(options.hooks) ? options.hooks : path.join(process.cwd(), options.hooks);
      let loadedHooks = (await import(hooksFile)) || {};
      loadedHooks = loadedHooks.default ?? loadedHooks;
      hooks.before = Array.isArray(loadedHooks.before) ? loadedHooks.before : [];
      hooks.after = Array.isArray(loadedHooks.after) ? loadedHooks.after : [];
    } catch (error) {
      process.exitCode = -1;
      return console.error(`Cannot setup middleware hooks: ${error.message}`);
    }
  }

  return app.all(/(.*)/, hooks.before, asyncMiddleware(processRequest(options)), hooks.after, sendResponse);
}

export function startServer(app) {
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
  options ||= {};
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
    https: options.https || false,
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
    const ignore = [...options.ignore, ...(options.hooks ? [options.hooks] : [])];
    const mocks = await getMocks(options.basePath, [options.notFound, ...ignore]);
    const matches = mocks.reduce((allMatches, mock) => {
      const match = reqPath.match(mock.regexp);

      if (match) {
        const isJsMock = mock.ext === 'js' || mock.ext === 'cjs' || mock.ext === '';
        const accept = req.accepts(mock.type);

        // For JS mocks and files without extension, skip accept header validation
        // For other mocks, validate accept header
        if ((isJsMock || accept) && matchMock(mock, method, options.set, query)) {
          const score =
            (mock.methods ? 1 : 0) +
            (mock.set ? 2 : 0) +
            (mock.params ? 4 : 0) +
            (mock.data === undefined ? 0.5 : 0) +
            (accept ? 0.1 : 0);
          allMatches.push({match, mock, score});
        }
      }

      return allMatches;
    }, []);

    // Body-parser v2 returns undefined for empty bodies instead of an empty object
    if (data.body === undefined) {
      data.body = {};
    }

    if (matches.length === 0) {
      if (options.proxy) {
        console.info(`No mock found for ${req.path}, proxying request to ${options.proxy}`);
        return proxy(options.proxy, {
          limit: '10mb',
          async userResDecorator(proxyRes, proxyResData, userReq) {
            if (options.record) {
              await record(userReq, proxyRes, proxyResData, options);
            }

            return proxyResData;
          },
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
      matches.sort((a, b) => b.score - a.score);
      const {match, mock} = matches[0];

      // Fill in route params
      for (const [index, key] of mock.keys.entries()) {
        data.params[key.name] = match[index + 1];
      }

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
  // eslint-disable-next-line promise/prefer-await-to-then
  return (req, res, next) => Promise.resolve(middleware(req, res, next)).catch(next);
}
