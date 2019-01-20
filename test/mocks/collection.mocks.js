// Example mock collection
module.exports = {
  // Basic mock
  'api/get_ping.txt': 'pong!',

  // Different content type
  'api/get_ping.json': {message: 'pong!'},

  // Different method with function as response and no type (default to JS)
  'post_api#ping': (data) => ({message: `pong ${data.body.who}`}),

  // Match multiple methods with template
  'put+patch_api#ping.txt_': 'pong template {{query.who}}',

  // Mock with no content
  'delete_api#ping': null,

  // Define mock set with custom response
  'get_api#ping__503.json': {
    statusCode: 503,
    body: {message: 'Not available'}
  },

  // Mock with query param
  'get_api#ping?who=john.txt': 'pong john!',

  // Mock with any content buffer and no type (default to JSON)
  'get_api#ping#me': {
    statusCode: 200,
    headers: {'Content-Type': 'text/plain'},
    body: 'cG9uZyA2NCE=',
    buffer: true
  },

  // Mock that conflicts with existing file mock
  'get_api#hello.json': {hello: 'not used'}
};
