import { z } from 'zod';
import { SatelliteIdSchema, PaginationLimitSchema } from '../../shared/validationSchemas';

export const AnomalySeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const AnomalyStatusSchema = z.enum(['active', 'investigating', 'resolved', 'dismissed']);
export const TelemetrySubsystemSchema = z.enum(['power', 'thermal', 'communication', 'attitude', 'payload']);

export const AnomalyQuerySchema = z.object({
  satelliteId: SatelliteIdSchema.optional(),
  severity: AnomalySeveritySchema.optional(),
  status: AnomalyStatusSchema.optional(),
  subsystem: TelemetrySubsystemSchema.optional(),
  limit: PaginationLimitSchema,
});

export const UpdateAnomalyStatusSchema = z.object({
  status: AnomalyStatusSchema,
});

export type AnomalyQuery = z.infer<typeof AnomalyQuerySchema>;
export type UpdateAnomalyStatusInput = z.infer<typeof UpdateAnomalyStatusSchema>;
