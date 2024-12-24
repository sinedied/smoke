import {render} from './template.js';
import {MockContentError, getMockContent} from './mock.js';

function getResponseDetails(response, statusCode) {
  const details = {
    statusCode: statusCode || (response ? 200 : 204),
    headers: {},
    body: null,
  };
  const hasProperty = response && response.hasOwnProperty.bind(response);

  if (response !== null && typeof response === 'object' && hasProperty('statusCode') && hasProperty('body')) {
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
  res.status(500).type('txt');
  res.body = error ? `${message}: ${error.message}` : message;
}

export async function getMockResponse(mock, data) {
  let response = await getMockContent(mock);

  // Response depends of input file type:
  // - JavaScript files are fed with request data
  // - JS/JSON files can customize response status code and headers
  // - Templates files are processed
  // - If not set, response type is derived from input file extension

  if (mock.isTemplate) {
    try {
      response = render(response, data);
    } catch (error) {
      throw new MockContentError(`Error while processing template for mock file "${mock.file}"`, error);
    }
  }

  if (mock.ext === 'json' && typeof response === 'string') {
    try {
      response = response ? JSON.parse(response) : undefined;
    } catch (error) {
      throw new MockContentError(`Error while parsing JSON for mock "${mock.file}"`, error);
    }
  } else if (mock.ext === 'js' || mock.ext === 'cjs') {
    try {
      response = response(data);
    } catch {
      throw new MockContentError(`Error while evaluating JS for mock "${mock.file}"`);
    }
  }

  return response;
}

export async function respondMock(res, mock, data, statusCode = null) {
  let response;
  try {
    response = await getMockResponse(mock, data);
  } catch (error) {
    return internalError(res, error.message, error.innerError);
  }

  const details = getResponseDetails(response, statusCode);
  const needType = !Object.getOwnPropertyNames(details.headers)
    .map((h) => h.toLowerCase())
    .includes('content-type');

  if (needType && mock.ext) {
    res.type(mock.ext === 'js' || mock.ext === 'cjs' ? 'json' : mock.ext);
  }

  res.status(details.statusCode).set(details.headers);
  res.body = details.body;
}
