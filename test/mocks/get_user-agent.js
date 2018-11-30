module.exports = data => ({
  statusCode: 203,
  headers: {
    'Custom-Header': 'Hey there!'
  },
  body: `Your user agent is: ${data.headers['user-agent']}`
});
