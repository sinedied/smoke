module.exports = data => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'text/plain',
    'Some-Header': 'Hey there!'
  },
  body: `Your user agent is: ${data.headers['user-agent']}`
});
