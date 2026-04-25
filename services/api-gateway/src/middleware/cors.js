const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const parseAllowedOrigins = (value = process.env.CORS_ORIGINS) => {
  if (!value) return DEFAULT_ALLOWED_ORIGINS;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isOriginAllowed = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin);

const corsMiddleware = (options = {}) => {
  const allowedOrigins = options.allowedOrigins || parseAllowedOrigins();
  const allowedMethods = options.allowedMethods || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  const allowedHeaders =
    options.allowedHeaders || 'Authorization,Content-Type,Idempotency-Key,X-Request-Id';

  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = isOriginAllowed(origin, allowedOrigins);

    res.vary('Origin');

    if (allowed && origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      if (!allowed) {
        return res.status(403).json({ error: 'cors_origin_forbidden' });
      }

      res.set('Access-Control-Allow-Methods', allowedMethods);
      res.set(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || allowedHeaders
      );
      res.set('Access-Control-Max-Age', '600');
      return res.status(204).send();
    }

    return next();
  };
};

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  corsMiddleware,
  parseAllowedOrigins,
};
