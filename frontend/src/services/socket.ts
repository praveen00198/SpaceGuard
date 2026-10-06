import { io, Socket } from 'socket.io-client';
import type { ITelemetryReading, IAnomaly } from '../types';

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export interface SimulationStatusPayload {
  isRunning: boolean;
  currentScenario: string;
  targetSatelliteId: string;
  ticksGenerated: number;
}

let socket: Socket | null = null;
let currentStatus: ConnectionStatus = 'disconnected';

const statusListeners = new Set<(status: ConnectionStatus) => void>();
const reconnectCallbacks = new Set<() => void>();

function updateStatus(newStatus: ConnectionStatus) {
  if (currentStatus !== newStatus) {
    currentStatus = newStatus;
    statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error('Error in connection status listener:', err);
      }
    });
  }
}

/**
 * Returns the configured WebSocket endpoint.
 * In development with Vite proxy, defaults to window.location.origin (which proxies /socket.io).
 * In split production, reads VITE_WS_URL.
 */
export function getWebSocketUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

/**
 * Initializes or returns the shared Socket.IO singleton instance.
 */
export function getSocket(): Socket {
  if (!socket) {
    const wsUrl = getWebSocketUrl();
    updateStatus('connecting');

    socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      updateStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      // If server disconnected or transport closed, status is disconnected/reconnecting
      if (reason === 'io client disconnect') {
        updateStatus('disconnected');
      } else {
        updateStatus('reconnecting');
      }
    });

    socket.on('connect_error', () => {
      if (currentStatus === 'connecting') {
        updateStatus('disconnected');
      } else {
        updateStatus('reconnecting');
      }
    });

    // Socket.IO Manager reconnection lifecycle events
    if (socket.io) {
      socket.io.on('reconnect_attempt', () => {
        updateStatus('reconnecting');
      });

      socket.io.on('reconnect', () => {
        updateStatus('connected');
        // Trigger all registered resynchronization callbacks
        reconnectCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            console.error('Error in onReconnect resync handler:', err);
          }
        });
      });

      socket.io.on('reconnect_error', () => {
        updateStatus('reconnecting');
      });

      socket.io.on('reconnect_failed', () => {
        updateStatus('disconnected');
      });
    }
  }

  return socket;
}

/**
 * Gets the current connection status.
 */
export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

/**
 * Registers a listener for connection status changes.
 * Immediately invokes the listener with the current status.
 * Returns an unsubscription function.
 */
export function onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void {
  statusListeners.add(listener);
  try {
    listener(currentStatus);
  } catch (err) {
    console.error('Error calling connection status listener initially:', err);
  }

  // Ensure socket is initialized to begin connection tracking
  getSocket();

  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Registers a callback to be triggered when Socket.IO successfully reconnects.
 * Used for state resynchronization after connection gaps.
 * Returns an unsubscription function.
 */
export function onReconnect(callback: () => void): () => void {
  reconnectCallbacks.add(callback);
  return () => {
    reconnectCallbacks.delete(callback);
  };
}

/**
 * Subscribes to live telemetry and anomaly alerts for a given satellite.
 * Returns an unsubscription cleanup function.
 */
export function subscribeToSatelliteTelemetry(
  satelliteId: string,
  onReading: (reading: ITelemetryReading) => void,
  onAnomaly?: (anomaly: IAnomaly) => void
): () => void {
  const s = getSocket();

  if (satelliteId) {
    s.emit('subscribe:telemetry', { satelliteId });
  }

  const readingHandler = (reading: ITelemetryReading) => {
    if (!satelliteId || reading.satelliteId === satelliteId) {
      onReading(reading);
    }
  };

  const anomalyHandler = (anomaly: IAnomaly) => {
    if (onAnomaly && (!satelliteId || anomaly.satelliteId === satelliteId)) {
      onAnomaly(anomaly);
    }
  };

  s.on('telemetry:reading', readingHandler);
  if (onAnomaly) {
    s.on('anomaly:detected', anomalyHandler);
  }

  return () => {
    if (satelliteId) {
      s.emit('unsubscribe:telemetry', { satelliteId });
    }
    s.off('telemetry:reading', readingHandler);
    if (onAnomaly) {
      s.off('anomaly:detected', anomalyHandler);
    }
  };
}

/**
 * Subscribes globally to all new anomaly detection events.
 * Returns an unsubscription cleanup function.
 */
export function subscribeToAnomalies(onAnomaly: (anomaly: IAnomaly) => void): () => void {
  const s = getSocket();

  const anomalyHandler = (anomaly: IAnomaly) => {
    onAnomaly(anomaly);
  };

  s.on('anomaly:detected', anomalyHandler);

  return () => {
    s.off('anomaly:detected', anomalyHandler);
  };
}

/**
 * Subscribes to real-time simulation status changes.
 * Returns an unsubscription cleanup function.
 */
export function subscribeToSimulationStatus(
  onStatus: (status: SimulationStatusPayload) => void
): () => void {
  const s = getSocket();

  const statusHandler = (status: SimulationStatusPayload) => {
    onStatus(status);
  };

  s.on('simulation:status', statusHandler);

  return () => {
    s.off('simulation:status', statusHandler);
  };
}

/**
 * Generates a stable unique identity string for a telemetry reading.
 * Used for deduplication between REST and WebSocket data.
 */
export function getTelemetryReadingKey(reading: ITelemetryReading): string {
  return `${reading.satelliteId}:${reading.parameter}:${reading.timestamp}`;
}
