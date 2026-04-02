const request = require('supertest');

describe('GET /metrics (Prometheus)', () => {
  it('returns exposition format in test without bearer token', async () => {
    const app = require('../../src/app');
    const res = await request(app).get('/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('bianca_http_requests_total');
    expect(res.text).toContain('bianca_http_request_duration_seconds');
    expect(res.text).toContain('bianca_process_cpu');
  });
});
