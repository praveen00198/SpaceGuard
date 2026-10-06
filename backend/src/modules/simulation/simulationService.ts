import { TelemetryService } from '../telemetry/telemetryService';
import { TelemetrySubsystem } from '../../shared/types';
import { logger } from '../../shared/logger';

export interface SimulationScenarioConfig {
  id: string;
  name: string;
  description: string;
  targetSubsystem: TelemetrySubsystem;
  targetParameter: string;
}

export const SIMULATION_SCENARIOS: SimulationScenarioConfig[] = [
  {
    id: 'normal',
    name: 'Normal Operation',
    description: 'Nominal telemetry operating within normal bounds across all subsystems',
    targetSubsystem: 'power',
    targetParameter: 'battery_voltage',
  },
  {
    id: 'thermal-spike',
    name: 'Thermal Spike',
    description: 'Sudden, acute temperature spike on internal electronics bus exceeding critical limits',
    targetSubsystem: 'thermal',
    targetParameter: 'temperature',
  },
  {
    id: 'thermal-drift',
    name: 'Thermal Drift',
    description: 'Slow continuous temperature increase indicating cooling system degradation',
    targetSubsystem: 'thermal',
    targetParameter: 'temperature',
  },
  {
    id: 'battery-degradation',
    name: 'Battery Degradation',
    description: 'Critical drop in battery bus voltage under payload load',
    targetSubsystem: 'power',
    targetParameter: 'battery_voltage',
  },
  {
    id: 'sensor-dropout',
    name: 'Sensor Dropout / Flatline',
    description: 'Attitude rate sensor freezes and reports repeated identical sticky values',
    targetSubsystem: 'attitude',
    targetParameter: 'roll',
  },
  {
    id: 'comm-degradation',
    name: 'Communication Degradation',
    description: 'Elevated packet loss and severe link latency degrading downlink throughput',
    targetSubsystem: 'communication',
    targetParameter: 'packet_loss_rate',
  },
  {
    id: 'multi-anomaly',
    name: 'Compound Thermal & Power Fault',
    description: 'Concurrent thermal overheating coupled with severe battery voltage drop',
    targetSubsystem: 'power',
    targetParameter: 'power_consumption',
  },
];

export class SimulationService {
  private static isRunning: boolean = false;
  private static currentScenario: string = 'normal';
  private static targetSatelliteId: string = 'SG-1';
  private static timer: NodeJS.Timeout | null = null;
  private static tickCount: number = 0;

  private static statusListeners: Array<(status: { isRunning: boolean; currentScenario: string; targetSatelliteId: string; ticksGenerated: number }) => void> = [];

  public static onStatusChange(listener: (status: { isRunning: boolean; currentScenario: string; targetSatelliteId: string; ticksGenerated: number }) => void): void {
    this.statusListeners.push(listener);
  }

