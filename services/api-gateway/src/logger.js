const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'api-gateway',
  },
  transports: [
    new winston.transports.Console(),
  ],
});

const getHeader = (req, name) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const getUserId = (req) => {
  if (req.user?.sub) {
    return req.user.sub;
  }

  const forwardedUser = getHeader(req, 'x-user-id');
  if (forwardedUser) {
    return forwardedUser;
  }

  const authHeader = getHeader(req, 'authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  const decoded = jwt.decode(authHeader.slice(7));
  return typeof decoded === 'object' && decoded !== null ? decoded.sub : undefined;
};

const requestLogger = (req, res, next) => {
  const requestId = getHeader(req, 'x-request-id') || uuidv4();
  const startedAt = Date.now();
  const userId = getUserId(req);

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.locals.userId = userId;
  res.setHeader('x-request-id', requestId);

  logger.info('request received', {
    method: req.method,
    url: req.originalUrl,
    requestId,
    userId,
  });

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 && statusCode !== 404 ? 'warn' : 'info';

    logger.log(level, 'request completed', {
      statusCode,
      durationMs: Date.now() - startedAt,
      requestId,
      userId: res.locals.userId || getUserId(req),
    });
  });

  next();
};

module.exports = { logger, requestLogger };
