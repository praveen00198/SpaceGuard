import { Router, Request, Response } from 'express';
import { CorrelationEngine } from './correlationEngine';
import { AnomalyService } from '../anomalies/anomalyService';
import { AnomalyIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const correlationRouter = Router();

const CorrelationParamsSchema = z.object({
  anomalyId: AnomalyIdSchema,
});

correlationRouter.get(
  '/anomaly/:anomalyId',
  validateRequest(CorrelationParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const anomalyId = String(req.params.anomalyId);
    try {
      const anomaly = await AnomalyService.getAnomalyById(anomalyId);
      if (!anomaly) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: `Anomaly ${anomalyId} not found` } });
        return;
      }

      const report = await CorrelationEngine.correlateAnomaly(anomaly);
      res.json({ data: report });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Correlation error';
      res.status(500).json({ error: { code: 'CORRELATION_ERROR', message: msg } });
    }
  }
);
