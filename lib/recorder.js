const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');

const stringTYpes = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'image/svg+xml'
];

function isStringContent(type) {
  return type && (/^text\//.test(type) || stringTYpes.some(t => type.startsWith(t)));
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

  if (options.set) {
    file += '.' + options.set;
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
    await fs.mkdirp(path.dirname(file));

    if (isCustomMock) {
      await fs.writeJSON(file, data, {spaces: 2});
    } else {
      await fs.writeFile(file, data);
    }
  } catch (error) {
    console.error(`Cannot save mock: ${error && error.message}`);
  }
}

module.exports = {
  record
};
