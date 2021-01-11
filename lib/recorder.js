const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');

const {getMocksFromCollections} = require('./mock');

const mockCollectionExt = '.mocks.js';
const stringTypes = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'image/svg+xml'
];

function isStringContent(type) {
  return type && (/^text\//.test(type) || stringTypes.some((t) => type.startsWith(t)));
}

async function record(req, res, data, options) {
  const contentTypeHeader = Object.keys(res.headers).find((h) => h.toLowerCase() === 'content-type');
  const contentType = contentTypeHeader && res.headers[contentTypeHeader].toLowerCase();
  const isCustomMock = options.saveHeaders || !(res.statusCode === 200 || res.statusCode === 204);
  let ext = contentType && mime.extension(contentType);

  // Prettify JSON responses
  if (data && ext === 'json') {
    try {
      data = JSON.parse(data.toString('utf8'));
    } catch {
      console.warn('Cannot parse JSON from response');
    }
  }

  if (isCustomMock) {
    const isString = isStringContent(contentType);
    ext = 'json';
    data = {
      statusCode: res.statusCode,
      headers: options.saveHeaders ? res.headers : contentType ? {'Content-Type': contentType} : undefined,
      body: data instanceof Buffer ? (isString ? data.toString('utf8') : data.toString('base64')) : null,
      buffer: isString ? undefined : true
    };
  }

  try {
    const mock = {
      reqPath: req.path,
      methods: [req.method.toLowerCase()],
      params: options.saveQueryParams ? req.query : null,
      set: options.set,
      isTemplate: false,
      ext,
      data
    };

    await (options.collection
      ? appendToMockCollection(mock, path.join(options.basePath, options.collection))
      : writeMock(mock, options.basePath, options.depth));
  } catch (error) {
    console.error(`Cannot save mock: ${error && error.message}`);
  }
}

async function appendToMockCollection(mock, outputFile) {
  if (!outputFile.endsWith(mockCollectionExt)) {
    outputFile += mockCollectionExt;
  }

  const mocks = (await fs.pathExists(outputFile)) ? await getMocksFromCollections(process.cwd(), [outputFile]) : [];
  return writeMockCollection(mocks.concat(mock), outputFile);
}

async function writeMock(mock, outputFolder, depth) {
  let content = mock.data;

  if (content === null) {
    content = '';
  } else if (typeof content === 'function') {
    content = `module.exports = ${content.toString()};`;
  } else if (typeof content === 'object' && !(content instanceof Buffer)) {
    content = JSON.stringify(content, null, 2);
  }

  const outputFile = path.join(outputFolder, buildFile(mock, depth));
  await fs.mkdirp(path.dirname(outputFile));
  await fs.writeFile(outputFile, content);
}

async function writeMockCollection(mocks, outputFile) {
  if (!outputFile.endsWith(mockCollectionExt)) {
    outputFile += mockCollectionExt;
  }

  mocks.forEach((mock) => {
    // Fix string content types
    if (mock.ext && isStringContent(mime.lookup(mock.ext)) && mock.data instanceof Buffer) {
      mock.data = mock.data.toString('utf8');
    }
  });

  let collection = indent(mocks.map((mock) => `"${buildFile(mock, 0)}": ${stringifyMockData(mock)}`).join(',\n'));
  collection = `module.exports = {\n${collection}\n};\n`;

  await fs.mkdirp(path.dirname(outputFile));
  await fs.writeFile(outputFile, collection);
}

function stringifyMockData(mock) {
  if (!mock.data) {
    return 'null';
  }

  if (typeof mock.data === 'string') {
    return mock.ext !== 'json' || mock.isTemplate ? `"${escapeString(mock.data)}"` : mock.data.trim();
  }

  if (mock.data instanceof Buffer) {
    return JSON.stringify(
      {
        statusCode: 200,
        body: mock.data.toString('base64'),
        buffer: true
      },
      null,
      2
    );
  }

  if (typeof mock.data === 'object') {
    return JSON.stringify(mock.data, null, 2).trim();
  }

  return mock.data;
}

function escapeString(str) {
  return JSON.stringify(str).slice(1, -1);
}

function indent(str) {
  const regex = /^(?!\s*$)/gm;
  return str.replace(regex, '  ');
}

function buildFile(mock, depth) {
  let file = '';

  if (mock.methods && mock.methods.length > 0) {
    file += mock.methods.join('+') + '_';
  }

  const reqPath = (mock.reqPath[0] === '/' ? mock.reqPath.slice(1) : mock.reqPath).replace(/:/g, '@');
  const pathComponents = reqPath.split('/').filter((c) => c);

  if (depth > 0) {
    file = path.join(pathComponents.splice(0, depth).join(path.sep), file);
  }

  file += pathComponents.join('#');

  if (mock.params) {
    Object.entries(mock.params).forEach(([key, value], index) => {
      file += `${index === 0 ? '$' : '&'}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
  }

  if (mock.set) {
    file += '__' + mock.set;
  }

  if (mock.ext) {
    file += '.' + mock.ext;

    if (mock.isTemplate) {
      file += '_';
    }
  }

  return file;
}

module.exports = {
  mockCollectionExt,
  writeMock,
  writeMockCollection,
  record
};
