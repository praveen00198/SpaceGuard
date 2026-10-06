import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'MALFORMED_JSON'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_PROVIDER_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'ML_SERVICE_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: ErrorCode = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public static badRequest(message: string, code: ErrorCode = 'VALIDATION_ERROR', details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  public static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  public static conflict(message: string): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }

  public static serviceUnavailable(message: string): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Centralized error handling middleware.
 * Catches all errors and returns sanitized, predictable JSON responses.
 * Internal details and stack traces are logged securely on the server but NEVER leaked to clients.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.id || 'unknown';

  // 1. Handle JSON syntax errors from body-parser
  if (err instanceof SyntaxError && 'body' in err && (err as any).status === 400) {
    logger.warn('Malformed JSON payload received', {
      requestId: reqId,
      path: req.path,
      method: req.method,
      error: err.message,
    });
    res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Invalid JSON syntax in request body',
      },
    });
    return;
  }

  // 2. Handle Payload Too Large errors (HTTP 413)
  if (err.type === 'entity.too.large' || err.statusCode === 413 || err.name === 'PayloadTooLargeError') {
    logger.warn('Request payload exceeded size limit', {
      requestId: reqId,
      path: req.path,
      method: req.method,
      limit: err.limit,
    });
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds allowable limit (max 256kb for general APIs, 1mb for telemetry batch)',
      },
    });
    return;
  }

  // 3. Handle domain AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError [${err.code}]`, {
        requestId: reqId,
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } else {
      logger.warn(`ClientError [${err.code}]`, {
        requestId: reqId,
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message,
      });
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 4. Catch-all for unexpected unhandled errors
  logger.error('Unhandled server exception', {
    requestId: reqId,
    path: req.path,
    method: req.method,
    message: err?.message || 'Unknown error',
    stack: err?.stack,
  });

  // Strict sanitization: Never expose internal error messages or stacks
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
    },
  });
}

/**
 * 404 handler for undefined routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
