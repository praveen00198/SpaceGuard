import { IEvidence } from '../../shared/types';
import { IEvidenceRepository } from '../interfaces/IEvidenceRepository';

export class InMemoryEvidenceRepository implements IEvidenceRepository {
  private evidence = new Map<string, IEvidence>();
  private counters = new Map<string, number>();

  public async create(item: IEvidence): Promise<IEvidence> {
    const copy = { ...item };
    this.evidence.set(item.evidenceId, copy);
    return copy;
  }

  public async findById(evidenceId: string): Promise<IEvidence | null> {
    const ev = this.evidence.get(evidenceId);
    return ev ? { ...ev } : null;
  }

  public async findByIds(evidenceIds: string[]): Promise<IEvidence[]> {
    return evidenceIds
      .map(id => this.evidence.get(id))
      .filter((e): e is IEvidence => Boolean(e))
      .map(e => ({ ...e }));
  }

  public async findAll(limit = 100): Promise<IEvidence[]> {
    const list = Array.from(this.evidence.values());
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list.slice(0, limit).map(e => ({ ...e }));
  }

  public async getNextSequence(source: string): Promise<number> {
    const current = this.counters.get(source) || 0;
    const next = current + 1;
    this.counters.set(source, next);
    return next;
  }

  public clear(): void {
    this.evidence.clear();
    this.counters.clear();
  }
}
