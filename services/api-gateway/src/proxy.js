// src/proxy.js
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const { SERVICES } = require('./config');
const idempotency = require('./middleware/idempotency');

const proxyHandlers = {
  proxyReq: (proxyReq, req) => {
    if (req.requestId) proxyReq.setHeader('x-request-id', req.requestId);
    if (req.headers['x-user-id']) proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
    if (req.headers['x-user-role']) proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
  },
  error: (err, req, res) => {
    console.error('[proxy] error:', err.message);
    res.status(502).json({ error: 'upstream_unavailable' });
  },
};

const createServiceProxy = (target, extraOptions = {}) =>
  createProxyMiddleware({
    changeOrigin: true,
    target,
    pathRewrite: (path, req) => req.originalUrl,
    ...extraOptions,
    on: {
      ...proxyHandlers,
      ...(extraOptions.on || {}),
    },
  });

const accountProxy = createServiceProxy(SERVICES.account);
const transferProxy = createServiceProxy(SERVICES.transfer, {
  selfHandleResponse: true,
  on: {
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req) => {
      try {
        await idempotency.cacheProxyResponse(req, proxyRes, responseBuffer);
      } catch (err) {
        console.error('[idempotency] redis write error:', err);
      }

      return responseBuffer;
    }),
  },
});
const ledgerProxy = createServiceProxy(SERVICES.ledger);
const fraudProxy = createServiceProxy(SERVICES.fraud);
const notificationProxy = createServiceProxy(SERVICES.notification);

module.exports = { accountProxy, transferProxy, ledgerProxy, fraudProxy, notificationProxy };
