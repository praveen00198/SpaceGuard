import { Router, Request, Response } from 'express';
import { SpaceWeatherService } from './spaceWeatherService';
import { DonkiService } from './donkiService';
import { externalRefreshLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const spaceWeatherRouter = Router();

const DonkiEventsQuerySchema = z.object({
  type: z.enum(['FLR', 'CME', 'GST', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

spaceWeatherRouter.get('/current', async (_req: Request, res: Response) => {
  const data = await SpaceWeatherService.getSpaceWeather();
  res.json({ data });
});

spaceWeatherRouter.get(
  '/events',
  externalRefreshLimiter,
  validateRequest(DonkiEventsQuerySchema, 'query'),
  async (req: Request, res: Response) => {
    const { type, limit } = req.query as any;
    const events = await DonkiService.fetchEvents({
      type,
      limit,
    });
    res.json({ data: events });
  }
);
