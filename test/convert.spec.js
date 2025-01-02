import process from 'node:process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {jest} from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const originalFs = await import('node:fs/promises');
jest.unstable_mockModule('node:fs/promises', async () => {
  return {
    default: {
      ...originalFs,
      writeFile: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});

describe('smoke conversion tools', () => {
  let fs;
  let convert;

  function uniformizePaths(mock) {
    mock.calls = mock.calls.map(([file, data]) => [file.replaceAll('\\', '/'), data]);
    return mock;
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    process.chdir(join(__dirname, '..'));
    console.log('current directory:', process.cwd());
    convert = (await import('../lib/convert.js')).convert;
    fs = (await import('node:fs/promises')).default;
  });

  describe('should convert separate mocks to a mock collection', () => {
    it('should convert all separate mocks', async () => {
      await convert('test/mocks/api', 'collection', null, null);
      expect(fs.writeFile.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "collection.mocks.js",
            "export default {
          "get_test#mocks#api": {
            "statusCode": 200,
            "body": "djEK",
            "buffer": true
          },
          "get_test#mocks#api#buffer.json": {
            "statusCode": 200,
            "body": "U21va2Ugcm9ja3Mh",
            "buffer": true,
            "headers": {
              "Content-Type": "application/octet-stream"
            }
          },
          "get_test#mocks#api#hello__other.json": {
            "hello": "other"
          },
          "get_test#mocks#api#hello.json": {
            "hello": "world"
          },
          "get_test#mocks#api#hello$who=john%20doe.json": {
            "hello": "john"
          },
          "get_test#mocks#api#quotes.json": [
            "Chuck Norris doesn't need garbage collection because he doesn't call .Dispose(), he calls .DropKick().",
            "When Chuck Norris throws exceptions, it’s across the room.",
            "Chuck Norris writes code that optimizes itself."
          ],
          "get_test#mocks#api#random.js": data => num.toString(),
          "get_test#mocks#api#random2.cjs": data => num.toString(),
          "get_test#mocks#api#test#@id__500.json_": "{\\n  \\"statusCode\\": 500,\\n  \\"body\\": {\\n    \\"message\\": \\"Error\\"\\n  }\\n}\\n",
          "get_test#mocks#api#test#@id.json_": "{\\n  \\"statusCode\\": 200,\\n  \\"headers\\": {\\n    \\"custom-header\\": \\"hello\\"\\n  },\\n  \\"body\\": {\\n    \\"message\\": \\"id: {{params.id}}\\",\\n    \\"query\\": {{JSON.stringify(query)}}\\n  }\\n}\\n",
          "test#mocks#api#hello.json": null,
          "test#mocks#api#text": {
            "statusCode": 200,
            "body": "U29tZSB0ZXh0IHJlYWQgYXMgYSByYXcgYnVmZmVyCg==",
            "buffer": true
          },
          "test#mocks#api#text.txt": "Some plain text\\n"
        };
        ",
          ],
        ]
      `);
    });

    it('should convert separate mocks and respect ignore glob', async () => {
      await convert('test/mocks/404.*', 'collection', '**/*.json', null);
      expect(fs.writeFile).toHaveBeenCalledWith(
        'collection.mocks.js',
        'export default {\n  "test#mocks#404.html": "<!doctype html>\\n<html>\\n  <body><h1>File not found!</h1></body>\\n</html>\\n"\n};\n',
      );
    });
  });

  describe('should convert a mock collection to separate mocks', () => {
    it('should convert a mock collection to separate mocks', async () => {
      await convert('test/mocks/collection.mocks.cjs', 'mocks', null, null);
      expect(uniformizePaths(fs.writeFile.mock).calls).toMatchInlineSnapshot(`
        [
          [
            "mocks/api/get_ping.txt",
            "pong!",
          ],
          [
            "mocks/api/get_ping.json",
            "{
          "message": "pong!"
        }",
          ],
          [
            "mocks/api/post_ping.js",
            "module.exports = (data) => ({message: \`pong \${data.body.who}\`});",
          ],
          [
            "mocks/api/put+patch_ping.txt_",
            "pong template {{query.who}}",
          ],
          [
            "mocks/api/delete_ping.json",
            "",
          ],
          [
            "mocks/api/get_ping__503.json",
            "{
          "statusCode": 503,
          "body": {
            "message": "Not available"
          }
        }",
          ],
          [
            "mocks/api/get_ping$who=john.txt",
            "pong john!",
          ],
          [
            "mocks/api/get_ping#me.json",
            "{
          "statusCode": 200,
          "headers": {
            "Content-Type": "text/plain"
          },
          "body": "cG9uZyA2NCE=",
          "buffer": true
        }",
          ],
          [
            "mocks/api/get_hello.json",
            "{
          "hello": "not used"
        }",
          ],
          [
            "mocks/api/get_ping#@who.txt_",
            "pong {{params.who}}!",
          ],
        ]
      `);
    });

    it('should convert to separate mocks with depth 0', async () => {
      await convert('test/mocks/collection.mocks.cjs', 'mocks', null, 0);
      expect(uniformizePaths(fs.writeFile.mock).calls[0][0]).toEqual('mocks/get_api#ping.txt');
    });

    it('should convert to separate mocks with depth 1', async () => {
      await convert('test/mocks/collection.mocks.cjs', 'mocks', null, 1);
      expect(uniformizePaths(fs.writeFile.mock).calls[0][0]).toEqual('mocks/api/get_ping.txt');
    });

    it('should convert to separate mocks with max. depth', async () => {
      await convert('test/mocks/collection.mocks.cjs', 'mocks', null, 10);
      expect(uniformizePaths(fs.writeFile.mock).calls[0][0]).toEqual('mocks/api/ping/get_.txt');
    });
  });
});
