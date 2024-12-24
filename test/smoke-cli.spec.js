import {jest} from '@jest/globals';

jest.unstable_mockModule('../lib/smoke.js', () => ({
  createServer: jest.fn(),
  startServer: jest.fn(),
}));

describe('smoke CLI', () => {
  const oldLog = console.log;
  let createServer;
  let run;

  beforeEach(async () => {
    console.log = jest.fn();
    createServer = (await import('../lib/smoke.js')).createServer;
    run = (await import('../smoke-cli.js')).run;
    createServer.mockReset();
  });

  afterEach(() => {
    console.log = oldLog;
  });

  it('should display help', async () => {
    await run(['--help']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(createServer).not.toHaveBeenCalled();
  });

  it('should display version', async () => {
    await run(['--version']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\d+/));
    expect(createServer).not.toHaveBeenCalled();
  });

  it('should create mock server', async () => {
    await run([]);
    expect(createServer).toHaveBeenCalled();
  });
});
