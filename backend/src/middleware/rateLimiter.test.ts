import express, { Request, Response } from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { strictTestLimiter, createRateLimitHandler } from './rateLimiter';
import rateLimit from 'express-rate-limit';

describe('Phase 5 Rate Limiter Tests', () => {
  let app: express.Express;
  let server: Server;
  let serverUrl: string;

  beforeAll((done) => {
    app = express();

    const independentLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: createRateLimitHandler('Independent limit reached.'),
    });

    app.get('/api/test-strict', strictTestLimiter, (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Strict operation allowed' });
    });

    app.get('/api/test-independent', independentLimiter, (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Independent operation allowed' });
    });

    server = createServer(app);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      serverUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('1. Allows requests within quota and returns standard rate limit headers', async () => {
    const res1 = await fetch(`${serverUrl}/api/test-strict`);
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as { success: boolean };
    expect(data1.success).toBe(true);
    expect(res1.headers.get('ratelimit-limit')).toBe('3');
    expect(res1.headers.get('ratelimit-remaining')).toBe('2');

    const res2 = await fetch(`${serverUrl}/api/test-strict`);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('ratelimit-remaining')).toBe('1');
  });

  it('2. Blocks requests exceeding limit with 429 RATE_LIMIT_EXCEEDED and Retry-After header', async () => {
    // We already made 2 requests in test 1.
    // 3rd request (should succeed)
    const res3 = await fetch(`${serverUrl}/api/test-strict`);
    expect(res3.status).toBe(200);

    // 4th request must be rejected with 429
    const blockedRes = await fetch(`${serverUrl}/api/test-strict`);
    expect(blockedRes.status).toBe(429);
    const body = (await blockedRes.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toContain('Test rate limit exceeded');
    expect(blockedRes.headers.get('retry-after')).toBeDefined();
  });

  it('3. Independent routes do not share rate-limiting budgets', async () => {
    // /api/test-strict is exhausted (returns 429)
    const strictRes = await fetch(`${serverUrl}/api/test-strict`);
    expect(strictRes.status).toBe(429);

    // /api/test-independent should still be accessible
    const indepRes = await fetch(`${serverUrl}/api/test-independent`);
    expect(indepRes.status).toBe(200);
    const data = (await indepRes.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });
});
