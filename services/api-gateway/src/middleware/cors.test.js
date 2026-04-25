/* global describe, expect, it, jest */

const { corsMiddleware, parseAllowedOrigins } = require('./cors');

const createResponse = () => {
  const headers = {};
  const res = {
    statusCode: 200,
    body: undefined,
    headers,
    vary: jest.fn((name) => {
      headers.Vary = name;
      return res;
    }),
    set: jest.fn((name, value) => {
      headers[name] = value;
      return res;
    }),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    send: jest.fn((body) => {
      res.body = body;
      return res;
    }),
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
  };

  return res;
};

describe('corsMiddleware', () => {
  it('parses comma-separated allowed origins', () => {
    expect(parseAllowedOrigins('http://a.test, http://b.test')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('responds to allowed auth preflight requests before route handling', () => {
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-headers': 'content-type',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    corsMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:5173');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.headers['Access-Control-Allow-Headers']).toBe('content-type');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects disallowed preflight origins', () => {
    const req = {
      method: 'OPTIONS',
      headers: { origin: 'http://evil.test' },
    };
    const res = createResponse();
    const next = jest.fn();

    corsMiddleware()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'cors_origin_forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('adds CORS headers and continues for allowed non-preflight requests', () => {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
    };
    const res = createResponse();
    const next = jest.fn();

    corsMiddleware()(req, res, next);

    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
