const minimist = require('minimist');

const {createServer, startServer} = require('./lib/smoke');

const help = `Usage: smoke [<mocks_folder>] [options]

Base options:
  -p, --port <num>                  Server port           [default: 3000]
  -h, --host <host>                 Server host           [default: "localhost"]
  -s, --set <name>                  Mocks set to use      [default: none]
  -n, --not-found <glob>            Mocks for 404 errors  [default: "404.*"]
  -i, --ignore <glob>               Files to ignore       [default: none]
  -k, --hooks <file>                Middleware hooks      [default: none]
  -x, --proxy <host>                Fallback proxy if no mock found
  -o, --allow-cors [all|<hosts>]    Enable CORS requests  [default: none]
  -l, --logs                        Enable server logs
  -v, --version                     Show version
  --help                            Show help

Mock recording:
  -r, --record <host>               Proxy & record requests if no mock found
  -c, --collection <file>           Save to single file mock collection
  -d, --depth <N>                   Folder depth for mocks  [default: 1]
  -a, --save-headers                Save response headers
  -q, --save-query                  Save query parameters
`;

function run(args) {
  const options = minimist(args, {
    number: ['port', 'depth'],
    string: ['host', 'set', 'not-found', 'record', 'ignore', 'hooks', 'proxy', 'collection', 'allow-cors'],
    boolean: ['help', 'version', 'logs', 'save-headers', 'save-query', 'https'],
    alias: {
      p: 'port',
      h: 'host',
      s: 'set',
      n: 'not-found',
      v: 'version',
      r: 'record',
      c: 'collection',
      d: 'depth',
      a: 'save-headers',
      q: 'save-query',
      i: 'ignore',
      k: 'hooks',
      x: 'proxy',
      o: 'allow-cors'
    }
  });

  if (options.version) {
    const pkg = require('./package.json');
    return console.log(pkg.version);
  }

  if (options.help) {
    return console.log(help);
  }

  const app = createServer({
    basePath: options._[0],
    port: options.port,
    host: options.host,
    set: options.set,
    notFound: options['not-found'],
    ignore: options.ignore,
    hooks: options.hooks,
    proxy: options.proxy,
    logs: options.logs,
    record: options.record,
    collection: options.collection,
    depth: options.depth,
    https: options.https,
    saveHeaders: options['save-headers'],
    saveQueryParams: options['save-query'],
    cors: options['allow-cors']
  });

  if (app) {
    startServer(app);
  }
}

module.exports = run;
