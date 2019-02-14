const run = require('../smoke-cli');

jest.mock('../lib/smoke');

describe('smoke CLI', () => {
  const oldLog = console.log;
  let createServer;

  beforeEach(() => {
    console.log = jest.fn();
    createServer = require('../lib/smoke').createServer;
    createServer.mockReset();
  });

  afterEach(() => {
    console.log = oldLog;
  });

  it('should display help', async () => {
    run(['--help']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(createServer).not.toHaveBeenCalled();
  });

  it('should display version', async () => {
    run(['--version']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\d+/));
    expect(createServer).not.toHaveBeenCalled();
  });

  it('should create mock server', async () => {
    run([]);
    expect(createServer).toHaveBeenCalled();
  });
});
