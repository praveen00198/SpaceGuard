import { z } from 'zod';

export const SatelliteIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid satellite identifier format');

export const AnomalyIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^ANOM-[A-Za-z0-9_-]+$/, 'Invalid anomaly identifier format (expected e.g. ANOM-SG-1-00001)');

export const EvidenceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^EVID-[A-Za-z0-9_-]+$/, 'Invalid evidence identifier format (expected e.g. EVID-TEL-00001)');

export const PaginationLimitSchema = z.coerce
  .number()
  .int('Limit must be an integer')
  .min(1, 'Limit must be at least 1')
  .max(500, 'Limit cannot exceed 500')
  .default(100);

export const BoundedTimeRangeQuerySchema = z
  .object({
    startTime: z.string().datetime({ message: 'startTime must be a valid ISO-8601 string' }).optional().transform((v) => (v ? new Date(v) : undefined)),
    endTime: z.string().datetime({ message: 'endTime must be a valid ISO-8601 string' }).optional().transform((v) => (v ? new Date(v) : undefined)),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime.getTime() >= data.startTime.getTime();
      }
      return true;
    },
    { message: 'endTime must be greater than or equal to startTime', path: ['endTime'] }
  )
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
        return data.endTime.getTime() - data.startTime.getTime() <= maxRangeMs;
      }
      return true;
    },
    { message: 'Query time window cannot exceed 90 days', path: ['endTime'] }
  );
