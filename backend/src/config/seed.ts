import { ISatellite } from '../shared/types';
import { ISatelliteRepository } from '../repositories/interfaces/ISatelliteRepository';
import { getSatelliteRepository } from '../repositories';
import { logger } from '../shared/logger';

export const SEED_SATELLITES: ISatellite[] = [
  {
    satelliteId: 'SG-1',
    name: 'AURA-1 (LEO Climate Monitor)',
    noradId: 44321,
    intlDesignator: '2022-045A',
    type: 'smallsat',
    operator: 'SpaceGuard Ops',
    mission: 'Atmospheric Earth Observation',
    status: 'active',
    launchDate: new Date('2022-04-12T00:00:00Z'),
    dataSource: 'simulator',
    createdAt: new Date('2022-04-12T00:00:00Z'),
    updatedAt: new Date(),
  },
  {
    satelliteId: 'SG-2',
    name: 'ORION-3 (Solar Activity Sentinel)',
    noradId: 48992,
    intlDesignator: '2023-012B',
    type: 'cubesat',
    operator: 'SpaceGuard Helio',
    mission: 'Magnetospheric & Solar Telemetry',
    status: 'active',
    launchDate: new Date('2023-02-18T00:00:00Z'),
    dataSource: 'simulator',
    createdAt: new Date('2023-02-18T00:00:00Z'),
    updatedAt: new Date(),
  },
  {
    satelliteId: 'SG-3',
    name: 'PULSAR-X (Deep Space Relay)',
    noradId: 51203,
    intlDesignator: '2024-001C',
    type: 'medium',
    operator: 'Interstellar Network',
    mission: 'High-bandwidth Optical Comms',
    status: 'active',
    launchDate: new Date('2024-01-05T00:00:00Z'),
    dataSource: 'simulator',
    createdAt: new Date('2024-01-05T00:00:00Z'),
    updatedAt: new Date(),
  },
];

export async function seedSatellites(
  repo?: ISatelliteRepository
): Promise<{ seeded: number; existing: number; total: number }> {
  const satelliteRepo = repo || getSatelliteRepository();
  let seeded = 0;
  let existing = 0;

  for (const sat of SEED_SATELLITES) {
    try {
      const found = await satelliteRepo.findById(sat.satelliteId);
      if (!found) {
        await satelliteRepo.create({ ...sat, createdAt: new Date(), updatedAt: new Date() });
        seeded++;
        logger.info(`Seeded satellite: ${sat.satelliteId} (${sat.name})`);
      } else {
        existing++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error during seeding';
      logger.error(`Error checking/seeding satellite ${sat.satelliteId}`, { error: message });
    }
  }

  const total = await satelliteRepo.count();
  logger.info('Satellite seeding complete', { seeded, existing, total });
  return { seeded, existing, total };
}
