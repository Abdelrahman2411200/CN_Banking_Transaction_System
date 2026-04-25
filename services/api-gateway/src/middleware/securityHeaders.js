// src/middleware/securityHeaders.js
const { v4: uuidv4 } = require('uuid');

module.exports = function securityHeaders(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;

  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Request-Id', requestId);
  res.set('Content-Security-Policy', "default-src 'none'");
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.set('Referrer-Policy', 'no-referrer');

  // Forward to downstream services
  req.headers['x-request-id'] = requestId;

  next();
};
