import { Router, Request, Response } from 'express';
import { SatelliteService } from './satelliteService';
import { CreateSatelliteSchema } from './schemas';
import { SatelliteIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const satelliteRouter = Router();

const SatelliteParamsSchema = z.object({
  id: SatelliteIdSchema,
});

satelliteRouter.get('/', async (_req: Request, res: Response) => {
  const satellites = await SatelliteService.getAllSatellites();
  res.json({
    data: satellites,
    total: satellites.length,
  });
});

satelliteRouter.get(
  '/:id',
  validateRequest(SatelliteParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const satellite = await SatelliteService.getSatelliteById(id);
    if (!satellite) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Satellite ${id} not found` } });
      return;
    }
    res.json({ data: satellite });
  }
);

satelliteRouter.get(
  '/:id/satnogs',
  validateRequest(SatelliteParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const satellite = await SatelliteService.getSatelliteById(id);
    const noradId = satellite?.noradId || 25544;
    const { SatNogsService } = await import('./satnogsService');
    const metadata = await SatNogsService.getSatelliteMetadata(noradId);
    res.json({ data: metadata });
  }
);

satelliteRouter.post(
  '/',
  validateRequest(CreateSatelliteSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const created = await SatelliteService.createSatellite(req.body);
      res.status(201).json({ data: created });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create satellite';
      res.status(409).json({ error: { code: 'CONFLICT', message } });
    }
  }
);
