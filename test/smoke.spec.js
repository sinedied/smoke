const path = require('path');
const request = require('supertest');

const {createServer} = require('../smoke');

const options = {basePath: path.join(__dirname, '/mocks')};

describe('smoke server', () => {
  let app;

  beforeEach(() => {
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
        .expect(200);
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
        .post('/api/ping')
        .expect(200);

      await request(app)
        .put('/api/ping')
        .expect(200);

      await request(app)
        .get('/api/ping')
        .expect(404);
    });
  });

  describe('should get data from request', () => {
    it('should get JSON data from post', async () => {
      const response = await request(app)
        .post('/api/ping')
        .send({message: 'test'})
        .expect(200);

      expect(response.body.message).toEqual('Pong test');
    });

    it('should get form data from post', async () => {
      const response = await request(app)
        .post('/api/ping')
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
        .expect('Content-Type', /html/);
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
        .expect('Content-Type', /text/);
    });
  });
});
