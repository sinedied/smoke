const path = require('path');
const fs = require('fs-extra');
const importFresh = require('import-fresh');

const {render} = require('./template');

function getResponseDetails(response, statusCode) {
  const details = {
    statusCode: statusCode || (response ? 200 : 204),
    headers: {},
    body: null
  };
  const hasProperty = response && response.hasOwnProperty.bind(response);

  if (typeof response === 'object' && hasProperty('statusCode') && hasProperty('body')) {
    details.statusCode = response.statusCode || details.statusCode;
    details.headers = response.headers || details.headers;
    details.body = response.body === undefined ? null : response.body;

    if (response.buffer && details.body !== null) {
      details.body = Buffer.from(details.body, 'base64');
    }
  } else {
    details.body = response;
  }

  return details;
}

function internalError(res, message, error) {
  res.status(500).send(error ? `${message}: ${error.message}` : message);
}

async function respondMock(res, mock, data, statusCode = null) {
  let result;

  // Response depends of input file type:
  // - JavaScript files are fed with request data
  // - JS/JSON files can customize response status code and headers
  // - Templates files are processed
  // - If not set, response type is derived from input file extension

  if (mock.isTemplate || mock.ext === 'json') {
    try {
      result = await fs.readFile(mock.file, 'utf-8');
    } catch (error) {
      return internalError(res, `Error while reading mock file "${mock.file}"`, error);
    }

    if (mock.isTemplate) {
      try {
        result = render(result, data);
      } catch (error) {
        return internalError(res, `Error while processing template for mock file "${mock.file}"`, error);
      }
    }

    if (mock.ext === 'json') {
      try {
        result = result ? JSON.parse(result) : undefined;
      } catch (error) {
        return internalError(res, `Error while parsing JSON for mock "${mock.file}"`, error);
      }
    }
  } else if (mock.ext === 'js') {
    try {
      const filePath = path.isAbsolute(mock.file) ? mock.file : path.join(process.cwd(), mock.file);
      result = importFresh(filePath)(data);
    } catch (error) {
      return internalError(res, `Error while evaluating JS for mock "${mock.file}"`, error);
    }
  } else {
    try {
      // Read file as buffer
      result = await fs.readFile(mock.file);
    } catch (error) {
      return internalError(res, `Error while reading mock file "${mock.file}"`, error);
    }
  }

  const details = getResponseDetails(result, statusCode);
  const needType =
    Object.getOwnPropertyNames(details.headers)
      .map(h => h.toLowerCase())
      .find(h => h === 'content-type') === undefined;

  if (needType && mock.ext) {
    res.type(mock.ext === 'js' ? 'json' : mock.ext);
  }

  res.status(details.statusCode).set(details.headers);

  if (details.body === null) {
    res.end();
  } else {
    res.send(details.body);
  }
}

module.exports = {
  respondMock
};
