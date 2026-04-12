const fs = require('node:fs');
const path = require('node:path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const USERS_FILE = path.join(__dirname, 'test-users.json');
const USER_COUNT = Number(process.env.LOAD_TEST_USER_COUNT || 200);
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'TestPass123!';

const request = async (pathName, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${pathName}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

const existingUsers = () => {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  return Array.isArray(users) ? users : [];
};

const registerUser = async (email) => {
  const { response } = await request('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, role: 'customer' }),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`register ${email} failed with ${response.status}`);
  }
};

const loginUser = async (email) => {
  const { response, body } = await request('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`login ${email} failed with ${response.status}`);
  }

  return body.accessToken;
};

const createAccount = async (index, email, accessToken) => {
  const { response, body } = await request('/v1/accounts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Idempotency-Key': `seed-account-${index}`,
    },
    body: JSON.stringify({
      name: `Load Test User ${index}`,
      email,
      initial_balance: '10000',
    }),
  });

  if (response.status === 409) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`create account ${email} failed with ${response.status}`);
  }

  return body?.data?.id;
};

const writeUsers = (users) => {
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`);
};

const main = async () => {
  const users = existingUsers();
  if (users.length >= USER_COUNT) {
    console.log(`seed file already contains ${users.length} users`);
    return;
  }

  const byEmail = new Map(users.map((user) => [user.email, user]));

  for (let index = 0; index < USER_COUNT; index += 1) {
    const email = `testuser_${index}@loadtest.internal`;
    if (byEmail.has(email)) {
      continue;
    }

    await registerUser(email);
    const accessToken = await loginUser(email);
    const accountId = await createAccount(index, email, accessToken);

    if (!accountId) {
      console.warn(`account already exists for ${email}; keeping existing seed file entries only`);
      continue;
    }

    const user = { email, password: PASSWORD, accountId };
    users.push(user);
    byEmail.set(email, user);
    writeUsers(users);
    console.log(`seeded ${email}`);
  }

  writeUsers(users);
  console.log(`wrote ${users.length} users to ${USERS_FILE}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
