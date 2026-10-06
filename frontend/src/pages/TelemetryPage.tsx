import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ISatellite, ITelemetryReading } from '../types';
import { api } from '../services/api';
import { subscribeToSatelliteTelemetry, onReconnect, getTelemetryReadingKey } from '../services/socket';
import { TelemetryChart } from '../components/TelemetryChart';

const MAX_CHART_POINTS = 60;

function mergeTelemetryReadings(
  existing: ITelemetryReading[],
  incoming: ITelemetryReading[],
  limit: number = MAX_CHART_POINTS
): ITelemetryReading[] {
  const map = new Map<string, ITelemetryReading>();
  for (const r of existing) {
    map.set(getTelemetryReadingKey(r), r);
  }
  for (const r of incoming) {
    map.set(getTelemetryReadingKey(r), r);
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  if (merged.length > limit) {
    return merged.slice(merged.length - limit);
  }
  return merged;
}

export const TelemetryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSatId = searchParams.get('satelliteId') || 'SG-1';

  const [satellites, setSatellites] = useState<ISatellite[]>([]);
  const [readingsByParam, setReadingsByParam] = useState<Record<string, ITelemetryReading[]>>({});
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('all');
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load satellites list
  useEffect(() => {
    api.getSatellites().then(setSatellites).catch(() => {});
  }, []);

  // Fetch bounded historical telemetry via REST
  const fetchHistory = useCallback(async (satId: string) => {
    try {
      setIsLoadingHistory(true);
      setHistoryError(null);
      const history = await api.getTelemetryHistory({ satelliteId: satId, limit: 120 });
      const grouped: Record<string, ITelemetryReading[]> = {};
      for (const item of history) {
        if (!grouped[item.parameter]) grouped[item.parameter] = [];
        grouped[item.parameter].push(item);
      }
      setReadingsByParam(prev => {
        const next: Record<string, ITelemetryReading[]> = { ...prev };
        for (const [param, items] of Object.entries(grouped)) {
          next[param] = mergeTelemetryReadings(prev[param] || [], items, MAX_CHART_POINTS);
        }
        return next;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch telemetry history';
      setHistoryError(msg);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // On target satellite change: clear previous buffer and fetch history
  useEffect(() => {
    setReadingsByParam({});
    fetchHistory(selectedSatId);
  }, [selectedSatId, fetchHistory]);

  // Subscribe to live WebSocket streaming with deduplication & bounded buffering
  useEffect(() => {
    const unsubscribe = subscribeToSatelliteTelemetry(
      selectedSatId,
      (reading) => {
        setReadingsByParam(prev => {
          const currentList = prev[reading.parameter] || [];
          const key = getTelemetryReadingKey(reading);
          if (currentList.some(r => getTelemetryReadingKey(r) === key)) {
            return prev; // Deduplicated, ignore duplicate packet
          }
          const updated = [...currentList, reading];
          if (updated.length > MAX_CHART_POINTS) {
            updated.shift(); // Enforce bounded memory window
          }
          return {
            ...prev,
            [reading.parameter]: updated,
          };
        });
      }
    );

    // Resynchronize historical telemetry on reconnection
    const unsubscribeReconnect = onReconnect(() => {
      fetchHistory(selectedSatId);
    });

    return () => {
      unsubscribe();
      unsubscribeReconnect();
    };
  }, [selectedSatId, fetchHistory]);

  const handleSelectSat = (id: string) => {
    setSearchParams({ satelliteId: id });
  };

  const currentSat = satellites.find(s => s.satelliteId === selectedSatId);

  return (
    <div className="space-y-6 tracking-wide">
      {/* Header and Satellite Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-zinc-950 flex items-center gap-3">
            Telemetry Stream Explorer
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          </h1>
          <p className="text-xs text-zinc-600 font-normal tracking-wide mt-0.5">
            Real-time downlinked multi-subsystem telemetry with nominal operational boundaries
          </p>
        </div>

        {/* Satellite Tabs */}
        <div className="flex items-center gap-1.5 bg-white border border-zinc-200 p-1 rounded-md shadow-2xs">
          {satellites.map(sat => (
            <button
              key={sat.satelliteId}
              onClick={() => handleSelectSat(sat.satelliteId)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium tracking-wide transition-colors ${
                selectedSatId === sat.satelliteId
                  ? 'bg-black text-white shadow-xs'
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100 font-normal'
              }`}
            >
              {sat.satelliteId}
            </button>
          ))}
        </div>
      </div>

      {/* Target Satellite Metadata Bar */}
      {currentSat && (
        <div className="bg-white border border-zinc-200 rounded-md p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-2xs">
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Spacecraft Target</span>
            <span className="font-semibold text-zinc-950 text-sm tracking-wide">{currentSat.name}</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">NORAD Catalog #</span>
            <span className="text-zinc-800 font-medium tracking-wide">{currentSat.noradId || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Data Source</span>
            <span className="text-zinc-900 font-medium uppercase tracking-wide">{currentSat.dataSource}</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Subsystem Filter</span>
            <select
              value={selectedSubsystem}
              onChange={e => setSelectedSubsystem(e.target.value)}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 text-xs font-mono font-normal tracking-wide focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Subsystems</option>
              <option value="thermal">Thermal</option>
              <option value="power">Power</option>
              <option value="communication">Communication</option>
              <option value="attitude">Attitude</option>
            </select>
          </div>
        </div>
      )}

      {/* Historical Load Error Banner */}
      {historyError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-md flex items-center justify-between text-xs font-mono text-rose-800 tracking-wide font-normal">
          <span>Historical Telemetry API Unavailable: {historyError} (Awaiting live Socket.IO stream)</span>
          <button
            onClick={() => fetchHistory(selectedSatId)}
            className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded border border-rose-300 font-normal transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Indicator while awaiting initial history */}
      {isLoadingHistory && Object.keys(readingsByParam).length === 0 && (
        <div className="bg-white border border-zinc-200 p-8 rounded-md text-center font-mono text-xs text-zinc-500 font-light tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-900 animate-ping mr-2" />
          Loading bounded historical telemetry for {selectedSatId}...
        </div>
      )}

      {/* Telemetry Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(selectedSubsystem === 'all' || selectedSubsystem === 'thermal') && (
          <TelemetryChart
            parameter="temperature"
            unit="°C"
            nominalMin={-10.0}
            nominalMax={45.0}
            color="#ea580c" // Orange-600
            data={readingsByParam['temperature'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'power') && (
          <TelemetryChart
            parameter="battery_voltage"
            unit="V"
            nominalMin={3.6}
            nominalMax={4.2}
            color="#0284c7" // Sky-600
            data={readingsByParam['battery_voltage'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'power') && (
          <TelemetryChart
            parameter="power_consumption"
            unit="W"
            nominalMin={15.0}
            nominalMax={35.0}
            color="#0891b2" // Cyan-600
            data={readingsByParam['power_consumption'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'communication') && (
          <TelemetryChart
            parameter="packet_loss_rate"
            unit="%"
            nominalMin={0.0}
            nominalMax={2.0}
            color="#dc2626" // Red-600
            data={readingsByParam['packet_loss_rate'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'communication') && (
          <TelemetryChart
            parameter="signal_strength"
            unit="dBm"
            nominalMin={-100.0}
            nominalMax={-45.0}
            color="#16a34a" // Emerald-600
            data={readingsByParam['signal_strength'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'communication') && (
          <TelemetryChart
            parameter="link_latency"
            unit="ms"
            nominalMin={100.0}
            nominalMax={600.0}
            color="#d97706" // Amber-600
            data={readingsByParam['link_latency'] || []}
          />
        )}

        {(selectedSubsystem === 'all' || selectedSubsystem === 'attitude') && (
          <TelemetryChart
            parameter="roll"
            unit="deg"
            nominalMin={-1.0}
            nominalMax={1.0}
            color="#4f46e5" // Indigo-600
            data={readingsByParam['roll'] || []}
          />
        )}
      </div>
    </div>
  );
};
