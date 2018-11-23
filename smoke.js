const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const {getMocks} = require('./lib/mock');
const {respondMock} = require('./lib/response');

function createServer(options) {
  options = options || {};
  options = {
    basePath: options.basePath || '',
    port: options.port || 3000,
    host: options.host || 'localhost',
    set: options.set || null,
    notFound: options.notFound || null,
    logs: options.logs || false
  };

  const app = express()
    .disable('x-powered-by')
    .set('port', options.port)
    .set('host', options.host)
    .use(bodyParser.urlencoded({extended: true}))
    .use(bodyParser.json())
    .use(multer().any());

  if (options.logs) {
    const morgan = require('morgan');
    app.use(morgan('dev'));
  }

  return app.all('*', async (req, res) => {
    const {query, headers, body, files} = req;
    const reqPath = req.path.substring(1);
    const method = req.method.toLowerCase();
    const data = {method, query, params: {}, headers, body, files};
    const mocks = await getMocks(options.basePath);

    // TODO: score content-type
    let bestMatch = {match: null, mock: null, score: -1};

    for (const mock of mocks) {
      const match = reqPath.match(mock.regexp);
      if (match && (!mock.method || mock.method === method) && (!mock.set || mock.set === options.set)) {
        const score = (mock.method ? 1 : 0) + (mock.set ? 1 : 0);
        if (score > bestMatch.score) {
          bestMatch = {match, mock, score};
        }
      }
    }

    if (bestMatch.mock === null) {
      res.sendStatus(404);
    } else {
      const {match, mock} = bestMatch;
      // Console.log(match);
      // console.log(mock.keys);
      // console.log(data);

      mock.keys.forEach((key, index) => {
        data.params[key.name] = match[index + 1];
      });

      respondMock(res, mock, data, options.basePath);
    }
  });
}

function startServer(app) {
  const port = app.get('port');
  const host = app.get('host');
  app.listen(port, host, () => {
    console.log(`Server started on: http://${host}:${port}`);
  });
}

module.exports = {
  createServer,
  startServer
};
