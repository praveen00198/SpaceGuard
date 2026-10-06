import { Router, Request, Response } from 'express';
import { HealthService } from './healthService';
import { TelemetryService } from '../telemetry/telemetryService';
import { SatelliteService } from '../satellites/satelliteService';
import { SatelliteIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const healthRouter = Router();

const HealthParamsSchema = z.object({
  satelliteId: SatelliteIdSchema,
});

healthRouter.get(
  '/:satelliteId',
  validateRequest(HealthParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const satelliteId = String(req.params.satelliteId);
    const satellite = await SatelliteService.getSatelliteById(satelliteId);
    if (!satellite) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Satellite ${satelliteId} not found` } });
      return;
    }

    const latestReadings = await TelemetryService.getLatestReadings(satelliteId);
    const healthSnapshot = await HealthService.computeHealth(satelliteId, latestReadings);

    res.json({ data: healthSnapshot });
  }
);

healthRouter.get('/', async (_req: Request, res: Response) => {
  const satellites = await SatelliteService.getAllSatellites();
  const fleetHealth = await Promise.all(
    satellites.map(async (sat) => {
      const latestReadings = await TelemetryService.getLatestReadings(sat.satelliteId);
      return HealthService.computeHealth(sat.satelliteId, latestReadings);
    })
  );

  res.json({ data: fleetHealth, total: fleetHealth.length });
});
