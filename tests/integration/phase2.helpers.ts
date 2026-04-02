export const resolveServiceUrl = (
  configuredUrl: string | undefined,
  dockerServiceUrl: string,
  hostUrl: string
): string => {
  if (!configuredUrl || configuredUrl === dockerServiceUrl) {
    return hostUrl;
  }

  return configuredUrl;
};

export const resolveMongoUri = (configuredUri: string | undefined): string => {
  if (!configuredUri || configuredUri === 'mongodb://mongodb:27017') {
    return 'mongodb://localhost:27017';
  }

  return configuredUri;
};

export const resolveKafkaBrokers = (configuredBrokers: string | undefined): string[] => {
  if (!configuredBrokers || configuredBrokers === 'kafka:9092' || configuredBrokers === 'kafka:29092') {
    return ['localhost:9092'];
  }

  return configuredBrokers
    .split(',')
    .map((broker) => broker.trim().replace('kafka:29092', 'localhost:9092').replace('kafka:9092', 'localhost:9092'))
    .filter(Boolean);
};

export const waitUntil = async (
  callback: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 250
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await callback()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for expected condition');
};
