const path = require('path');
const globby = require('globby');
const pathToRegexp = require('path-to-regexp');

const verbRegExp = /([a-zA-Z]+?){1}_.+/i;

function getMock(file) {
  const ext = path.extname(file);
  const isTemplate = ext.endsWith('_');
  let basename = path.basename(file, ext);
  const set = path.extname(basename);

  if (set) {
    basename = path.basename(basename, set);
  }

  const dirComponents = path
    .dirname(file)
    .split(path.delimiter)
    .filter(c => c && c !== '.');
  const fileComponents = basename.split('#').filter(c => c);
  let method = null;
  const match = fileComponents[0].match(verbRegExp);

  if (match) {
    method = match[1];
    fileComponents[0] = fileComponents[0].substring(method.length + 1);
  }

  const reqPath = dirComponents.concat(fileComponents).join('/');
  const keys = [];

  return {
    file,
    ext: ext ? ext.substring(1, ext.length - (isTemplate ? 1 : 0)).toLowerCase() : ext,
    set: set ? set.substring(1) : set,
    isTemplate,
    method: method ? method.toLowerCase() : method,
    reqPath,
    regexp: pathToRegexp(reqPath, keys),
    keys
  };
}

async function getMocks(basePath) {
  const globs = ['**/*'];
  if (!basePath) {
    globs.push('!node_modules');
  }
  const mockFiles = await globby(globs, {cwd: basePath});
  return mockFiles.map(getMock);
}

module.exports = {
  getMocks,
  getMock
};
