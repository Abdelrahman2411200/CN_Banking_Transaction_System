// src/proxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');
const { SERVICES } = require('./config');

const commonOptions = {
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward tracing + user-identity headers
      if (req.requestId)   proxyReq.setHeader('x-request-id', req.requestId);
      if (req.headers['x-user-id'])   proxyReq.setHeader('x-user-id',   req.headers['x-user-id']);
      if (req.headers['x-user-role']) proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
    },
    error: (err, req, res) => {
      console.error('[proxy] error:', err.message);
      res.status(502).json({ error: 'upstream_unavailable' });
    },
  },
};

const accountProxy      = createProxyMiddleware({ ...commonOptions, target: SERVICES.account,      pathRewrite: (path, req) => req.originalUrl });
const transferProxy     = createProxyMiddleware({ ...commonOptions, target: SERVICES.transfer,     pathRewrite: (path, req) => req.originalUrl });
const ledgerProxy       = createProxyMiddleware({ ...commonOptions, target: SERVICES.ledger,       pathRewrite: (path, req) => req.originalUrl });
const fraudProxy        = createProxyMiddleware({ ...commonOptions, target: SERVICES.fraud,        pathRewrite: (path, req) => req.originalUrl });
const notificationProxy = createProxyMiddleware({ ...commonOptions, target: SERVICES.notification, pathRewrite: (path, req) => req.originalUrl });

module.exports = { accountProxy, transferProxy, ledgerProxy, fraudProxy, notificationProxy };
