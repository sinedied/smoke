export default (data) => {
  const accept = data.headers.accept || '';

  if (accept.includes('application/json')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({message: 'JSON response', type: 'json'}),
    };
  }

  if (accept.includes('text/html')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: '<html><body>HTML response</body></html>',
    };
  }

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'Not Found',
  };
};
