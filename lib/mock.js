import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import {globby} from 'globby';
import {pathToRegexp} from 'path-to-regexp';

const methodRegExp = /^([a-z+]+?)_/i;
const paramsRegExp = /[$?]([^.\s]+$)/;
const setRegExp = /__([\w-]+?)$/;
const defaultType = 'application/octet-stream';

const importFresh = async (moduleName) => import(`${moduleName}?${Date.now()}`);

export class MockContentError extends Error {
  constructor(message, error) {
    super(message);
    this.innerError = error;
  }

  toString() {
    return `${this.message}: ${this.innerError.message}`;
  }
}

export function getMock(basePath, file, data = undefined) {
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
      .map((value) => decodeURIComponent(value))
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
  const fileComponents = basename.split('#').filter(Boolean);
  let methods = null;
  const matchMethods = fileComponents[0].match(methodRegExp);

  if (matchMethods) {
    methods = matchMethods[1];
    fileComponents[0] = fileComponents[0].slice(Math.max(0, methods.length + 1));

    methods &&= methods
      .split('+')
      .filter(Boolean)
      .map((m) => m.toLowerCase());
  }

  const reqPath = [...dirComponents, ...fileComponents].filter(Boolean).join('/').replaceAll('@', ':');
  const {regexp, keys} = pathToRegexp(reqPath);

  return {
    file: path.join(basePath, file),
    ext,
    type: ext || defaultType,
    set,
    isTemplate,
    methods,
    reqPath,
    regexp,
    keys,
    params,
    data,
  };
}

export async function getMocks(basePath, ignoreGlobs, globs = ['**/*']) {
  let mockFiles = await getMockFiles(basePath, ignoreGlobs, globs);
  const mockCollectionFiles = [];
  mockFiles = mockFiles.filter((mock) => {
    if (mock.endsWith('.mocks.js') || mock.endsWith('.mocks.cjs')) {
      mockCollectionFiles.push(mock);
      return false;
    }

    return true;
  });

  return mockFiles
    .map((file) => getMock(basePath, file))
    .concat(await getMocksFromCollections(basePath, mockCollectionFiles));
}

export function getMockFiles(basePath, ignoreGlobs, globs) {
  if (!basePath) {
    globs.push('!node_modules');
  }

  // Ensure relative paths for ignore globs
  ignoreGlobs = ignoreGlobs.map((glob) => `!${path.isAbsolute(glob) ? path.relative(basePath, glob) : glob}`);
  return globby(globs.concat(ignoreGlobs), {cwd: basePath});
}

export async function getMocksFromCollections(basePath, mockCollectionFiles) {
  let mocks = [];
  basePath = path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath);

  for (const file of mockCollectionFiles) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const collection = (await importFresh(path.join(basePath, file))).default;
      const newMocks = Object.entries(collection).map(([route, data]) => getMock(basePath, route, data));
      mocks = mocks.concat(newMocks);
    } catch (error) {
      console.error(`Error while loading collection "${file}"`, error);
    }
  }

  return mocks;
}

export async function getMockContent(mock) {
  let content;

  if (mock.data !== undefined) {
    content = mock.data;
  } else if (mock.isTemplate || mock.ext === 'json') {
    try {
      content = await fs.readFile(mock.file, 'utf8');
    } catch (error) {
      throw new MockContentError(`Error while reading mock file "${mock.file}"`, error);
    }
  } else if (mock.ext === 'js' || mock.ext === 'cjs') {
    try {
      const filePath = path.isAbsolute(mock.file) ? mock.file : path.join(process.cwd(), mock.file);
      content = (await importFresh(filePath)).default;
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
