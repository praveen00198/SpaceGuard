import { app, httpServer } from '../index';
import { AddressInfo } from 'net';

describe('Phase 5 Security & Input Validation Tests', () => {
  let serverUrl: string;

  beforeAll((done) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as AddressInfo).port;
      serverUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(() => done());
  });

  it('1. Malformed JSON returns 400 MALFORMED_JSON without leaking stack trace', async () => {
    const res = await fetch(`${serverUrl}/api/satellites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"satelliteId": "SG-TEST", broken json...}',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('MALFORMED_JSON');
    expect(body.error.message).toBe('Invalid JSON syntax in request body');
    expect(body.stack).toBeUndefined();
  });

  it('2. Oversized payload returns 413 PAYLOAD_TOO_LARGE', async () => {
    // Generate 350kb of data (exceeds 256kb express.json limit)
    const largeData = 'a'.repeat(350 * 1024);
    const res = await fetch(`${serverUrl}/api/satellites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ satelliteId: 'SG-LARGE', padding: largeData }),
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.stack).toBeUndefined();
  });

  it('3. Rejects invalid satellite ID with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/satellites/invalid@satellite!id`, {
      method: 'GET',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(body.stack).toBeUndefined();
  });

  it('4. Rejects invalid anomaly ID with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/anomalies/NOT_AN_ANOMALY_ID`, {
      method: 'GET',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.stack).toBeUndefined();
  });

  it('5. Rejects invalid evidence ID with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/evidence/NOT_AN_EVIDENCE_ID`, {
      method: 'GET',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.stack).toBeUndefined();
  });

  it('6. Rejects Mongo operator injection in query parameter with 400 VALIDATION_ERROR', async () => {
    // Attempting query parameter injection: severity[$ne]=nominal
    const res = await fetch(`${serverUrl}/api/anomalies?severity[$ne]=nominal`, {
      method: 'GET',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('7. Rejects excessive query limit > 500 with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/anomalies?limit=999999999`, {
      method: 'GET',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8. Rejects unknown simulation scenario with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'malicious_destroy_satellite' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('9. Rejects negative or zero intervalMs with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${serverUrl}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'thermal-spike', intervalMs: -50 }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('10. Never leaks internal secrets or stack traces in error responses', async () => {
    const res = await fetch(`${serverUrl}/api/non_existent_route_404`);
    expect(res.status).toBe(404);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('MONGODB_URI');
    expect(bodyText).not.toContain('GEMINI_API_KEY');
    expect(bodyText).not.toContain('node_modules');
    expect(bodyText).not.toContain('at Function.');
  });
});
