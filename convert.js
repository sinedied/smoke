const path = require('path');
const fs = require('fs-extra');
const minimist = require('minimist');
const mime = require('mime-types');

const {getMockFiles, getMocksFromCollections, getMock, getMockContent} = require('./lib/mock');
const {isStringContent} = require('./lib/recorder');

const mockCollectionExt = '.mocks.js';
const help = `Usage: smoke-conv <input_mocks_or_collection> <output_file_or_folder>

Convert a single file mock collection to separate mock files and conversely.

If the input is a single mock collection (.mocks.js), it will be converted to
separate mock files in <output_folder>.

If the input is a set of separate mock files, it will be converted to a single
file mock collection named <output_file>.mocks.js

Options:
  -i, --ignore <glob>     Files to ignore       [default: none]
  -v, --version           Show version
  --help                  Show help
`;

async function run(args) {
  const options = minimist(args, {
    string: ['ignore'],
    boolean: ['help', 'version'],
    alias: {v: 'version', g: 'ignore'}
  });

  if (options.help || options._.length !== 2) {
    return console.log(help);
  }

  if (options.version) {
    const pkg = require('./package.json');
    return console.log(pkg.version);
  }

  try {
    await convert(options._[0], options._[1], options.ignore || []);
  } catch (error) {
    console.error(`Error during conversion`, error);
  }
}

async function convert(input, output, ignore) {
  let files = await getMockFiles(process.cwd(), ignore, input);
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
      let outputFile = mock.originalFile;
      let content;
      try {
        content = mock.data;

        if (content === null) {
          content = '';
        } else if (typeof content === 'function') {
          content = `module.exports = ${content.toString()};`;
        } else if (typeof content === 'object') {
          content = JSON.stringify(content, null, 2);
        }

        // Fix file extension if needed
        const ext = `.${mock.ext}${mock.isTemplate ? '_' : ''}`;
        if (path.extname(outputFile) !== ext) {
          outputFile += ext;
        }

        outputFile = path.join(outputFolder, outputFile);
        await fs.mkdirp(path.dirname(outputFile));
        await fs.writeFile(outputFile, content);
      } catch (error) {
        console.error(`Error while converting "${file}"`, error.message);
      }
    })
  );
}

async function convertMocks(files, outputFile) {
  if (!outputFile.endsWith(mockCollectionExt)) {
    outputFile += mockCollectionExt;
  }

  const mocks = await Promise.all(
    files.map(async file => {
      const mock = getMock(process.cwd(), file);
      mock.data = await getMockContent(mock);

      // Fix string content types
      if (isStringContent(mime.lookup(mock.ext)) && mock.data instanceof Buffer) {
        mock.data = mock.data.toString('utf8');
      }

      return mock;
    })
  );
  let collection = indent(mocks.map(mock => `"${mock.originalFile}": ${convertMockContent(mock)}`).join(',\n'));
  collection = `module.exports = {\n${collection}\n};\n`;

  await fs.mkdirp(path.dirname(outputFile));
  await fs.writeFile(outputFile, collection);
}

function convertMockContent(mock) {
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
    try {
      return JSON.stringify(mock.data, null, 2).trim();
    } catch (error) {
      console.log(mock.data);
    }
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

module.exports = run;
