const minimist = require('minimist');

const {createServer, startServer} = require('./smoke');

const help = `Usage: smoke [<mocks_folder>] [options]

Options:
  -p, --port <num>        Server port           [default: 3000]
  -h, --host <host>       Server host           [default: "localhost"]
  -s, --set <name>        Mocks set to use      [default: none]
  -n, --not-found <glob>  Mocks for 404 errors  [default: "404.*"]
  -l, --logs              Enable server logs
  -v, --version           Show version
  --help                  Show help
`;

function run(args) {
  const options = minimist(args, {
    number: ['port'],
    string: ['host', 'set', 'not-found'],
    boolean: ['help', 'version', 'logs'],
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
    notFound: options['not-found'],
    logs: options.logs
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
