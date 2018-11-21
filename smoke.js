const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const {getMocks} = require('./lib/mock');
const {respondMock} = require('./lib/response');

const set = null;

const app = express()
  .set('port', process.env.PORT || 3000)
  .use(bodyParser.urlencoded({extended: true}))
  .use(bodyParser.json())
  .use(multer().any());

// TODO CLI params
// <basePath>
// -n, --not-found <mockFile>
// -p, --port 123
// -h, --host xx
// -s, --set <name>

// -i, --import <swagger URL>
// -u, --use-headers <json> (for swagger import)
// -d, --dir-level N use N dir levels for import (default: 1)

app.all('*', async (req, res) => {
  const basePath = 'test';
  const {query, headers, body, files} = req;
  const reqPath = req.path.substring(1);
  const method = req.method.toLowerCase();
  const data = {method, query, params: {}, headers, body, files};
  const mocks = await getMocks(basePath);

  // TODO: expose POST body + parse json or form data

  // Console.log(req.path);
  // console.log(req.query);
  // console.log(mocks);

  let bestMatch = {match: null, mock: null, score: -1};

  for (const mock of mocks) {
    const match = reqPath.match(mock.regexp);
    if (match && (!mock.method || mock.method === method) && (!mock.set || mock.set === set)) {
      const score = (mock.method ? 1 : 0) + (mock.set ? 1 : 0);
      if (score > bestMatch.score) {
        bestMatch = {match, mock, score};
      }
    }
  }

  // Const mock = mocks.find(m => {
  //   match = reqPath.match(m.regexp);
  //   // Match with method + set / fallback

  //   return match;
  // });

  if (bestMatch.mock === null) {
    // TODO: use 404 mock if defined
    res.sendStatus(404);
  } else {
    const {match, mock} = bestMatch;
    // Console.log(match);
    // console.log(mock.keys);
    // console.log(data);

    mock.keys.forEach((key, index) => {
      data.params[key.name] = match[index + 1];
    });

    respondMock(res, mock, data, basePath);
  }
});

app.listen(app.get('port'), () => {
  console.log('Listening on port ' + app.get('port'));
});
