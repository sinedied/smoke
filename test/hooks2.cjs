let pass = true;

function failAfterOneRequest(req, res, next) {
  if (pass) {
    pass = false;
    next();
  } else {
    res.sendStatus(500);
    // Do not call next() here as we already sent response
  }
}

function addHeader(req, res, next) {
  res.setHeader('Hocus', 'pocus');
  next();
}

function changeBody(req, res, next) {
  res.body = {text: 'hooked!'};
  next();
}

module.exports = {
  before: [failAfterOneRequest, addHeader],
  after: [changeBody],
};
