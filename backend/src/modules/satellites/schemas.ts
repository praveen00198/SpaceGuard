import { z } from 'zod';

export const SatelliteTypeEnum = z.enum(['cubesat', 'smallsat', 'medium', 'large', 'simulated']);
export const SatelliteStatusEnum = z.enum(['active', 'inactive', 'decommissioned', 'simulated']);
export const TelemetrySourceEnum = z.enum(['simulator', 'satnogs', 'dataset', 'manual']);

export const CreateSatelliteSchema = z.object({
  satelliteId: z.string().min(2).max(64),
  name: z.string().min(2).max(128),
  noradId: z.number().int().positive().optional(),
  intlDesignator: z.string().optional(),
  type: SatelliteTypeEnum.default('simulated'),
  operator: z.string().optional(),
  mission: z.string().optional(),
  status: SatelliteStatusEnum.default('active'),
  launchDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  dataSource: TelemetrySourceEnum.default('simulator'),
});

export type CreateSatelliteInput = z.infer<typeof CreateSatelliteSchema>;
