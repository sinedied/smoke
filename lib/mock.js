const path = require('path');
const globby = require('globby');
const pathToRegexp = require('path-to-regexp');

const methodRegExp = /([a-zA-Z+]+?){1}_.+/i;
const paramsRegExp = /[$?]([^.\s]+)/;
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

  let params = null;
  const matchParams = basename.match(paramsRegExp);

  if (matchParams) {
    params = matchParams[1]
      .split('&')
      .map(decodeURIComponent)
      .reduce((acc, value) => {
        const param = value.split('=');
        acc[param[0]] = param[1];
        return acc;
      }, {});

    basename = basename.substring(0, basename.length - matchParams[1].length - 1);
  }

  const dirComponents = path
    .dirname(file)
    .split(path.delimiter)
    .filter(c => c && c !== '.');
  const fileComponents = basename.split('#').filter(c => c);
  let methods = null;
  const matchMethods = fileComponents[0].match(methodRegExp);

  if (matchMethods) {
    methods = matchMethods[1];
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
    keys,
    params
  };
}

async function getMocks(basePath, ignoreGlobs, globs = ['**/*']) {
  if (!basePath) {
    globs.push('!node_modules');
  }
  // Ensure relative paths for ignore globs
  ignoreGlobs = ignoreGlobs.map(glob => `!${path.isAbsolute(glob) ? path.relative(basePath, glob) : glob}`);
  let mockFiles = await globby(globs.concat(ignoreGlobs), {cwd: basePath});
  const singleFileMocks = [];
  mockFiles = mockFiles.filter(mock => {
    if (mock.endsWith('.mocks.js')) {
      singleFileMocks.push(mock);
      return false;
    }
    return true;
  });

  return mockFiles.map(file => getMock(basePath, file));
}

module.exports = {
  getMocks,
  getMock
};
