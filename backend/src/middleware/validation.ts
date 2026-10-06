import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';

export type RequestTarget = 'body' | 'query' | 'params';

/**
 * Validates request data (body, query, or params) against a Zod schema.
 * Rejects with 400 VALIDATION_ERROR if validation fails.
 * Assigns parsed & sanitized data back to the request object.
 */
export function validateRequest(schema: ZodSchema<any>, target: RequestTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const dataToValidate = req[target];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const formatted = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      const err = new AppError('Validation failed', 400, 'VALIDATION_ERROR', formatted);
      return next(err);
    }

    // Assign sanitized & transformed data
    (req as any)[target] = result.data;
    next();
  };
}
