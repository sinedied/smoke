const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');

const mockCollectionExt = '.mocks.js';
const stringTypes = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'image/svg+xml'
];

function isStringContent(type) {
  return type && (/^text\//.test(type) || stringTypes.some(t => type.startsWith(t)));
}

async function record(req, res, data, options) {
  let file = req.method.toLowerCase() + '_';
  const pathComponents = req.path
    .substring(1)
    .split('/')
    .filter(c => c);

  if (options.depth > 0) {
    file = path.join(pathComponents.splice(0, options.depth).join(path.sep), file);
  }

  file += pathComponents.join('#');

  if (options.saveQueryParams) {
    Object.entries(req.query).forEach(([key, value], index) => {
      file += `${index === 0 ? '$' : '&'}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
  }

  if (options.set) {
    file += '__' + options.set;
  }

  const contentTypeHeader = Object.keys(res.headers).find(h => h.toLowerCase() === 'content-type');
  const contentType = contentTypeHeader && res.headers[contentTypeHeader].toLowerCase();
  const isCustomMock = options.saveHeaders || !(res.statusCode === 200 || res.statusCode === 204);
  let ext;

  if (isCustomMock) {
    const isString = isStringContent(contentType);
    ext = 'json';
    data = {
      statusCode: res.statusCode,
      headers: options.saveHeaders ? res.headers : undefined,
      body: data ? (isString ? data.toString('utf8') : data.toString('base64')) : null,
      buffer: isString ? undefined : true
    };
  } else {
    ext = contentType && mime.extension(contentType);
  }

  if (ext) {
    file += '.' + ext;
  }

  file = path.join(options.basePath, file);

  try {
    await writeMock({ext, data, isTemplate: false}, file);
  } catch (error) {
    console.error(`Cannot save mock: ${error && error.message}`);
  }
}

async function writeMock(mock, outputFile) {
  let content = mock.data;

  if (content === null) {
    content = '';
  } else if (typeof content === 'function') {
    content = `module.exports = ${content.toString()};`;
  } else if (typeof content === 'object' && !(content instanceof Buffer)) {
    content = JSON.stringify(content, null, 2);
  }

  // Fix file extension if needed
  const ext = mock.ext ? `.${mock.ext}${mock.isTemplate ? '_' : ''}` : '';
  if (ext && path.extname(outputFile) !== ext) {
    outputFile = replaceExtension(outputFile, ext);
  }

  await fs.mkdirp(path.dirname(outputFile));
  await fs.writeFile(outputFile, content);
}

async function writeMockCollection(mocks, outputFile) {
  if (!outputFile.endsWith(mockCollectionExt)) {
    outputFile += mockCollectionExt;
  }

  mocks.forEach(mock => {
    // Fix string content types
    if (mock.ext && isStringContent(mime.lookup(mock.ext)) && mock.data instanceof Buffer) {
      mock.data = mock.data.toString('utf8');
    }
  });

  let collection = indent(mocks.map(mock => `"${mock.originalFile}": ${stringifyMockData(mock)}`).join(',\n'));
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

function replaceExtension(file, ext) {
  const newFile = path.basename(file, path.extname(file)) + ext;
  return path.join(path.dirname(file), newFile);
}

module.exports = {
  mockCollectionExt,
  writeMock,
  writeMockCollection,
  record
};
