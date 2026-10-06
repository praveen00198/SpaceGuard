import { ISatellite } from '../../shared/types';

export interface ISatelliteRepository {
  findAll(): Promise<ISatellite[]>;
  findById(satelliteId: string): Promise<ISatellite | null>;
  create(satellite: ISatellite): Promise<ISatellite>;
  update(satelliteId: string, updates: Partial<ISatellite>): Promise<ISatellite | null>;
  delete(satelliteId: string): Promise<boolean>;
  count(): Promise<number>;
}
