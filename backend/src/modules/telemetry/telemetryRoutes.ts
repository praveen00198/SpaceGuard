import { Router, Request, Response } from 'express';
import { TelemetryService } from './telemetryService';
import {
  TelemetryReadingInputSchema,
  BatchTelemetryInputSchema,
  TelemetryQuerySchema,
} from './schemas';
import { SatelliteIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const telemetryRouter = Router();

const TelemetryParamsSchema = z.object({
  satelliteId: SatelliteIdSchema,
});

telemetryRouter.get(
  '/',
  validateRequest(TelemetryQuerySchema, 'query'),
  async (req: Request, res: Response) => {
    const query = req.query as any;
    const readings = await TelemetryService.getHistory(query);
    res.json({
      data: readings,
      total: readings.length,
    });
  }
);

telemetryRouter.get(
  '/latest/:satelliteId',
  validateRequest(TelemetryParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const satelliteId = String(req.params.satelliteId);
    const readings = await TelemetryService.getLatestReadings(satelliteId);
    res.json({ data: readings, total: readings.length });
  }
);

telemetryRouter.get(
  '/stats/:satelliteId',
  validateRequest(TelemetryParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const satelliteId = String(req.params.satelliteId);
    const stats = await TelemetryService.getStats(satelliteId);
    res.json({ data: stats });
  }
);

telemetryRouter.post(
  '/ingest',
  validateRequest(TelemetryReadingInputSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const result = await TelemetryService.ingestReading(req.body);
      res.status(201).json({
        data: result.reading,
        anomalyDetected: Boolean(result.anomaly),
        anomaly: result.anomaly,
      });
    } catch {
      res.status(500).json({ error: { code: 'INGESTION_ERROR', message: 'Failed to ingest telemetry reading' } });
    }
  }
);

telemetryRouter.post(
  '/ingest/batch',
  validateRequest(BatchTelemetryInputSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const result = await TelemetryService.ingestBatch(req.body.readings);
      res.status(201).json({ data: result });
    } catch {
      res.status(500).json({ error: { code: 'INGESTION_ERROR', message: 'Failed to process batch telemetry' } });
    }
  }
);
