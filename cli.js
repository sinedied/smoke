const minimist = require('minimist');

const {createServer, startServer} = require('./smoke');

const help = `Usage: smoke [<mocks_folder>] [options]\n`;

// TODO CLI params
// <basePath>
// -p, --port 123
// -h, --host xx
// -s, --set <name>
// -n, --not-found <mockFile>

// -i, --import <swagger URL>
// -u, --use-headers <json> (for swagger import)
// -d, --dir-level N use N dir levels for import (default: 1)

function run(args) {
  const options = minimist(args, {
    number: ['port'],
    string: ['host', 'set', 'not-found'],
    boolean: ['help', 'version'],
    alias: {
      p: 'port',
      h: 'host',
      s: 'set',
      n: 'not-found',
      v: 'version'
    },
    default: {
      port: 3000
    }
  });
  const app = createServer({
    basePath: args[0],
    port: options.port,
    host: options.host,
    set: options.set,
    notFound: options['not-found']
  });

  if (options.help) {
    return console.log(help);
  }
  if (options.version) {
    const pkg = require('./package.json');
    return console.log(pkg.version);
  }
  startServer(app);
}

module.exports = run;
