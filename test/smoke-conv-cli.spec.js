const run = require('../smoke-conv-cli');

jest.mock('../lib/convert');

describe('smoke CLI', () => {
  const oldLog = console.log;
  let convert;

  beforeEach(() => {
    console.log = jest.fn();
    convert = require('../lib/convert').convert;
    convert.mockReset();
  });

  afterEach(() => {
    console.log = oldLog;
  });

  it('should display help', async () => {
    run(['--help']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display help if there is less than 2 arguments', async () => {
    run(['one']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display help if there is more than 2 arguments', async () => {
    run(['one', 'two', 'three']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display version', async () => {
    run(['--version']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\d+/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should start conversion', async () => {
    run(['one', 'two']);
    expect(convert).toHaveBeenCalled();
  });
});
