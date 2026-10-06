import { IEvidence, EvidenceSource } from '../../shared/types';
import { IEvidenceRepository } from '../../repositories/interfaces/IEvidenceRepository';
import { getEvidenceRepository } from '../../repositories';
import { logger } from '../../shared/logger';

// In-memory cache of evidence items for fast access
const evidenceCache = new Map<string, IEvidence>();
let localCounter = 1;

export class EvidenceService {
  private static repository: IEvidenceRepository | null = null;

  private static getRepo(): IEvidenceRepository {
    return this.repository || getEvidenceRepository();
  }

  public static setRepository(repo: IEvidenceRepository): void {
    this.repository = repo;
    evidenceCache.clear();
  }

  public static async createEvidence(params: {
    source: EvidenceSource;
    sourceId: string;
    timestamp: Date;
    description: string;
    parameter?: string;
    value?: number;
    baseline?: number;
    unit?: string;
  }): Promise<IEvidence> {
    const repo = this.getRepo();
    let seq = localCounter++;
    try {
      seq = await repo.getNextSequence(params.source);
    } catch {
      // Fallback to local counter if repository fails
    }

    const prefix = params.source.toUpperCase().slice(0, 3);
    const evidenceId = `EVID-${prefix}-${String(seq).padStart(5, '0')}`;
    const now = new Date();

    const evidence: IEvidence = {
      evidenceId,
      source: params.source,
      sourceId: params.sourceId,
      timestamp: params.timestamp,
      parameter: params.parameter,
      value: params.value,
      baseline: params.baseline,
      unit: params.unit,
      description: params.description,
      createdAt: now,
    };

    evidenceCache.set(evidenceId, evidence);

    // Persist to repository
    try {
      await repo.create(evidence);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown write error';
      logger.warn('Failed to persist evidence to database, kept in memory cache', {
        evidenceId,
        error: message,
      });
    }

    logger.debug('Evidence created', { evidenceId, source: params.source });
    return evidence;
  }

  public static async getEvidenceById(evidenceId: string): Promise<IEvidence | null> {
    const cached = evidenceCache.get(evidenceId);
    if (cached) return cached;

    try {
      const found = await this.getRepo().findById(evidenceId);
      if (found) {
        evidenceCache.set(found.evidenceId, found);
        return found;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Failed to fetch evidence ${evidenceId} from repository`, { error: message });
    }
    return null;
  }

  public static async getEvidenceForIds(ids: string[]): Promise<IEvidence[]> {
    if (ids.length === 0) return [];

    const results: IEvidence[] = [];
    const missingIds: string[] = [];

    for (const id of ids) {
      const cached = evidenceCache.get(id);
      if (cached) {
        results.push(cached);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      try {
        const fromDb = await this.getRepo().findByIds(missingIds);
        for (const item of fromDb) {
          evidenceCache.set(item.evidenceId, item);
          results.push(item);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('Failed to fetch evidence items from repository', { error: message });
      }
    }

    return results;
  }

  public static async getAllEvidence(limit = 100): Promise<IEvidence[]> {
    try {
      const fromDb = await this.getRepo().findAll(limit);
      if (fromDb.length > 0) {
        for (const item of fromDb) {
          evidenceCache.set(item.evidenceId, item);
        }
        return fromDb;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to fetch all evidence from repository, falling back to cache', { error: message });
    }
    return Array.from(evidenceCache.values()).slice(-limit).reverse();
  }

  public static clearCache(): void {
    evidenceCache.clear();
  }

  public static clearAll(): void {
    evidenceCache.clear();
    localCounter = 1;
  }
}
