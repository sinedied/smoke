const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');

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
  const ext = contentTypeHeader && mime.extension(res.headers[contentTypeHeader]);

  if (ext) {
    file += '.' + ext;
  }

  file = path.join(options.basePath, file);

  try {
    await fs.mkdirp(path.dirname(file));
    await fs.writeFile(file, data);
  } catch (error) {
    console.error(`Cannot save mock: ${error && error.message}`);
  }
}

module.exports = {
  record
};
