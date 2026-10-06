import { ISatellite } from '../../shared/types';
import { CreateSatelliteInput } from './schemas';
import { ISatelliteRepository } from '../../repositories/interfaces/ISatelliteRepository';
import { getSatelliteRepository } from '../../repositories';
import { SEED_SATELLITES } from '../../config/seed';
import { logger } from '../../shared/logger';

export class SatelliteService {
  private static repository: ISatelliteRepository | null = null;
  // Local cache for fast synchronous reads when needed
  private static memoryCache = new Map<string, ISatellite>();

  private static getRepo(): ISatelliteRepository {
    return this.repository || getSatelliteRepository();
  }

  public static setRepository(repo: ISatelliteRepository): void {
    this.repository = repo;
    this.memoryCache.clear();
  }

  /**
   * Initializes local cache from seed or repo if needed.
   */
  private static async ensureInitialized(): Promise<void> {
    if (this.memoryCache.size === 0) {
      try {
        const repo = this.getRepo();
        const list = await repo.findAll();
        if (list.length > 0) {
          for (const s of list) {
            this.memoryCache.set(s.satelliteId, s);
          }
        } else {
          // Initialize with seed satellites
          for (const sat of SEED_SATELLITES) {
            try {
              const created = await repo.create(sat);
              this.memoryCache.set(created.satelliteId, created);
            } catch {
              this.memoryCache.set(sat.satelliteId, sat);
            }
          }
        }
      } catch {
        // Fallback to in-memory seeds if database query fails
        for (const sat of SEED_SATELLITES) {
          this.memoryCache.set(sat.satelliteId, sat);
        }
      }
    }
  }

  public static async getAllSatellites(): Promise<ISatellite[]> {
    await this.ensureInitialized();
    try {
      const list = await this.getRepo().findAll();
      if (list.length > 0) {
        this.memoryCache.clear();
        for (const s of list) {
          this.memoryCache.set(s.satelliteId, s);
        }
        return list;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to fetch satellites from repository, falling back to cache', { error: message });
    }
    return Array.from(this.memoryCache.values());
  }

  public static async getSatelliteById(id: string): Promise<ISatellite | null> {
    await this.ensureInitialized();
    try {
      const found = await this.getRepo().findById(id);
      if (found) {
        this.memoryCache.set(found.satelliteId, found);
        return found;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Failed to fetch satellite ${id} from repository, falling back to cache`, { error: message });
    }
    return this.memoryCache.get(id) || null;
  }

  public static async createSatellite(input: CreateSatelliteInput): Promise<ISatellite> {
    await this.ensureInitialized();
    const existing = await this.getSatelliteById(input.satelliteId);
    if (existing) {
      throw new Error(`Satellite with ID ${input.satelliteId} already exists`);
    }

    const now = new Date();
    const satellite: ISatellite = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.getRepo().create(satellite);
    this.memoryCache.set(created.satelliteId, created);
    logger.info('Satellite created', { satelliteId: created.satelliteId, name: created.name });
    return created;
  }

  public static async updateSatellite(id: string, updates: Partial<CreateSatelliteInput>): Promise<ISatellite | null> {
    await this.ensureInitialized();
    const updated = await this.getRepo().update(id, updates);
    if (updated) {
      this.memoryCache.set(id, updated);
      return updated;
    }
    return null;
  }

  public static async deleteSatellite(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const deleted = await this.getRepo().delete(id);
    if (deleted) {
      this.memoryCache.delete(id);
    }
    return deleted;
  }

  public static clearCache(): void {
    this.memoryCache.clear();
  }
}
