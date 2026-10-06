import { ISatellite } from '../../shared/types';
import { ISatelliteRepository } from '../interfaces/ISatelliteRepository';

export class InMemorySatelliteRepository implements ISatelliteRepository {
  private satellites = new Map<string, ISatellite>();

  constructor(initialSatellites?: ISatellite[]) {
    if (initialSatellites) {
      for (const sat of initialSatellites) {
        this.satellites.set(sat.satelliteId, { ...sat });
      }
    }
  }

  public async findAll(): Promise<ISatellite[]> {
    return Array.from(this.satellites.values());
  }

  public async findById(satelliteId: string): Promise<ISatellite | null> {
    const sat = this.satellites.get(satelliteId);
    return sat ? { ...sat } : null;
  }

  public async create(satellite: ISatellite): Promise<ISatellite> {
    if (this.satellites.has(satellite.satelliteId)) {
      throw new Error(`Satellite with ID ${satellite.satelliteId} already exists`);
    }
    const copy = { ...satellite };
    this.satellites.set(satellite.satelliteId, copy);
    return copy;
  }

  public async update(satelliteId: string, updates: Partial<ISatellite>): Promise<ISatellite | null> {
    const existing = this.satellites.get(satelliteId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.satellites.set(satelliteId, updated);
    return updated;
  }

  public async delete(satelliteId: string): Promise<boolean> {
    return this.satellites.delete(satelliteId);
  }

  public async count(): Promise<number> {
    return this.satellites.size;
  }

  public clear(): void {
    this.satellites.clear();
  }
}
