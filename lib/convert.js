const path = require('path');

const {getMockFiles, getMocksFromCollections, getMock, getMockContent} = require('./mock');
const {mockCollectionExt, writeMock, writeMockCollection} = require('./recorder');

async function convert(input, output, ignore) {
  let files = await getMockFiles(process.cwd(), ignore ? [ignore] : [], [input]);
  const mockCollectionFiles = files.filter(file => file.endsWith(mockCollectionExt));
  files = files.filter(file => !file.endsWith(mockCollectionExt));

  if (files.length === 0 && mockCollectionFiles.length === 0) {
    return console.error('No files to convert');
  }

  if (files.length === 0) {
    if (mockCollectionFiles.length > 1) {
      return console.error('Only 1 mock collection can be converted at a time');
    }

    console.log(`Converting mock collection ${mockCollectionFiles[0]}...`);
    return convertMockCollection(mockCollectionFiles[0], output);
  }

  console.log(`Converting mocks to collection...`);
  return convertMocks(files, output);
}

function convertMockCollection(file, outputFolder) {
  return Promise.all(
    getMocksFromCollections(process.cwd(), [file]).map(async mock => {
      try {
        const outputFile = path.join(outputFolder, mock.originalFile);
        await writeMock(mock, outputFile);
      } catch (error) {
        console.error(`Error while converting "${file}"`, error.message);
      }
    })
  );
}

async function convertMocks(files, outputFile) {
  const mocks = await Promise.all(
    files.map(async file => {
      const mock = getMock(process.cwd(), file);
      mock.data = await getMockContent(mock);
      return mock;
    })
  );

  await writeMockCollection(mocks, outputFile);
}

module.exports = {
  convert,
  convertMockCollection,
  convertMocks
};
