const path = require('path');
const request = require('supertest');

const options = {basePath: path.join(__dirname, '../test/mocks')};

jest.mock('express-http-proxy');

describe('smoke server', () => {
  let app;
  let createServer;

  beforeEach(() => {
    createServer = (...args) => require('./smoke').createServer(...args);
    app = createServer(options);
  });

  describe('should handle routing', () => {
    it('should route with file name', async () => {
      await request(app)
        .get('/api/version')
        .expect(200);
    });

    it('should route with folder, file name and params', async () => {
      await request(app)
        .get('/api/test/1')
        .expect(200);
    });

    it('should ignore node_modules if no basePath is specified', async () => {
      app = createServer();
      await request(app)
        .get('/node_modules/jest/package')
        .expect(404);
    });

    it('should route with file name with extension', async () => {
      await request(app)
        .get('/cat.jpg')
        .expect(200)
        .expect('Content-Type', /jpeg/);
    });
  });

  describe('should allow templates', () => {
    it('should render template', async () => {
      const response = await request(app)
        .get('/headers')
        .expect(200);

      expect(response.text).toContain('user-agent: node-superagent');
    });

    it('should espace HTML special chars', async () => {
      const response = await request(app)
        .get('/headers')
        .set('to-escape', '<a&b>')
        .expect(200);

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
      await request(app)
        .get('/api/random')
        .expect(200)
        .expect('Content-Type', /json/);
    });

    it('should not cache JS mocks', async () => {
      const response1 = await request(app).get('/api/random');
      jest.resetModules(); // Needed as Jest implements its own cache
      const response2 = await request(app).get('/api/random');

      expect(response1.body).not.toEqual(response2.body);
    });
  });

  describe('should use a different mock set', () => {
    it('should use mock set 500', async () => {
      app = createServer({...options, set: '500'});
      const response = await request(app).get('/api/test/1');

      expect(response.body).toEqual({message: 'Error'});
    });

    it('should fall back to default mock if there is no set variant', async () => {
      app = createServer({...options, set: '500'});
      const response = await request(app).get('/api/hello');

      expect(response.body).toEqual({hello: 'world'});
    });
  });

  describe('should handle custom responses', () => {
    it('should set custom header', async () => {
      await request(app)
        .get('/api/test/1')
        .expect('custom-header', 'hello')
        .expect('Content-Type', /json/);
    });

    it('should set custom status', async () => {
      app = createServer({...options, set: '500'});
      await request(app)
        .get('/api/test/1')
        .expect(500);
    });

    it('should set custom response using JS mock', async () => {
      await request(app)
        .get('/user-agent')
        .expect('Some-Header', 'Hey there!');
    });

    it('should use base64 buffer from custom response', async () => {
      const response = await request(app)
        .get('/api/buffer')
        .expect(200);

      expect(response.body.toString('utf8')).toBe('Smoke rocks!');
    });
  });

  describe('should discriminate http methods', () => {
    it('should use specific mock for get method', async () => {
      const response = await request(app)
        .get('/api/hello')
        .expect(200);

      expect(response.body.hello).toBe('world');
    });

    it('should fall back to default mock with no method', async () => {
      await request(app)
        .post('/api/hello')
        .expect(204);
    });

    it('should support multiple methods', async () => {
      await request(app)
        .post('/ping')
        .expect(200);

      await request(app)
        .put('/ping')
        .expect(200);

      await request(app)
        .get('/ping')
        .expect(404);
    });
  });

  describe('should discriminate with query params', () => {
    it('should use mock matching query param', async () => {
      const response = await request(app)
        .get('/api/hello?who=john%20doe')
        .expect(200);

      expect(response.body.hello).toBe('john');
    });

    it('should use mock matching one query param among many', async () => {
      const response = await request(app)
        .get('/api/hello?some=value&who=john%20doe')
        .expect(200);

      expect(response.body.hello).toBe('john');
    });

    it('should use mock matching query param over matching set', async () => {
      app = createServer({...options, set: 'other'});
      const response = await request(app)
        .get('/api/hello?who=john%20doe')
        .expect(200);

      expect(response.body.hello).toBe('john');
    });
  });

  describe('should get data from request', () => {
    it('should get JSON data from post', async () => {
      const response = await request(app)
        .post('/ping')
        .send({message: 'test'})
        .expect(200);

      expect(response.body.message).toEqual('Pong test');
    });

    it('should get form data from post', async () => {
      const response = await request(app)
        .post('/ping')
        .send('message=test')
        .expect(200);

      expect(response.body.message).toEqual('Pong test');
    });
  });

  describe('should respect accept header', () => {
    it('should match any type', async () => {
      await request(app)
        .post('/api/text')
        .expect('Content-Type', 'application/octet-stream')
        .expect(200);
    });

    it('should match only specified type', async () => {
      await request(app)
        .post('/api/text')
        .set('Accept', 'text/*')
        .expect('Content-Type', /text\/plain/)
        .expect(200);
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
      await request(app)
        .get('/not-found')
        .set('Accept', 'application/json')
        .expect(404)
        .expect('Content-Type', /json/);
    });

    it('should fall back to default 404', async () => {
      await request(app)
        .get('/not-found')
        .set('Accept', 'image/png')
        .expect(404)
        .expect('Content-Type', /plain/);
    });
  });

  describe('should proxy request', () => {
    let mockProxy;

    function setupMocks(statusCode = 200) {
      mockProxy = require('express-http-proxy');
      mockProxy.mockReset();
      mockProxy.mockImplementation((_host, options) => async (req, res) => {
        await options.userResDecorator(
          {
            statusCode,
            headers: {'Content-Type': 'text/plain'}
          },
          Buffer.from('hello'),
          req
        );
        res.status(statusCode).send('hello');
      });
    }

    beforeEach(() => setupMocks());

    it('should not proxy request if a mock exists', async () => {
      app = createServer({...options, proxy: 'http://proxy.to'});
      await request(app)
        .get('/api/version')
        .expect(200);

      expect(mockProxy).not.toHaveBeenCalled();
    });

    it('should proxy request and get result', async () => {
      app = createServer({...options, proxy: 'http://proxy.to'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://proxy.to', expect.anything());
    });

    it('should proxy request and get error', async () => {
      setupMocks(401);
      app = createServer({...options, proxy: 'http://proxy.to'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(401);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://proxy.to', expect.anything());
    });
  });

  describe('should record mock', () => {
    let fs;
    let mockProxy;

    function setupMocks(statusCode = 200) {
      mockProxy = require('express-http-proxy');
      mockProxy.mockReset();
      mockProxy.mockImplementation((_host, options) => async (req, res) => {
        await options.userResDecorator(
          {
            statusCode,
            headers: {'Content-Type': 'text/plain'}
          },
          Buffer.from('hello'),
          req
        );
        res.status(statusCode).send('hello');
      });

      fs = require('fs-extra');
      fs.mkdirp = jest.fn();
      fs.writeFile = jest.fn();
    }

    beforeEach(() => setupMocks());

    it('should not proxy request if a mock exists', async () => {
      app = createServer({...options, record: 'http://record.to'});
      await request(app)
        .get('/api/version')
        .expect(200);

      expect(mockProxy).not.toHaveBeenCalled();
    });

    it('should proxy request and save mock', async () => {
      app = createServer({...options, record: 'http://record.to'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save with min depth', async () => {
      app = createServer({...options, record: 'http://record.to', depth: 0});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(options.basePath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'get_api#hello-new.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save with max depth', async () => {
      app = createServer({...options, record: 'http://record.to', depth: 50});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api/hello-new'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/hello-new/get_.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save mock with current set', async () => {
      app = createServer({...options, record: 'http://record.to', set: 'test'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new__test.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save mock with headers', async () => {
      app = createServer({...options, record: 'http://record.to', saveHeaders: true});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.json'),
        JSON.stringify(
          {
            statusCode: 200,
            headers: {'Content-Type': 'text/plain'},
            body: 'hello'
          },
          null,
          2
        )
      );
    });

    it('should proxy request and save mock with 1 query parameter', async () => {
      app = createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app)
        .get('/api/hello-new?who=world')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=world.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save mock with 2 query parameters', async () => {
      app = createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app)
        .get('/api/hello-new?who=world&say=[yay!]')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=world&say=%5Byay!%5D.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save mock with empty query parameter', async () => {
      app = createServer({...options, record: 'http://record.to', saveQueryParams: true});
      const response = await request(app)
        .get('/api/hello-new?who=')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new$who=.txt'),
        Buffer.from('hello')
      );
    });

    it('should proxy request and save custom mock', async () => {
      setupMocks(401);
      app = createServer({...options, record: 'http://record.to'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(401);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath, 'api'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'api/get_hello-new.json'),
        JSON.stringify(
          {
            statusCode: 401,
            body: 'hello'
          },
          null,
          2
        )
      );
    });

    it('should proxy request and save to new mock collection', async () => {
      app = createServer({...options, record: 'http://record.to', collection: 'collection'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'collection.mocks.js'),
        'module.exports = {\n  "get_api#hello-new.txt": "hello"\n};\n'
      );
    });

    it('should proxy request and save to existing mock collection', async () => {
      jest.resetModules();
      setupMocks();
      const mock = require('./mock');
      mock.getMocksFromCollections = jest.fn().mockReturnValueOnce(
        Promise.resolve([
          {
            reqPath: 'api/exist',
            methods: ['get', 'post'],
            params: {check: 1},
            data: {exist: true},
            ext: 'json',
            set: 'test',
            isTemplate: false
          }
        ])
      );
      fs.pathExists = jest.fn().mockReturnValue(Promise.resolve(true));

      app = createServer({...options, record: 'http://record.to', collection: 'collection'});
      const response = await request(app)
        .get('/api/hello-new')
        .expect(200);

      expect(response.text).toBe('hello');
      expect(mockProxy).toHaveBeenCalledWith('http://record.to', expect.anything());
      expect(fs.pathExists).toHaveBeenCalled();
      expect(mock.getMocksFromCollections).toHaveBeenCalled();
      expect(fs.mkdirp).toHaveBeenCalledWith(path.join(options.basePath));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(options.basePath, 'collection.mocks.js'),
        'module.exports = {\n  "get+post_api#exist$check=1__test.json": {\n    "exist": true\n  },\n  "get_api#hello-new.txt": "hello"\n};\n'
      );
    });
  });

  describe('should ignore files', () => {
    it('should ignore mock', async () => {
      app = createServer({...options, ignore: '*version*'});
      await request(app)
        .get('/api/version')
        .expect(404);
    });

    it('should ignore mock with absolute path', async () => {
      app = createServer({...options, ignore: path.join(options.basePath, '*version*')});
      await request(app)
        .get('/api/version')
        .expect(404);
    });

    it('should ignore 404', async () => {
      app = createServer({...options, ignore: '404.html'});
      await request(app)
        .get('/not-found')
        .set('Accept', 'text/html')
        .expect(404)
        .expect('Content-Type', /plain/);
    });
  });

  describe('should use middleware hooks', () => {
    beforeEach(() => jest.resetModules());

    it('should add header via before hook', async () => {
      app = createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      await request(app)
        .get('/api/hello')
        .expect(200)
        .expect('Hocus', 'pocus');
    });

    it('should fail after 1 request via before hook', async () => {
      app = createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      await request(app)
        .get('/api/hello')
        .expect(200);

      await request(app)
        .get('/api/hello')
        .expect(500);
    });

    it('should change response body via after hook', async () => {
      app = createServer({...options, hooks: path.join(__dirname, '../test/hooks.js')});
      const response = await request(app)
        .get('/api/hello')
        .expect(200);

      expect(response.body).toEqual({text: 'hooked!'});
    });

    it('should ignore hooks file when searching for mocks', async () => {
      app = createServer({basePath: path.join(__dirname, '../test'), hooks: path.join(__dirname, '../test/hooks.js')});
      await request(app)
        .get('/hooks')
        .expect(404);
    });
  });

  describe('should handle mock collections', () => {
    it('should match simple mock', async () => {
      const response = await request(app)
        .get('/api/ping')
        .expect(200)
        .expect('Content-Type', /text/);

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
      const response = await request(app)
        .put('/api/ping?who=you')
        .expect(200)
        .expect('Content-Type', /text/);

      expect(response.text).toEqual('pong template you');
    });

    it('should support mock with no content', async () => {
      const response = await request(app)
        .delete('/api/ping')
        .expect(204);

      expect(response.text).toBe('');
    });

    it('should support mock set', async () => {
      app = createServer({...options, set: '503'});
      const response = await request(app)
        .get('/api/ping')
        .expect(503);

      expect(response.body.message).toEqual('Not available');
    });

    it('should discriminate mock with query param', async () => {
      const response = await request(app)
        .get('/api/ping?who=john')
        .expect(200)
        .expect('Content-Type', /text/);

      expect(response.text).toEqual('pong john!');
    });

    it('should support mock with buffer content', async () => {
      const response = await request(app)
        .get('/api/ping/me')
        .expect(200)
        .expect('Content-Type', /text/);

      expect(response.text).toEqual('pong 64!');
    });

    it('should prioritize file mock over mock in collection', async () => {
      const response = await request(app)
        .get('/api/hello')
        .expect(200);

      expect(response.text).not.toEqual('not used');
    });

    it('should support collection for 404 errors', async () => {
      app = createServer({...options, notFound: '404.mocks.js'});
      const response = await request(app)
        .get('/api/not-found')
        .expect(404)
        .expect('Content-Type', /text/);

      expect(response.text).toEqual('Duh! Nothing there...');
    });

    it('should support file name with extension', async () => {
      await request(app)
        .get('/cat2.jpg')
        .expect(200)
        .expect('Content-Type', /jpeg/);
    });
  });
});
