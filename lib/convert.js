const process = require('node:process');
const {getMockFiles, getMocksFromCollections, getMock, getMockContent} = require('./mock.js');
const {mockCollectionExt, writeMock, writeMockCollection} = require('./recorder.js');

async function convert(input, output, ignore = null, depth = null) {
  depth = typeof depth === 'number' ? depth : 1;

  const files = await getMockFiles(process.cwd(), ignore ? [ignore] : [], [input]);
  const mockCollectionFiles = files.filter((file) => file.endsWith(mockCollectionExt));
  const mockFiles = files.filter((file) => !file.endsWith(mockCollectionExt));

  if (files.length === 0) {
    return console.error('No files to convert');
  }

  if (mockFiles.length === 0) {
    if (mockCollectionFiles.length > 1) {
      return console.error('Only 1 mock collection can be converted at a time');
    }

    console.log(`Converting mock collection ${mockCollectionFiles[0]}...`);
    return convertMockCollection(mockCollectionFiles[0], output, depth);
  }

  console.log(`Converting mocks to collection...`);
  return convertMocks(mockFiles, output);
}

function convertMockCollection(file, outputFolder, depth) {
  return Promise.all(
    getMocksFromCollections(process.cwd(), [file]).map(async (mock) => {
      try {
        await writeMock(mock, outputFolder, depth);
      } catch (error) {
        console.error(`Error while converting "${file}"`, error.message);
      }
    }),
  );
}

async function convertMocks(files, outputFile) {
  try {
    const mocks = await Promise.all(
      files.map(async (file) => {
        const mock = getMock(process.cwd(), file);
        mock.data = await getMockContent(mock);
        return mock;
      }),
    );
    mocks.sort((a, b) => a.file.localeCompare(b.file));

    await writeMockCollection(mocks, outputFile);
  } catch (error) {
    console.error(`Error during conversion`, error);
  }
}

module.exports = {
  convert,
  convertMockCollection,
  convertMocks,
};