  private static notifyStatusChange(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Error notifying simulation status listener', { error: message });
      }
    }
  }

  public static getStatus() {
    return {
      isRunning: this.isRunning,
      currentScenario: this.currentScenario,
      targetSatelliteId: this.targetSatelliteId,
      ticksGenerated: this.tickCount,
    };
  }

  public static getScenarios(): SimulationScenarioConfig[] {
    return SIMULATION_SCENARIOS;
  }

  public static start(scenarioId: string, satelliteId: string = 'SG-1', intervalMs: number = 1000): boolean {
    if (this.isRunning) {
      this.stop();
    }

    const scenario = SIMULATION_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    this.isRunning = true;
    this.currentScenario = scenarioId;
    this.targetSatelliteId = satelliteId;
    this.tickCount = 0;

    logger.info('Simulation started', { scenarioId, satelliteId, intervalMs });
    this.notifyStatusChange();

    this.timer = setInterval(async () => {
      this.tickCount++;
      await this.generateTick();
    }, intervalMs);

    return true;
  }

  public static stop(): boolean {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('Simulation stopped', { ticksGenerated: this.tickCount });
    this.notifyStatusChange();
    return true;
  }

  private static async generateTick(): Promise<void> {
    const t = this.tickCount;
    const now = new Date();
    const satId = this.targetSatelliteId;
    const scenario = this.currentScenario;

    // Helper for gaussian-like noise
    const noise = (std: number) => (Math.random() - 0.5) * 2 * std;

    // Base values
    let temp = 22.0 + noise(0.4);
    let battVolt = 3.7 + noise(0.02);
    let battCurr = 1.2 + noise(0.05);
    let solVolt = 14.5 + noise(0.2);
    let power = 25.0 + noise(0.8);
    let sigStr = -75.0 + noise(1.5);
    let pktLoss = 0.5 + Math.abs(noise(0.3));
    let latency = 250.0 + noise(15.0);
    let roll = noise(0.1);
    let pitch = noise(0.1);
    let yaw = noise(0.1);

    // Apply scenario faults after tick 3
    if (t >= 3) {
      const faultAge = t - 3;

      if (scenario === 'thermal-spike') {
        // Sudden spike up to 58 C
        temp = 22.0 + Math.min(38.0, faultAge * 12.0) + noise(0.5);
      } else if (scenario === 'thermal-drift') {
        // Gradual increase 0.8 C per tick up to 48 C
        temp = 22.0 + Math.min(26.0, faultAge * 0.8) + noise(0.3);
      } else if (scenario === 'battery-degradation') {
        // Battery voltage drops from 3.7 to 2.85V
        battVolt = Math.max(2.85, 3.7 - faultAge * 0.15) + noise(0.01);
        battCurr = 3.8 + noise(0.1); // drawing excess current
      } else if (scenario === 'sensor-dropout') {
        // Sticky flatline
        roll = 15.42; // constant exact value
      } else if (scenario === 'comm-degradation') {
        pktLoss = Math.min(25.0, 0.5 + faultAge * 4.0) + noise(0.5);
        latency = 250.0 + faultAge * 200.0;
        sigStr = Math.max(-118.0, -75.0 - faultAge * 7.0);
      } else if (scenario === 'multi-anomaly') {
        temp = 22.0 + Math.min(35.0, faultAge * 8.0);
        battVolt = Math.max(2.9, 3.7 - faultAge * 0.12);
        power = 75.0 + noise(2.0);
      }
    }

    // Ingest telemetry readings
    const readings = [
      { satelliteId: satId, parameter: 'temperature', value: temp, unit: 'C', subsystem: 'thermal' as const },
      { satelliteId: satId, parameter: 'battery_voltage', value: battVolt, unit: 'V', subsystem: 'power' as const },
      { satelliteId: satId, parameter: 'battery_current', value: battCurr, unit: 'A', subsystem: 'power' as const },
      { satelliteId: satId, parameter: 'solar_panel_voltage', value: solVolt, unit: 'V', subsystem: 'power' as const },
      { satelliteId: satId, parameter: 'power_consumption', value: power, unit: 'W', subsystem: 'power' as const },
      { satelliteId: satId, parameter: 'signal_strength', value: sigStr, unit: 'dBm', subsystem: 'communication' as const },
      { satelliteId: satId, parameter: 'packet_loss_rate', value: pktLoss, unit: '%', subsystem: 'communication' as const },
      { satelliteId: satId, parameter: 'link_latency', value: latency, unit: 'ms', subsystem: 'communication' as const },
      { satelliteId: satId, parameter: 'roll', value: roll, unit: 'deg', subsystem: 'attitude' as const },
      { satelliteId: satId, parameter: 'pitch', value: pitch, unit: 'deg', subsystem: 'attitude' as const },
      { satelliteId: satId, parameter: 'yaw', value: yaw, unit: 'deg', subsystem: 'attitude' as const },
    ];

    for (const r of readings) {
      await TelemetryService.ingestReading({
        ...r,
        timestamp: now,
        source: 'simulator',
        quality: 'valid',
      });
    }
  }
}
