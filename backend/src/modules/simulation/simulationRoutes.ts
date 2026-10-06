import { Router, Request, Response } from 'express';
import { SimulationService } from './simulationService';
import { SatelliteIdSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { simulationLimiter } from '../../middleware/rateLimiter';
import { z } from 'zod';

export const simulationRouter = Router();

const StartSimulationSchema = z.object({
  scenarioId: z.enum(
    [
      'normal',
      'thermal-spike',
      'thermal-drift',
      'battery-degradation',
      'sensor-dropout',
      'comm-degradation',
      'multi-anomaly',
    ],
    {
      errorMap: () => ({
        message:
          'Unknown scenarioId. Allowed: normal, thermal-spike, thermal-drift, battery-degradation, sensor-dropout, comm-degradation, multi-anomaly',
      }),
    }
  ),
  satelliteId: SatelliteIdSchema.default('SG-1'),
  intervalMs: z.coerce.number().int().min(200, 'Interval must be at least 200ms').max(60000, 'Interval cannot exceed 60000ms').default(1000),
});

simulationRouter.get('/scenarios', (_req: Request, res: Response) => {
  res.json({ scenarios: SimulationService.getScenarios() });
});

simulationRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ status: SimulationService.getStatus() });
});

simulationRouter.post(
  '/start',
  simulationLimiter,
  validateRequest(StartSimulationSchema, 'body'),
  (req: Request, res: Response) => {
    const { scenarioId, satelliteId, intervalMs } = req.body;

    try {
      SimulationService.start(scenarioId, satelliteId, intervalMs);
      res.json({
        message: `Simulation started for scenario '${scenarioId}'`,
        status: SimulationService.getStatus(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start simulation';
      res.status(400).json({ error: { code: 'SIMULATION_ERROR', message } });
    }
  }
);

simulationRouter.post(
  '/stop',
  simulationLimiter,
  (_req: Request, res: Response) => {
    SimulationService.stop();
    res.json({ message: 'Simulation stopped', status: SimulationService.getStatus() });
  }
);
