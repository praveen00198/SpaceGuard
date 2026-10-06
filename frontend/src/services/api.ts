import type {
  ISatellite,
  ITelemetryReading,
  IAnomaly,
  IHealthSnapshot,
  IAIAssessment,
  IEvidence,
  SpaceWeatherStatus,
  SimulationScenarioConfig,
  OrbitalContext,
  CorrelationReport,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  : '';

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const api = {
  // System Health
  async getSystemHealth(): Promise<{
    status: string;
    service: string;
    version: string;
    database: string;
    timestamp: string;
    uptime: number;
  }> {
    const res = await fetch(apiUrl('/api/system/health'));
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  // Satellites
  async getSatellites(): Promise<ISatellite[]> {
    const res = await fetch(apiUrl('/api/satellites'));
    if (!res.ok) throw new Error('Failed to fetch satellites');
    const json = await res.json();
    return json.data || [];
  },

  async getSatellite(id: string): Promise<ISatellite> {
    const res = await fetch(apiUrl(`/api/satellites/${id}`));
    if (!res.ok) throw new Error(`Failed to fetch satellite ${id}`);
    const json = await res.json();
    return json.data;
  },

  // Health
  async getFleetHealth(): Promise<IHealthSnapshot[]> {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) throw new Error('Failed to fetch fleet health');
    const json = await res.json();
    return json.data || [];
  },

  async getSatelliteHealth(id: string): Promise<IHealthSnapshot> {
    const res = await fetch(apiUrl(`/api/health/${id}`));
    if (!res.ok) throw new Error(`Failed to fetch health for ${id}`);
    const json = await res.json();
    return json.data;
  },

  // Telemetry
  async getLatestTelemetry(satelliteId: string): Promise<ITelemetryReading[]> {
    const res = await fetch(apiUrl(`/api/telemetry/latest/${satelliteId}`));
    if (!res.ok) throw new Error('Failed to fetch latest telemetry');
    const json = await res.json();
    return json.data || [];
  },

  async getTelemetryHistory(params: {
    satelliteId?: string;
    parameter?: string;
    subsystem?: string;
    limit?: number;
  }): Promise<ITelemetryReading[]> {
    const query = new URLSearchParams();
    if (params.satelliteId) query.set('satelliteId', params.satelliteId);
    if (params.parameter) query.set('parameter', params.parameter);
    if (params.subsystem) query.set('subsystem', params.subsystem);
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetch(apiUrl(`/api/telemetry?${query.toString()}`));
    if (!res.ok) throw new Error('Failed to fetch telemetry history');
    const json = await res.json();
    return json.data || [];
  },

  // Anomalies
  async getAnomalies(filter?: {
    satelliteId?: string;
    severity?: string;
    status?: string;
    limit?: number;
  }): Promise<IAnomaly[]> {
    const query = new URLSearchParams();
    if (filter?.satelliteId) query.set('satelliteId', filter.satelliteId);
    if (filter?.severity) query.set('severity', filter.severity);
    if (filter?.status) query.set('status', filter.status);
    if (filter?.limit) query.set('limit', String(filter.limit));

    const res = await fetch(apiUrl(`/api/anomalies?${query.toString()}`));
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    const json = await res.json();
    return json.data || [];
  },

  async getAnomaly(id: string): Promise<IAnomaly> {
    const res = await fetch(apiUrl(`/api/anomalies/${id}`));
    if (!res.ok) throw new Error(`Failed to fetch anomaly ${id}`);
    const json = await res.json();
    return json.data;
  },

  async updateAnomalyStatus(id: string, status: string): Promise<IAnomaly> {
    const res = await fetch(apiUrl(`/api/anomalies/${id}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update anomaly status');
    const json = await res.json();
    return json.data;
  },

  // Evidence
  async getEvidence(id: string): Promise<IEvidence> {
    const res = await fetch(apiUrl(`/api/evidence/${id}`));
    if (!res.ok) throw new Error(`Failed to fetch evidence ${id}`);
    const json = await res.json();
    return json.data;
  },

  // AI Assessments
  async getAssessment(anomalyId: string): Promise<IAIAssessment | null> {
    const res = await fetch(apiUrl(`/api/assessments/anomaly/${anomalyId}`));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch AI assessment');
    const json = await res.json();
    return json.data;
  },

  async generateAssessment(anomalyId: string): Promise<IAIAssessment> {
    const res = await fetch(apiUrl(`/api/assessments/generate/${anomalyId}`), {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to generate AI assessment');
    const json = await res.json();
    return json.data;
  },

  // Space Weather
  async getSpaceWeather(): Promise<SpaceWeatherStatus> {
    const res = await fetch(apiUrl('/api/space-weather/current'));
    if (!res.ok) throw new Error('Failed to fetch space weather');
    const json = await res.json();
    return json.data;
  },

  // Orbital Context
  async getOrbitalContext(satelliteId: string): Promise<OrbitalContext> {
    const res = await fetch(apiUrl(`/api/orbital/context/${satelliteId}`));
    if (!res.ok) throw new Error('Failed to fetch orbital context');
    const json = await res.json();
    return json.data;
  },

  // Anomaly Correlation
  async getCorrelationReport(anomalyId: string): Promise<CorrelationReport> {
    const res = await fetch(apiUrl(`/api/correlation/anomaly/${anomalyId}`));
    if (!res.ok) throw new Error('Failed to fetch correlation report');
    const json = await res.json();
    return json.data;
  },

  // Simulation
  async getSimulationScenarios(): Promise<SimulationScenarioConfig[]> {
    const res = await fetch(apiUrl('/api/simulation/scenarios'));
    if (!res.ok) throw new Error('Failed to fetch simulation scenarios');
    const json = await res.json();
    return json.scenarios || [];
  },

  async getSimulationStatus(): Promise<{
    isRunning: boolean;
    currentScenario: string;
    targetSatelliteId: string;
    ticksGenerated: number;
  }> {
    const res = await fetch(apiUrl('/api/simulation/status'));
    if (!res.ok) throw new Error('Failed to fetch simulation status');
    const json = await res.json();
    return json.status;
  },

  async startSimulation(scenarioId: string, satelliteId?: string): Promise<{
    message: string;
    status: {
      isRunning: boolean;
      currentScenario: string;
      targetSatelliteId: string;
      ticksGenerated: number;
    };
  }> {
    const res = await fetch(apiUrl('/api/simulation/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId, satelliteId }),
    });
    if (!res.ok) throw new Error('Failed to start simulation');
    return res.json();
  },

  async stopSimulation(): Promise<{
    message: string;
    status: {
      isRunning: boolean;
      currentScenario: string;
      targetSatelliteId: string;
      ticksGenerated: number;
    };
  }> {
    const res = await fetch(apiUrl('/api/simulation/stop'), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to stop simulation');
    return res.json();
  },
};
