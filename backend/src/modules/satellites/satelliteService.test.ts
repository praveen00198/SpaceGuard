import { SatelliteService } from './satelliteService';
import { InMemorySatelliteRepository } from '../../repositories/inmemory/InMemorySatelliteRepository';

describe('SatelliteService', () => {
  beforeEach(() => {
    SatelliteService.setRepository(new InMemorySatelliteRepository());
  });

  it('should initialize with seed satellites', async () => {
    const satellites = await SatelliteService.getAllSatellites();
    expect(satellites.length).toBeGreaterThanOrEqual(3);
    const sg1 = await SatelliteService.getSatelliteById('SG-1');
    expect(sg1).toBeDefined();
    expect(sg1?.name).toContain('AURA-1');
  });

  it('should create and retrieve a new satellite', async () => {
    const newSat = await SatelliteService.createSatellite({
      satelliteId: 'TEST-SAT-1',
      name: 'Test Orbital Probe',
      type: 'cubesat',
      status: 'active',
      dataSource: 'simulator',
    });

    expect(newSat.satelliteId).toBe('TEST-SAT-1');
    const fetched = await SatelliteService.getSatelliteById('TEST-SAT-1');
    expect(fetched?.name).toBe('Test Orbital Probe');
  });
});
