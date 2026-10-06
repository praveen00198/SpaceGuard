import { Router, Request, Response } from 'express';
import { EvidenceService } from './evidenceService';
import { EvidenceIdSchema, PaginationLimitSchema } from '../../shared/validationSchemas';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

export const evidenceRouter = Router();

const EvidenceQuerySchema = z.object({
  limit: PaginationLimitSchema,
});

const EvidenceParamsSchema = z.object({
  id: EvidenceIdSchema,
});

evidenceRouter.get(
  '/',
  validateRequest(EvidenceQuerySchema, 'query'),
  async (req: Request, res: Response) => {
    const { limit } = req.query as any;
    const list = await EvidenceService.getAllEvidence(limit);
    res.json({ data: list, total: list.length });
  }
);

evidenceRouter.get(
  '/:id',
  validateRequest(EvidenceParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const ev = await EvidenceService.getEvidenceById(id);
    if (!ev) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Evidence ${id} not found` } });
      return;
    }
    res.json({ data: ev });
  }
);
