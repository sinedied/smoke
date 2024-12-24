import {jest} from '@jest/globals';

jest.unstable_mockModule('../lib/convert.js', () => ({
  convert: jest.fn(),
}));

describe('smoke CLI', () => {
  const oldLog = console.log;
  let convert;
  let run;

  beforeEach(async () => {
    console.log = jest.fn();
    convert = (await import('../lib/convert.js')).convert;
    run = (await import('../smoke-conv-cli.js')).run;
    convert.mockReset();
  });

  afterEach(() => {
    console.log = oldLog;
  });

  it('should display help', async () => {
    await run(['--help']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display help if there is less than 2 arguments', async () => {
    await run(['one']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display help if there is more than 2 arguments', async () => {
    await run(['one', 'two', 'three']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^Usage/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should display version', async () => {
    await run(['--version']);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\d+/));
    expect(convert).not.toHaveBeenCalled();
  });

  it('should start conversion', async () => {
    await run(['one', 'two']);
    expect(convert).toHaveBeenCalled();
  });
});
