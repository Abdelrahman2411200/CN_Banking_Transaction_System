const urls = process.argv.slice(2);
const timeoutMs = Number(process.env.WAIT_FOR_HTTP_TIMEOUT_MS || 180000);
const intervalMs = Number(process.env.WAIT_FOR_HTTP_INTERVAL_MS || 2000);

if (urls.length === 0) {
  console.error('Usage: node scripts/wait-for-http.mjs <url> [url...]');
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe(url) {
  const response = await fetch(url);
  const body = await response.text();
  let payload;

  try {
    payload = JSON.parse(body);
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (payload?.status && payload.status !== 'ok') {
    throw new Error(`health status ${payload.status}`);
  }
}

for (const url of urls) {
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error('not checked yet');

  console.log(`Waiting for ${url}`);

  while (Date.now() < deadline) {
    try {
      await probe(url);
      console.log(`Ready: ${url}`);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }

  if (lastError) {
    console.error(`Timed out waiting for ${url}: ${lastError.message}`);
    process.exit(1);
  }
}
