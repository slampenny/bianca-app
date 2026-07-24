/**
 * AlertSocket Redis fail-open: bounded connect, in-memory fallback, background retry.
 */
const mockAdapter = jest.fn();
const mockIo = {
  adapter: mockAdapter,
  use: jest.fn(),
  on: jest.fn(),
  close: jest.fn((cb) => cb && cb()),
};

jest.mock('socket.io', () => ({
  Server: jest.fn(() => mockIo),
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/config/config', () => ({
  env: 'test',
  frontendUrl: 'http://localhost:5173',
  jwt: { secret: 'test-secret' },
  redis: { url: 'redis://127.0.0.1:6379' },
}));

jest.mock('../../../src/services/alertBroadcast.service', () => ({
  setAlertIo: jest.fn(),
}));

const mockCreateAdapter = jest.fn(() => 'redis-adapter-instance');
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (...args) => mockCreateAdapter(...args),
}));

function makeMockRedisClient({ connectImpl }) {
  const client = {
    isOpen: false,
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    connect: jest.fn(async function connect() {
      await connectImpl.call(this);
    }),
    quit: jest.fn(async () => {
      client.isOpen = false;
    }),
    disconnect: jest.fn(async () => {
      client.isOpen = false;
    }),
    duplicate: jest.fn(),
  };
  client.duplicate.mockImplementation(() => makeMockRedisClient({ connectImpl }));
  return client;
}

const mockCreateClient = jest.fn();
jest.mock('redis', () => ({
  createClient: (...args) => mockCreateClient(...args),
}));

describe('alertSocket.server Redis fail-open', () => {
  let alertSocket;
  let logger;
  let config;
  const httpServer = { __fake: true };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });

    // Re-require after resetModules so test + SUT share the same mocked modules
    // eslint-disable-next-line global-require
    logger = require('../../../src/config/logger');
    // eslint-disable-next-line global-require
    config = require('../../../src/config/config');
    config.redis = { url: 'redis://127.0.0.1:6379' };

    mockCreateAdapter.mockReturnValue('redis-adapter-instance');
    mockIo.adapter = mockAdapter;
    mockIo.use = jest.fn();
    mockIo.on = jest.fn();
    mockIo.close = jest.fn((cb) => cb && cb());

    // eslint-disable-next-line global-require
    alertSocket = require('../../../src/realtime/alertSocket.server');
  });

  afterEach(async () => {
    if (alertSocket) {
      await alertSocket.shutdownAlertSocketServer();
    }
    jest.useRealTimers();
  });

  test('Redis up at startup: enables Redis adapter (no degraded mode)', async () => {
    mockCreateClient.mockImplementation(() =>
      makeMockRedisClient({
        connectImpl: async function connect() {
          this.isOpen = true;
        },
      })
    );

    await alertSocket.initAlertSocketServer(httpServer);

    expect(mockCreateAdapter).toHaveBeenCalled();
    expect(mockAdapter).toHaveBeenCalledWith('redis-adapter-instance');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Redis adapter enabled')
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('DEGRADED MODE')
    );
  });

  test('Redis down at startup: DEGRADED MODE, init still resolves (HTTP can listen)', async () => {
    mockCreateClient.mockImplementation(() =>
      makeMockRedisClient({
        connectImpl: async () => {
          throw new Error('ECONNREFUSED');
        },
      })
    );

    const started = Date.now();
    await alertSocket.initAlertSocketServer(httpServer);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(alertSocket.REDIS_CONNECT_TIMEOUT_MS);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DEGRADED MODE')
    );
    expect(mockCreateAdapter).not.toHaveBeenCalled();
    expect(mockAdapter).not.toHaveBeenCalled();
  });

  test('Redis recovers after degraded start: background retry attaches adapter', async () => {
    let attempt = 0;
    mockCreateClient.mockImplementation(() =>
      makeMockRedisClient({
        connectImpl: async function connect() {
          attempt += 1;
          if (attempt <= 2) {
            throw new Error('ECONNREFUSED');
          }
          this.isOpen = true;
        },
      })
    );

    await alertSocket.initAlertSocketServer(httpServer);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('DEGRADED MODE')
    );
    expect(mockCreateAdapter).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(alertSocket.REDIS_RETRY_INTERVAL_MS + 50);

    expect(mockCreateAdapter).toHaveBeenCalled();
    expect(mockAdapter).toHaveBeenCalledWith('redis-adapter-instance');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Redis recovered')
    );
  });

  test('REDIS_URL unset: in-memory adapter, no Redis clients', async () => {
    config.redis = { url: null };
    await alertSocket.initAlertSocketServer(httpServer);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL not set')
    );
  });
});
