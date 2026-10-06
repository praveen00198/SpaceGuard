import { useState, useEffect } from 'react';
import { getConnectionStatus, onConnectionStatusChange, type ConnectionStatus } from '../services/socket';

export function useRealtimeStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());

  useEffect(() => {
    return onConnectionStatusChange((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  return status;
}
