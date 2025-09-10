import path from 'node:path';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {expect, jest} from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const options = {basePath: path.join(__dirname, '../test/mocks')};

jest.unstable_mockModule('express-http-proxy', () => ({
  default: jest.fn(),
}));

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

describe('smoke server', () => {
  let app;
  let createServer;

  beforeEach(async () => {
    createServer = async (...args) => (await import('../lib/smoke.js')).createServer(...args);
    app = await createServer(options);
  });

  describe('should handle routing', () => {
    it('should route with file name', async () => {
      await request(app).get('/api/version').expect(200);
    });

    it('should route with folder, file name and params', async () => {
      await request(app).get('/api/test/1').expect(200);
    });

    it('should ignore node_modules if no basePath is specified', async () => {
      app = await createServer();
      await request(app).get('/node_modules/jest/package').expect(404);
    });

    it('should route with file name with extension', async () => {
      await request(app).get('/cat.jpg').expect(200).expect('Content-Type', /jpeg/);
    });

    it('should route file with empty route', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.text).toContain('Welcome!');
    });

    it('should route file with empty route in folder', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body).toEqual(Buffer.from('v1\n'));
    });

    it('should allow subpath for JS mocks', async () => {
      const response = await request(app).get('/api/random/anypath').expect(200);
      expect(response.body).toEqual(expect.any(Number));
    });
  });

  describe('should allow templates', () => {
    it('should render template', async () => {
      const response = await request(app).get('/headers').set('x-say', 'hello/world').expect(200);

      expect(response.text).toContain('x-say: hello/world');
    });

    it('should espace HTML special chars', async () => {
      const response = await request(app).get('/headers').set('to-escape', '<a&b>').expect(200);

      expect(response.text).toContain('to-escape: &lt;a&amp;b&gt;');
    });

    it('should expose route and query params', async () => {
      const response = await request(app).get('/api/test/2?debug=true');

      expect(response.body.message).toBe('id: 2');
      expect(response.body.query).toEqual({debug: 'true'});
    });
  });

  describe('should allow JS mocks', () => {
    it('should render JS', async () => {
      await request(app).get('/api/random').expect(200).expect('Content-Type', /json/);
    });

    it('should not cache JS mocks', async () => {
      const response1 = await request(app).get('/api/random');
      jest.resetModules(); // Needed as Jest implements its own cache
      const response2 = await request(app).get('/api/random');

      expect(response1.body).not.toEqual(response2.body);
    });

    it('should support CJS mocks for backward compatibility', async () => {
      await request(app).get('/api/random2').expect(200).expect('Content-Type', /json/);
    });
  });

  describe('should use a different mock set', () => {
    it('should use mock set 500', async () => {
      app = await createServer({...options, set: '500'});
      const response = await request(app).get('/api/test/1');

      expect(response.body).toEqual({message: 'Error'});
    });

    it('should fall back to default mock if there is no set variant', async () => {
      app = await createServer({...options, set: '500'});
      const response = await request(app).get('/api/hello');

      expect(response.body).toEqual({hello: 'world'});
    });
  });

  describe('should handle custom responses', () => {
    it('should set custom header', async () => {
      await request(app).get('/api/test/1').expect('custom-header', 'hello').expect('Content-Type', /json/);
    });

    it('should set custom status', async () => {
      app = await createServer({...options, set: '500'});
      await request(app).get('/api/test/1').expect(500);
    });

    it('should set custom response using JS mock', async () => {
      await request(app).get('/user-agent').expect('Some-Header', 'Hey there!');
    });

    it('should use base64 buffer from custom response', async () => {
      const response = await request(app).get('/api/buffer').expect(200);

      expect(response.body.toString('utf8')).toBe('Smoke rocks!');
    });
  });

  describe('should discriminate http methods', () => {
    it('should use specific mock for get method', async () => {
      const response = await request(app).get('/api/hello').expect(200);

      expect(response.body.hello).toBe('world');
    });

    it('should fall back to default mock with no method', async () => {
      await request(app).post('/api/hello').expect(204);
    });

    it('should support multiple methods', async () => {
      await request(app).post('/ping').expect(200);

      await request(app).put('/ping').expect(200);

      await request(app).get('/ping').expect(404);
    });
  });

  describe('should discriminate with query params', () => {
    it('should use mock matching query param', async () => {
      const response = await request(app).get('/api/hello?who=john%20doe').expect(200);

      expect(response.body.hello).toBe('john');
    });

    it('should use mock matching one query param among many', async () => {
      const response = await request(app).get('/api/hello?some=value&who=john%20doe').expect(200);

      expect(response.body.hello).toBe('john');
    });

    it('should use mock matching query param over matching set', async () => {
      app = await createServer({...options, set: 'other'});
      const response = await request(app).get('/api/hello?who=john%20doe').expect(200);

      expect(response.body.hello).toBe('john');
    });
  });

  describe('should get data from request', () => {
    it('should get JSON data from post', async () => {
      const response = await request(app).post('/ping').send({message: 'test'}).expect(200);

      expect(response.body.message).toEqual('Pong test');
    });

    it('should get form data from post', async () => {
      const response = await request(app).post('/ping').send('message=test').expect(200);

      expect(response.body.message).toEqual('Pong test');
    });
  });

  describe('should respect accept header', () => {
    it('should match any type', async () => {
      await request(app).post('/api/text').expect(200);
    });

    it('should match only specified type', async () => {
      await request(app)
        .post('/api/text')
        .set('Accept', 'text/*')
        .expect('Content-Type', /text\/plain/)
        .expect(200);
      await request(app)
        .post('/api/text')
        .set('Accept', 'application/*')
        .expect('Content-Type', /application\/octet-stream/)
        .expect(200);
    });

    it('should allow JS mocks to handle accept headers themselves', async () => {
      await request(app)
        .get('/accept')
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200)
        .expect((res) => {
          const body = JSON.parse(res.text);
          expect(body.type).toBe('json');
        });
      await request(app)
        .get('/accept')
        .set('Accept', 'text/html')
        .expect('Content-Type', /text\/html/)
        .expect(200)
        .expect('<html><body>HTML response</body></html>');
      await request(app)
        .get('/accept')
        .set('Accept', 'image/png')
        .expect('Content-Type', /text\/plain/)
        .expect(404)
        .expect('Not Found');
    });

    it('should prefer non-JS mocks when they match accept header', async () => {
      // When both JS and non-JS mocks exist, non-JS should be preferred if it matches accept header
      await request(app)
        .get('/accept')
        .set('Accept', 'text/plain')
        .expect('Content-Type', /text\/plain/)
        .expect(200)
        .expect('This is a text file\n');

      // But JS mock should still be used when it doesn't match
      await request(app)
        .get('/accept')
        .set('Accept', 'application/json')
        .expect('Content-Type', /application\/json/)
        .expect(200)
        .expect((res) => {
          const body = JSON.parse(res.text);
          expect(body.message).toBe('JSON response');
        });
    });
  });

  describe('should handle 404', () => {
    it('should use custom 404 response', async () => {
      await request(app)
        .get('/not-found')
        .expect(404)
        .expect('Content-Type', /(html|json)/);
    });

    it('should use custom 404 with given type', async () => {
      await request(app).get('/not-found').set('Accept', 'application/json').expect(404).expect('Content-Type', /json/);
    });

    it('should fall back to default 404', async () => {
      await request(app).get('/not-found').set('Accept', 'image/png').expect(404).expect('Content-Type', /plain/);
    });
  });

  describe('should proxy request', () => {
    let mockProxy;

    async function setupMocks(statusCode = 200) {
      mockProxy = (await import('express-http-proxy')).default;
      mockProxy.mockReset();
      mockProxy.mockImplementation((_host, options) => async (req, res) => {
        await options.userResDecorator(
          {
            statusCode,
            headers: {'Content-Type': 'text/plain'},
          },
          Buffer.from('hello'),
          req,
        );
        res.status(statusCode).send('hello');
      });
    }

    beforeEach(async () => setupMocks());

    it('should not proxy request if a mock exists', async () => {
      app = await createServer({...options, proxy: 'http://proxy.to'});
      await request(app).get('/api/version').expect(200);

      expect(mockProxy).not.toHaveBeenCalled();
    });

    it('should proxy request and get result', async () => {
      app = await createServer({...options, proxy: 'http://proxy.to'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://proxy.to', expect.anything());
    });

    it('should proxy request and get error', async () => {
      await setupMocks(401);
      app = await createServer({...options, proxy: 'http://proxy.to'});
      const response = await request(app).get('/api/hello-new').expect(401);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://proxy.to', expect.anything());
    });
  });

  describe('should record mock', () => {
    let fs;
    let mockProxy;

    async function setupMocks(statusCode = 200) {
      mockProxy = (await import('express-http-proxy')).default;
      mockProxy.mockReset();
      mockProxy.mockImplementation((_host, options) => async (req, res) => {
        await options.userResDecorator(
          {
            statusCode,
            headers: {'Content-Type': 'text/plain'},
          },
          Buffer.from('hello'),
          req,
        );
        res.status(statusCode).send('hello');
      });

      fs = (await import('node:fs/promises')).default;
    }

    beforeEach(async () => setupMocks());

    it('should not proxy request if a mock exists', async () => {
      app = await createServer({...options, record: 'http://record.to'});
      await request(app).get('/api/version').expect(200);

      expect(mockProxy).not.toHaveBeenCalled();
    });

    it('should proxy request and save mock', async () => {
      app = await createServer({...options, record: 'http://record.to'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save mock with prettified JSON', async () => {
      const data = '{"json":"test"}';
      mockProxy.mockImplementation((_host, options) => async (req, res) => {
        await options.userResDecorator(
          {
            statusCode: 200,
            headers: {'Content-Type': 'application/json'},
          },
          Buffer.from(data),
          req,
        );
        res.status(200).send(data);
      });
      app = await createServer({...options, record: 'http://record.to'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe(data);
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.json'),
        '{\n  "json": "test"\n}',
      );
    });

    it('should proxy request and save with min depth', async () => {
      app = await createServer({...options, record: 'http://record.to', depth: 0});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(options.basePath, {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'get_api#hello-new.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save with max depth', async () => {
      app = await createServer({...options, record: 'http://record.to', depth: 50});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api/hello-new'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/hello-new/get_.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save mock with current set', async () => {
      app = await createServer({...options, record: 'http://record.to', set: 'test'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new__test.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save mock with headers', async () => {
      app = await createServer({...options, record: 'http://record.to', saveHeaders: true});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.json'),
        JSON.stringify(
          {
            statusCode: 200,
            headers: {'Content-Type': 'text/plain'},
            body: 'hello',
          },
          null,
          2,
        ),
      );
    });

    it('should proxy request and save mock with 1 query parameter', async () => {
      app = await createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app).get('/api/hello-new?who=world').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=world.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save mock with 2 query parameters', async () => {
      app = await createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app).get('/api/hello-new?who=world&say=[yay!]').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=world&say=%5Byay!%5D.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save mock with empty query parameter', async () => {
      app = await createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app).get('/api/hello-new?who=').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=.txt'),
        Buffer.from('hello'),
      );
    });

    it('should proxy request and save custom mock', async () => {
      await setupMocks(401);
      app = await createServer({...options, record: 'http://record.to'});
      const response = await request(app).get('/api/hello-new').expect(401);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath, 'api'), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.json'),
        JSON.stringify(
          {
            statusCode: 401,
            headers: {'Content-Type': 'text/plain'},
            body: 'hello',
          },
          null,
          2,
        ),
      );
    });

    it('should proxy request and save to new mock collection', async () => {
      app = await createServer({...options, record: 'http://record.to', collection: 'collection'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'collection.mocks.js'),
        'export default {\n  "get_api#hello-new.txt": "hello"\n};\n',
      );
    });

    it('should proxy request and save to new mock collection', async () => {
      app = await createServer({...options, record: 'http://record.to', collection: 'collection'});
      const response = await request(app).get('/api/hello-new').expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(options.basePath), {recursive: true});
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'collection.mocks.js'),
        'export default {\n  "get_api#hello-new.txt": "hello"\n};\n',
      );
    });
  });

  describe('should ignore files', () => {
    it('should ignore mock', async () => {
      app = await createServer({...options, ignore: '*version*'});
      await request(app).get('/api/version').expect(404);
    });

    it('should ignore mock with absolute path', async () => {
      app = await createServer({...options, ignore: path.join(options.basePath, '*version*')});
      await request(app).get('/api/version').expect(404);
    });

    it('should ignore 404', async () => {
      app = await createServer({...options, ignore: '404.html'});
      await request(app).get('/not-found').set('Accept', 'text/html').expect(404).expect('Content-Type', /plain/);
    });
  });

  describe('should use middleware hooks', () => {
    beforeEach(() => jest.resetModules());

    it('should add header via before hook', async () => {
      app = await createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      await request(app).get('/api/hello').expect(200).expect('Hocus', 'pocus');
    });

    it('should fail after 1 request via before hook', async () => {
      app = await createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      await request(app).get('/api/hello').expect(200);

      await request(app).get('/api/hello').expect(500);
    });

    it('should change response body via after hook', async () => {
      app = await createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      const response = await request(app).get('/api/hello').expect(200);

      expect(response.body).toEqual({text: 'hooked!'});
    });

    it('should ignore hooks file when searching for mocks', async () => {
      app = await createServer({
        basePath: path.join(__dirname, '../test'),
        hooks: path.join(__dirname, '../test/hooks.js'),
      });
      await request(app).get('/hooks').expect(404);
    });

    it('should allow hooks using .cjs', async () => {
      app = await createServer({...options, hooks: path.join(__dirname, '../test/hooks2.cjs')});
      await request(app).get('/api/hello').expect(200).expect('Hocus', 'pocus');
    });
  });

  describe('should handle mock collections', () => {
    it('should match simple mock', async () => {
      const response = await request(app).get('/api/ping').expect(200).expect('Content-Type', /text/);

      expect(response.text).toEqual('pong!');
    });

    it('should match content type', async () => {
      const response = await request(app)
        .get('/api/ping')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.message).toEqual('pong!');
    });

    it('should allow JS mock', async () => {
      const response = await request(app)
        .post('/api/ping')
        .send({who: 'me'})
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.message).toEqual('pong me');
    });

    it('should allow template mock', async () => {
      const response = await request(app).put('/api/ping?who=you').expect(200).expect('Content-Type', /text/);

      expect(response.text).toEqual('pong template you');
    });

    it('should support mock with no content', async () => {
      const response = await request(app).delete('/api/ping').expect(204);

      expect(response.text).toBe('');
    });

    it('should support mock set', async () => {
      app = await createServer({...options, set: '503'});
      const response = await request(app).get('/api/ping').expect(503);

      expect(response.body.message).toEqual('Not available');
    });

    it('should discriminate mock with query param', async () => {
      const response = await request(app).get('/api/ping?who=john').expect(200).expect('Content-Type', /text/);

      expect(response.text).toEqual('pong john!');
    });

    it('should support mock with buffer content', async () => {
      const response = await request(app).get('/api/ping/me').expect(200).expect('Content-Type', /text/);

      expect(response.text).toEqual('pong 64!');
    });

    it('should prioritize file mock over mock in collection', async () => {
      const response = await request(app).get('/api/hello').expect(200);

      expect(response.text).not.toEqual('not used');
    });

    it('should support collection for 404 errors', async () => {
      app = await createServer({...options, notFound: '404.mocks.js'});
      const response = await request(app).get('/api/not-found').expect(404).expect('Content-Type', /text/);

      expect(response.text).toEqual('Duh! Nothing there...');
    });

    it('should support file name with extension', async () => {
      await request(app).get('/cat2.jpg').expect(200).expect('Content-Type', /jpeg/);
    });

    it('should work with CJS collections', async () => {
      const response = await request(app).get('/api/ping2').expect(200).expect('Content-Type', /text/);

      expect(response.text).toEqual('pong cjs');
    });
  });
});
