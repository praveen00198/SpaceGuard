import { Router, Request, Response } from 'express';
import { AnomalyService } from './anomalyService';
import { AnomalyQuerySchema, UpdateAnomalyStatusSchema } from './schemas';
import { AnomalyIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const anomalyRouter = Router();

const AnomalyParamsSchema = z.object({
  id: AnomalyIdSchema,
});

anomalyRouter.get(
  '/',
  validateRequest(AnomalyQuerySchema, 'query'),
  async (req: Request, res: Response) => {
    const query = req.query as any;

    const anomalies = await AnomalyService.getAnomalies({
      satelliteId: query.satelliteId,
      severity: query.severity,
      status: query.status,
      subsystem: query.subsystem,
      limit: query.limit,
    });

    res.json({
      data: anomalies,
      total: anomalies.length,
    });
  }
);

anomalyRouter.get(
  '/:id',
  validateRequest(AnomalyParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const anomaly = await AnomalyService.getAnomalyById(id);
    if (!anomaly) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` } });
      return;
    }
    res.json({ data: anomaly });
  }
);

anomalyRouter.patch(
  '/:id/status',
  validateRequest(AnomalyParamsSchema, 'params'),
  validateRequest(UpdateAnomalyStatusSchema, 'body'),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { status } = req.body;

    const updated = await AnomalyService.updateAnomalyStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Anomaly ${id} not found` } });
      return;
    }

    res.json({ data: updated });
  }
);
