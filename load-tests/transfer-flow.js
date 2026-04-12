import { check, sleep } from 'k6';
import http from 'k6/http';
import { SharedArray } from 'k6/data';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '4m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const baseUrl = __ENV.API_BASE_URL || 'http://localhost:8080';
const users = new SharedArray('users', () => JSON.parse(open('./test-users.json')));

const jsonHeaders = (token, requestId) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'X-Request-Id': requestId,
});

const randomUser = () => users[Math.floor(Math.random() * users.length)];

export default function transferFlow() {
  const user = randomUser();
  let target = randomUser();
  while (target.accountId === user.accountId) {
    target = randomUser();
  }

  const requestId = `k6-${__VU}-${__ITER}-${Date.now()}`;

  const login = http.post(
    `${baseUrl}/v1/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId } }
  );
  check(login, {
    'login status is 200': (response) => response.status === 200,
    'login returned access token': (response) => Boolean(response.json('accessToken')),
  });
  const token = login.json('accessToken');
  sleep(1);

  const amount = String(Math.floor(Math.random() * 500) + 1);
  const transfer = http.post(
    `${baseUrl}/v1/transfers`,
    JSON.stringify({
      from_account_id: user.accountId,
      to_account_id: target.accountId,
      amount,
    }),
    {
      headers: {
        ...jsonHeaders(token, requestId),
        'Idempotency-Key': `k6-${requestId}`,
      },
    }
  );
  check(transfer, {
    'transfer status is 201': (response) => response.status === 201,
    'transfer returned id': (response) => Boolean(response.json('data.id')),
  });
  sleep(1);

  const account = http.get(`${baseUrl}/v1/accounts/${user.accountId}`, {
    headers: jsonHeaders(token, requestId),
  });
  check(account, {
    'account status is 200': (response) => response.status === 200,
    'account balance is present': (response) => response.json('data.balance') !== undefined,
  });
  sleep(1);

  const ledger = http.get(`${baseUrl}/v1/ledger/${user.accountId}`, {
    headers: jsonHeaders(token, requestId),
  });
  check(ledger, {
    'ledger status is 200': (response) => response.status === 200,
    'ledger entry list is present': (response) => Array.isArray(response.json('data')),
  });
  sleep(1);
}
