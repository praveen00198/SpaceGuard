import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Assigns a unique correlation ID to each HTTP request.
 * Respects incoming X-Request-Id if alphanumeric and bounded length (max 64 chars),
 * otherwise generates a cryptographically secure random UUID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('x-request-id');
  const safeId = incomingId && /^[a-zA-Z0-9_-]{1,64}$/.test(incomingId)
    ? incomingId
    : `req_${crypto.randomUUID()}`;

  req.id = safeId;
  res.setHeader('X-Request-Id', safeId);
  next();
}
