import { Router, Request, Response } from 'express';
import { OrbitalService } from './orbitalService';
import { SatelliteService } from '../satellites/satelliteService';
import { SatelliteIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const orbitalRouter = Router();

const OrbitalParamsSchema = z.object({
  satelliteId: SatelliteIdSchema,
});

orbitalRouter.get(
  '/context/:satelliteId',
  validateRequest(OrbitalParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const satelliteId = String(req.params.satelliteId);
    try {
      const sat = await SatelliteService.getSatelliteById(satelliteId);
      const noradId = sat?.noradId || 25544;
      const context = await OrbitalService.getOrbitalContext(satelliteId, noradId);
      res.json({ data: context });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get orbital context';
      res.status(500).json({ error: { code: 'ORBITAL_ERROR', message: msg } });
    }
  }
);
