import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

/**
 * Custom 429 response formatter adhering to SpaceGuard API error contract.
 */
export function createRateLimitHandler(message: string) {
  return (_req: Request, res: Response): void => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      },
    });
  };
}

/**
 * 1. General Read Limiter: Applied to all standard GET endpoints.
 * Relaxed limit: 300 requests per minute.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests, please slow down.'),
});

/**
 * 2. Expensive AI Assessment Limiter:
 * Strict limit: 10 generation requests per minute per IP to protect Gemini API quota and budget.
 */
export const expensiveAiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI assessment quota limit reached. Maximum 10 generation requests per minute.'),
});

/**
 * 3. Simulation Lifecycle Limiter:
 * Protects against rapid simulation start/stop spamming.
 * Limit: 20 requests per minute.
 */
export const simulationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many simulation control requests. Please wait before toggling simulations.'),
});

/**
 * 4. External Provider Refresh Limiter:
 * Protects against outbound rate-limiting by NOAA, NASA, SatNOGS, and CelesTrak.
 * Limit: 15 requests per minute.
 */
export const externalRefreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('External space data refresh rate exceeded. SpaceGuard uses cached snapshots.'),
});

/**
 * 5. Dedicated Strict Limiter for Testing Rate Limit Responses
 */
export const strictTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Test rate limit exceeded.'),
});
