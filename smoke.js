const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const {getMocks} = require('./lib/mock');
const {respondMock} = require('./lib/response');

const noExtensionType = 'application/octet-stream';

function createServer(options) {
  options = options || {};
  options = {
    basePath: options.basePath || '',
    port: options.port || 3000,
    host: options.host || 'localhost',
    set: options.set || null,
    notFound: options.notFound || '404.*',
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
    const mocks = await getMocks(options.basePath, ['**/*', `!${options.notFound}`]);
    const matches = [];

    for (const mock of mocks) {
      const match = reqPath.match(mock.regexp);

      if (match) {
        // Assume type application/octet-stream (buffer) for mocks without extension
        const accept = req.accepts(mock.ext || noExtensionType);

        if (accept && (!mock.method || mock.method === method) && (!mock.set || mock.set === options.set)) {
          const score = (mock.method ? 1 : 0) + (mock.set ? 1 : 0);
          matches.push({match, mock, score});
        }
      }
    }

    if (matches.length === 0) {
      // Search for 404 mocks, matching accept header
      const notFoundMocks = await getMocks(options.basePath, [options.notFound]);
      // Assume type application/octet-stream (buffer) for mocks without extension
      const types = notFoundMocks.length > 0 ? notFoundMocks.map(mock => mock.ext || noExtensionType) : null;
      const accept = types && req.accepts(types);
      const mock = accept && notFoundMocks.find(mock => mock.ext === accept);

      if (mock) {
        respondMock(res, mock, data, 404);
      } else {
        res.sendStatus(404);
      }
    } else {
      const accept = req.accepts(matches.map(match => match.mock.ext || noExtensionType));
      // Pick best match, will never be undefined as we made sure to have an accepted mock before
      const {match, mock} = matches
        .filter(match => accept === (match.mock.ext || noExtensionType))
        .sort((a, b) => b.score - a.score)[0];

      mock.keys.forEach((key, index) => {
        data.params[key.name] = match[index + 1];
      });

      respondMock(res, mock, data);
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
