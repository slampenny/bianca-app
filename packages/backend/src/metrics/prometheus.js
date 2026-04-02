const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({ service: 'bianca-api' });

client.collectDefaultMetrics({
  register,
  prefix: 'bianca_',
});

const httpRequestsTotal = new client.Counter({
  name: 'bianca_http_requests_total',
  help: 'Total HTTP requests (excludes /metrics and /health)',
  labelNames: ['method', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'bianca_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Record request duration and counts. Skips /metrics and /health to avoid noise / recursion.
 */
function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/health') {
    return next();
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const method = req.method;
    const statusCode = String(res.statusCode);
    const labels = { method, status_code: statusCode };
    try {
      httpRequestDurationSeconds.observe(labels, durationSec);
      httpRequestsTotal.inc(labels);
    } catch (_e) {
      /* avoid throwing in finish handler */
    }
  });
  next();
}

/**
 * @param {{ env: string, metricsScrapeToken: string | null }} appConfig
 */
function createMetricsHandler(appConfig) {
  return async (req, res) => {
    const env = appConfig.env;
    const scrapeToken = appConfig.metricsScrapeToken;
    if (env === 'production' || env === 'staging') {
      if (!scrapeToken) {
        res.status(503);
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send('# Metrics disabled: set METRICS_SCRAPE_TOKEN for this environment\n');
        return;
      }
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${scrapeToken}`) {
        res.status(403);
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send('Forbidden');
        return;
      }
    }

    try {
      res.set('Content-Type', register.contentType);
      res.send(await register.metrics());
    } catch (err) {
      res.status(500);
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(err.message || 'metrics error');
    }
  };
}

module.exports = {
  register,
  metricsMiddleware,
  createMetricsHandler,
};
