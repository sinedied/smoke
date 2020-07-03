const path = require('path');
const fs = require('fs-extra');
const globby = require('globby');
const {pathToRegexp} = require('path-to-regexp');
const importFresh = require('import-fresh');

const methodRegExp = /^([a-z+]+?)_/i;
const paramsRegExp = /[$?]([^.\s]+$)/;
const setRegExp = /__([\w-]+?)$/;
const defaultType = 'application/octet-stream';

class MockContentError extends Error {
  constructor(message, error) {
    super(message);
    this.innerError = error;
  }

  toString() {
    return `${this.message}: ${this.innerError.message}`;
  }
}

function getMock(basePath, file, data = undefined) {
  let ext = path.extname(file);
  const isTemplate = ext.endsWith('_');
  let basename = path.basename(file, ext);
  ext = ext ? ext.slice(1, ext.length - (isTemplate ? 1 : 0)).toLowerCase() : ext;

  if (data !== undefined) {
    ext = typeof data === 'function' ? 'js' : !ext && typeof data === 'object' ? 'json' : ext;
  }

  let set = null;
  const matchSet = basename.match(setRegExp);

  if (matchSet) {
    set = matchSet[1];
    basename = path.basename(basename, matchSet[0]);
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

    basename = basename.slice(0, Math.max(0, basename.length - matchParams[1].length - 1));
  }

  const dirComponents = path
    .dirname(file)
    .split(path.delimiter)
    .filter((c) => c && c !== '.');
  const fileComponents = basename.split('#').filter((c) => c);
  let methods = null;
  const matchMethods = fileComponents[0].match(methodRegExp);

  if (matchMethods) {
    methods = matchMethods[1];
    fileComponents[0] = fileComponents[0].slice(Math.max(0, methods.length + 1));

    if (methods) {
      methods = methods
        .split('+')
        .filter((m) => m)
        .map((m) => m.toLowerCase());
    }
  }

  const reqPath = dirComponents
    .concat(fileComponents)
    .filter((c) => c)
    .join('/')
    .replace(/@/g, ':');
  const keys = [];

  return {
    file: path.join(basePath, file),
    ext,
    type: ext || defaultType,
    set,
    isTemplate,
    methods,
    reqPath,
    regexp: pathToRegexp(reqPath, keys),
    keys,
    params,
    data
  };
}

async function getMocks(basePath, ignoreGlobs, globs = ['**/*']) {
  let mockFiles = await getMockFiles(basePath, ignoreGlobs, globs);
  const mockCollectionFiles = [];
  mockFiles = mockFiles.filter((mock) => {
    if (mock.endsWith('.mocks.js')) {
      mockCollectionFiles.push(mock);
      return false;
    }

    return true;
  });

  return mockFiles
    .map((file) => getMock(basePath, file))
    .concat(getMocksFromCollections(basePath, mockCollectionFiles));
}

function getMockFiles(basePath, ignoreGlobs, globs) {
  if (!basePath) {
    globs.push('!node_modules');
  }

  // Ensure relative paths for ignore globs
  ignoreGlobs = ignoreGlobs.map((glob) => `!${path.isAbsolute(glob) ? path.relative(basePath, glob) : glob}`);
  return globby(globs.concat(ignoreGlobs), {cwd: basePath});
}

function getMocksFromCollections(basePath, mockCollectionFiles) {
  return mockCollectionFiles.reduce((mocks, file) => {
    try {
      basePath = path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath);
      const collection = importFresh(path.join(basePath, file));
      const newMocks = Object.entries(collection).map(([route, data]) => getMock(basePath, route, data));
      return mocks.concat(newMocks);
    } catch (error) {
      console.error(`Error while loading collection "${file}"`, error);
      return mocks;
    }
  }, []);
}

async function getMockContent(mock) {
  let content;

  if (mock.data !== undefined) {
    content = mock.data;
  } else if (mock.isTemplate || mock.ext === 'json') {
    try {
      content = await fs.readFile(mock.file, 'utf-8');
    } catch (error) {
      throw new MockContentError(`Error while reading mock file "${mock.file}"`, error);
    }
  } else if (mock.ext === 'js') {
    try {
      const filePath = path.isAbsolute(mock.file) ? mock.file : path.join(process.cwd(), mock.file);
      content = importFresh(filePath);
    } catch {
      throw new MockContentError(`Error while evaluating JS for mock "${mock.file}"`);
    }
  } else {
    try {
      // Read file as buffer
      content = await fs.readFile(mock.file);
    } catch {
      throw new MockContentError(`Error while reading mock file "${mock.file}"`);
    }
  }

  return content;
}

module.exports = {
  MockContentError,
  getMock,
  getMocks,
  getMockFiles,
  getMocksFromCollections,
  getMockContent
};
