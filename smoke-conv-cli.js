const minimist = require('minimist');

const {convert} = require('./lib/convert');

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
    alias: {v: 'version', i: 'ignore'}
  });

  if (options.help || options._.length !== 2) {
    return console.log(help);
  }

  if (options.version) {
    const pkg = require('./package.json');
    return console.log(pkg.version);
  }

  try {
    await convert(options._[0], options._[1], options.ignore);
  } catch (error) {
    console.error(`Error during conversion`, error);
  }
}

module.exports = run;
