import { ISatelliteRepository } from './interfaces/ISatelliteRepository';
import { ITelemetryRepository } from './interfaces/ITelemetryRepository';
import { IAnomalyRepository } from './interfaces/IAnomalyRepository';
import { IEvidenceRepository } from './interfaces/IEvidenceRepository';
import { IHealthRepository } from './interfaces/IHealthRepository';
import { IAIAssessmentRepository } from './interfaces/IAIAssessmentRepository';
import { IEnvironmentalEventRepository } from './interfaces/IEnvironmentalEventRepository';

import { MongoSatelliteRepository } from './mongo/MongoSatelliteRepository';
import { MongoTelemetryRepository } from './mongo/MongoTelemetryRepository';
import { MongoAnomalyRepository } from './mongo/MongoAnomalyRepository';
import { MongoEvidenceRepository } from './mongo/MongoEvidenceRepository';
import { MongoHealthRepository } from './mongo/MongoHealthRepository';
import { MongoAIAssessmentRepository } from './mongo/MongoAIAssessmentRepository';
import { MongoEnvironmentalEventRepository } from './mongo/MongoEnvironmentalEventRepository';

export * from './interfaces/ISatelliteRepository';
export * from './interfaces/ITelemetryRepository';
export * from './interfaces/IAnomalyRepository';
export * from './interfaces/IEvidenceRepository';
export * from './interfaces/IHealthRepository';
export * from './interfaces/IAIAssessmentRepository';
export * from './interfaces/IEnvironmentalEventRepository';

export * from './mongo/MongoSatelliteRepository';
export * from './mongo/MongoTelemetryRepository';
export * from './mongo/MongoAnomalyRepository';
export * from './mongo/MongoEvidenceRepository';
export * from './mongo/MongoHealthRepository';
export * from './mongo/MongoAIAssessmentRepository';
export * from './mongo/MongoEnvironmentalEventRepository';

export * from './inmemory/InMemorySatelliteRepository';
export * from './inmemory/InMemoryTelemetryRepository';
export * from './inmemory/InMemoryAnomalyRepository';
export * from './inmemory/InMemoryEvidenceRepository';
export * from './inmemory/InMemoryHealthRepository';
export * from './inmemory/InMemoryAIAssessmentRepository';
export * from './inmemory/InMemoryEnvironmentalEventRepository';

// Active repository instances
let satelliteRepo: ISatelliteRepository = new MongoSatelliteRepository();
let telemetryRepo: ITelemetryRepository = new MongoTelemetryRepository();
let anomalyRepo: IAnomalyRepository = new MongoAnomalyRepository();
let evidenceRepo: IEvidenceRepository = new MongoEvidenceRepository();
let healthRepo: IHealthRepository = new MongoHealthRepository();
let aiAssessmentRepo: IAIAssessmentRepository = new MongoAIAssessmentRepository();
let environmentalEventRepo: IEnvironmentalEventRepository = new MongoEnvironmentalEventRepository();

export function getSatelliteRepository(): ISatelliteRepository {
  return satelliteRepo;
}
export function setSatelliteRepository(repo: ISatelliteRepository): void {
  satelliteRepo = repo;
}

export function getTelemetryRepository(): ITelemetryRepository {
  return telemetryRepo;
}
export function setTelemetryRepository(repo: ITelemetryRepository): void {
  telemetryRepo = repo;
}

export function getAnomalyRepository(): IAnomalyRepository {
  return anomalyRepo;
}
export function setAnomalyRepository(repo: IAnomalyRepository): void {
  anomalyRepo = repo;
}

export function getEvidenceRepository(): IEvidenceRepository {
  return evidenceRepo;
}
export function setEvidenceRepository(repo: IEvidenceRepository): void {
  evidenceRepo = repo;
}

export function getHealthRepository(): IHealthRepository {
  return healthRepo;
}
export function setHealthRepository(repo: IHealthRepository): void {
  healthRepo = repo;
}

export function getAIAssessmentRepository(): IAIAssessmentRepository {
  return aiAssessmentRepo;
}
export function setAIAssessmentRepository(repo: IAIAssessmentRepository): void {
  aiAssessmentRepo = repo;
}

export function getEnvironmentalEventRepository(): IEnvironmentalEventRepository {
  return environmentalEventRepo;
}
export function setEnvironmentalEventRepository(repo: IEnvironmentalEventRepository): void {
  environmentalEventRepo = repo;
}

export function resetToMongoRepositories(): void {
  satelliteRepo = new MongoSatelliteRepository();
  telemetryRepo = new MongoTelemetryRepository();
  anomalyRepo = new MongoAnomalyRepository();
  evidenceRepo = new MongoEvidenceRepository();
  healthRepo = new MongoHealthRepository();
  aiAssessmentRepo = new MongoAIAssessmentRepository();
  environmentalEventRepo = new MongoEnvironmentalEventRepository();
}
