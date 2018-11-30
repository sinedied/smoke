const path = require('path');
const globby = require('globby');
const pathToRegexp = require('path-to-regexp');

const methodRegExp = /([a-zA-Z+]+?){1}_.+/i;
const defaultType = 'application/octet-stream';

function getMock(basePath, file) {
  let ext = path.extname(file);
  const isTemplate = ext.endsWith('_');
  let basename = path.basename(file, ext);
  const set = path.extname(basename);
  ext = ext ? ext.substring(1, ext.length - (isTemplate ? 1 : 0)).toLowerCase() : ext;

  if (set) {
    basename = path.basename(basename, set);
  }

  const dirComponents = path
    .dirname(file)
    .split(path.delimiter)
    .filter(c => c && c !== '.');
  const fileComponents = basename.split('#').filter(c => c);
  let methods = null;
  const match = fileComponents[0].match(methodRegExp);

  if (match) {
    methods = match[1];
    fileComponents[0] = fileComponents[0].substring(methods.length + 1);

    if (methods) {
      methods = methods
        .split('+')
        .filter(m => m)
        .map(m => m.toLowerCase());
    }
  }

  const reqPath = dirComponents.concat(fileComponents).join('/');
  const keys = [];

  return {
    file: path.join(basePath, file),
    ext,
    type: ext || defaultType,
    set: set ? set.substring(1) : set,
    isTemplate,
    methods,
    reqPath,
    regexp: pathToRegexp(reqPath, keys),
    keys
  };
}

async function getMocks(basePath, globs = ['**/*']) {
  if (!basePath) {
    globs.push('!node_modules');
  }
  const mockFiles = await globby(globs, {cwd: basePath});
  return mockFiles.map(file => getMock(basePath, file));
}

module.exports = {
  getMocks,
  getMock
};
