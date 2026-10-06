import { z } from 'zod';
import { SatelliteIdSchema } from '../../shared/validationSchemas';

export const TelemetrySubsystemEnum = z.enum(['power', 'thermal', 'communication', 'attitude', 'payload']);
export const TelemetrySourceEnum = z.enum(['simulator', 'satnogs', 'dataset', 'manual']);
export const DataQualityEnum = z.enum(['valid', 'suspect', 'interpolated', 'missing', 'stale']);

export const TelemetryReadingInputSchema = z.object({
  satelliteId: SatelliteIdSchema,
  parameter: z.string().trim().min(1).max(64),
  timestamp: z.string().or(z.date()).transform((val) => (typeof val === 'string' ? new Date(val) : val)),
  value: z.number().finite('Telemetry value must be a finite number'),
  unit: z.string().trim().min(1).max(16),
  subsystem: TelemetrySubsystemEnum,
  source: TelemetrySourceEnum.default('simulator'),
  sourceRecordId: z.string().max(128).optional(),
  sensorId: z.string().max(64).optional(),
  quality: DataQualityEnum.default('valid'),
});

export const BatchTelemetryInputSchema = z.object({
  readings: z.array(TelemetryReadingInputSchema).min(1).max(2000),
});

export const TelemetryQuerySchema = z
  .object({
    satelliteId: SatelliteIdSchema.optional(),
    subsystem: TelemetrySubsystemEnum.optional(),
    parameter: z.string().trim().max(64).optional(),
    startTime: z.string().datetime({ message: 'startTime must be valid ISO-8601' }).optional().transform((v) => (v ? new Date(v) : undefined)),
    endTime: z.string().datetime({ message: 'endTime must be valid ISO-8601' }).optional().transform((v) => (v ? new Date(v) : undefined)),
    limit: z.coerce.number().int().min(1).max(2000).default(500),
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
        const maxWindow = 90 * 24 * 60 * 60 * 1000; // 90 days
        return data.endTime.getTime() - data.startTime.getTime() <= maxWindow;
      }
      return true;
    },
    { message: 'Query time window cannot exceed 90 days', path: ['endTime'] }
  );

export type TelemetryReadingInput = z.infer<typeof TelemetryReadingInputSchema>;
export type BatchTelemetryInput = z.infer<typeof BatchTelemetryInputSchema>;
export type TelemetryQuery = z.infer<typeof TelemetryQuerySchema>;
