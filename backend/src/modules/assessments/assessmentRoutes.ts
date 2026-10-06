import { Router, Request, Response } from 'express';
import { GeminiService } from './geminiService';
import { AnomalyService } from '../anomalies/anomalyService';
import { AnomalyIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { expensiveAiLimiter } from '../../middleware/rateLimiter';
import { z } from 'zod';

export const assessmentRouter = Router();

const AssessmentParamsSchema = z.object({
  anomalyId: AnomalyIdSchema,
});

assessmentRouter.get(
  '/anomaly/:anomalyId',
  validateRequest(AssessmentParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const anomalyId = String(req.params.anomalyId);
    const assessment = await GeminiService.getAssessmentForAnomaly(anomalyId);
    if (!assessment) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `No assessment generated yet for anomaly ${anomalyId}` } });
      return;
    }
    res.json({ data: assessment });
  }
);

assessmentRouter.post(
  '/generate/:anomalyId',
  expensiveAiLimiter,
  validateRequest(AssessmentParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const anomalyId = String(req.params.anomalyId);
    const anomaly = await AnomalyService.getAnomalyById(anomalyId);
    if (!anomaly) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Anomaly ${anomalyId} not found` } });
      return;
    }

    try {
      const assessment = await GeminiService.assessAnomaly(anomaly);
      res.json({ data: assessment });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate assessment';
      res.status(500).json({ error: { code: 'ASSESSMENT_ERROR', message } });
    }
  }
);
