import { ITelemetryReading, TelemetrySubsystem, DataQuality, TelemetrySource } from '../../shared/types';
import { TelemetryReadingInput } from './schemas';

export class TelemetryNormalizer {
  private static PARAMETER_SUBSYSTEM_MAP: Record<string, TelemetrySubsystem> = {
    battery_voltage: 'power',
    battery_current: 'power',
    solar_panel_voltage: 'power',
    power_consumption: 'power',
    temperature: 'thermal',
    thermal_gradient: 'thermal',
    signal_strength: 'communication',
    packet_loss_rate: 'communication',
    link_latency: 'communication',
    roll: 'attitude',
    pitch: 'attitude',
    yaw: 'attitude',
  };

  private static PARAMETER_UNIT_MAP: Record<string, string> = {
    battery_voltage: 'V',
    battery_current: 'A',
    solar_panel_voltage: 'V',
    power_consumption: 'W',
    temperature: 'C',
    thermal_gradient: 'C/min',
    signal_strength: 'dBm',
    packet_loss_rate: '%',
    link_latency: 'ms',
    roll: 'deg',
    pitch: 'deg',
    yaw: 'deg',
  };

  public static normalize(raw: Partial<TelemetryReadingInput> & { satelliteId: string; parameter: string; value: number }): ITelemetryReading {
    const subsystem: TelemetrySubsystem =
      raw.subsystem ||
      this.PARAMETER_SUBSYSTEM_MAP[raw.parameter] ||
      'payload';

    const unit = raw.unit || this.PARAMETER_UNIT_MAP[raw.parameter] || 'raw';
    const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date();
    const source: TelemetrySource = raw.source || 'simulator';
    const quality: DataQuality = raw.quality || (isNaN(raw.value) ? 'missing' : 'valid');

    return {
      satelliteId: raw.satelliteId,
      parameter: raw.parameter,
      timestamp,
      value: Number(raw.value),
      unit,
      subsystem,
      source,
      sourceRecordId: raw.sourceRecordId,
      sensorId: raw.sensorId,
      quality,
      ingestedAt: new Date(),
    };
  }
}
