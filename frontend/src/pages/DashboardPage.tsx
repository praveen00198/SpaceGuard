import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ISatellite, IHealthSnapshot, IAnomaly, SpaceWeatherStatus } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { InvestigationModal } from '../components/InvestigationModal';
import { subscribeToAnomalies, subscribeToSimulationStatus, onReconnect } from '../services/socket';

export const DashboardPage: React.FC = () => {
  const [satellites, setSatellites] = useState<ISatellite[]>([]);
  const [fleetHealth, setFleetHealth] = useState<IHealthSnapshot[]>([]);
  const [anomalies, setAnomalies] = useState<IAnomaly[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeatherStatus | null>(null);
  const [simStatus, setSimStatus] = useState<{ isRunning: boolean; currentScenario: string }>({ isRunning: false, currentScenario: 'normal' });
  const [selectedAnomaly, setSelectedAnomaly] = useState<IAnomaly | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [sats, health, anoms, sw, sim] = await Promise.all([
        api.getSatellites(),
        api.getFleetHealth(),
        api.getAnomalies({ limit: 5 }),
        api.getSpaceWeather(),
        api.getSimulationStatus(),
      ]);
      setSatellites(sats);
      setFleetHealth(health);
      setAnomalies(anoms);
      setSpaceWeather(sw);
      setSimStatus(sim);
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load fleet data';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time anomaly alerts stream
    const unsubscribeAnomalies = subscribeToAnomalies((newAnomaly) => {
      setAnomalies(prev => {
        if (prev.some(a => a.anomalyId === newAnomaly.anomalyId)) return prev;
        return [newAnomaly, ...prev].slice(0, 5);
      });
      // Re-fetch bounded fleet health when an anomaly occurs
      api.getFleetHealth().then(setFleetHealth).catch(() => {});
    });

    // Real-time simulation status stream
    const unsubscribeSim = subscribeToSimulationStatus((status) => {
      setSimStatus({
        isRunning: status.isRunning,
        currentScenario: status.currentScenario,
      });
    });

    // Resynchronize on reconnect
    const unsubscribeReconnect = onReconnect(() => {
      fetchData();
    });

    return () => {
      unsubscribeAnomalies();
      unsubscribeSim();
      unsubscribeReconnect();
    };
  }, []);

  const handleStartSim = async (scenarioId: string) => {
    try {
      const res = await api.startSimulation(scenarioId);
      if (res?.status) {
        setSimStatus({
          isRunning: res.status.isRunning,
          currentScenario: res.status.currentScenario,
        });
      }
      api.getFleetHealth().then(setFleetHealth).catch(() => {});
    } catch {
      // Handled gracefully
    }
  };

  const handleStopSim = async () => {
    try {
      const res = await api.stopSimulation();
      if (res?.status) {
        setSimStatus({
          isRunning: res.status.isRunning,
          currentScenario: res.status.currentScenario,
        });
      }
      api.getFleetHealth().then(setFleetHealth).catch(() => {});
    } catch {
      // Handled gracefully
    }
  };

  const activeAnomaliesCount = anomalies.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6 tracking-wide">
      {loadError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-md flex items-center justify-between text-xs font-mono text-rose-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span className="font-light">Fleet State API Unavailable: {loadError} (Displaying cached/offline state)</span>
          </div>
          <button
            onClick={() => { setIsLoading(true); fetchData(); }}
            className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded border border-rose-300 font-normal transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state before initial REST response */}
      {isLoading && satellites.length === 0 && (
        <div className="bg-white border border-zinc-200 p-8 rounded-md text-center font-mono text-xs text-zinc-500 font-light">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-900 animate-ping mr-2" />
          Loading constellation telemetry and fleet status...
        </div>
      )}

      {/* Top Banner / Fleet Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-zinc-950">Mission Operations Fleet Control</h1>
          <p className="text-xs text-zinc-600 font-normal tracking-wide mt-0.5">
            Real-time multi-satellite telemetry monitoring & evidence-grounded anomaly investigation
          </p>
        </div>

        {/* Simulation Quick Switch */}
        <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-md shadow-2xs">
          <span className="text-xs font-mono text-zinc-500 pl-2 font-light">SIMULATION:</span>
          {simStatus.isRunning ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-medium tracking-wide">
                {simStatus.currentScenario.toUpperCase()}
              </span>
              <button
                onClick={handleStopSim}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-mono font-normal tracking-wide transition-colors"
              >
                STOP
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleStartSim('thermal-spike')}
                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-md text-xs font-mono font-normal tracking-wide transition-colors"
              >
                Thermal Spike
              </button>
              <button
                onClick={() => handleStartSim('battery-degradation')}
                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-md text-xs font-mono font-normal tracking-wide transition-colors"
              >
                Battery Fault
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Constellation Health */}
        <div className="bg-white border border-zinc-200 p-4 rounded-md shadow-2xs">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide font-light block mb-1">
            Constellation Health
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold font-mono tracking-wide text-emerald-700">
              {fleetHealth.length > 0
                ? Math.round(fleetHealth.reduce((acc, h) => acc + h.overallHealth, 0) / fleetHealth.length)
                : 100}%
            </span>
            <span className="text-xs font-mono text-zinc-500 font-light">Fleet Average</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 font-mono font-light">
            {satellites.length} Satellites Tracked
          </div>
        </div>

        {/* Active Anomalies */}
        <div className="bg-white border border-zinc-200 p-4 rounded-md shadow-2xs">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide font-light block mb-1">
            Active Anomalies
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-semibold font-mono tracking-wide ${activeAnomaliesCount > 0 ? 'text-rose-600' : 'text-zinc-950'}`}>
              {activeAnomaliesCount}
            </span>
            <span className="text-xs font-mono text-zinc-500 font-light">Requiring Attention</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 font-mono font-light">
            Hybrid Detection Active
          </div>
        </div>

        {/* Space Weather Context */}
        <div className="bg-white border border-zinc-200 p-4 rounded-md shadow-2xs">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide font-light block mb-1">
            Space Weather (NOAA SWPC)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-zinc-950 tracking-wide">
              Kp {spaceWeather?.kpIndex !== null && spaceWeather?.kpIndex !== undefined ? spaceWeather.kpIndex.toFixed(1) : '—'}
            </span>
            <span className="text-xs font-mono text-zinc-500 font-light truncate">
              {spaceWeather?.geomagneticStormLevel || 'Quiet'}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 font-mono flex items-center gap-1.5 font-light">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Source: {spaceWeather?.source || 'NOAA'}
          </div>
        </div>

        {/* Reasoning Engine */}
        <div className="bg-white border border-zinc-200 p-4 rounded-md shadow-2xs">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide font-light block mb-1">
            Diagnostics Engine
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-zinc-950 tracking-wide">
              Gemini AI
            </span>
            <span className="text-xs font-mono text-zinc-500 font-light">Grounding v1.0</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 font-mono flex items-center gap-1.5 font-light">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
            100% Evidence Constrained
          </div>
        </div>
      </div>

      {/* Satellites Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-950 tracking-wide">Active Satellite Fleet</h2>
          <Link to="/telemetry" className="text-xs font-mono text-zinc-600 hover:text-black font-normal transition-colors">
            View Live Telemetry Streams →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {satellites.map(sat => {
            const health = fleetHealth.find(h => h.satelliteId === sat.satelliteId);
            const score = health?.overallHealth ?? 100;
            const status = health?.overallStatus ?? 'nominal';

            return (
              <div
                key={sat.satelliteId}
                className="bg-white border border-zinc-200 hover:border-zinc-300 transition-colors p-5 rounded-md shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm text-zinc-950 tracking-wide">{sat.satelliteId}</span>
                        <span className="text-[11px] font-mono text-zinc-400 uppercase font-light">{sat.type}</span>
                      </div>
                      <h3 className="text-xs font-medium text-zinc-700 mt-0.5 tracking-wide">{sat.name}</h3>
                      <p className="text-[11px] text-zinc-400 font-mono font-light mt-1">NORAD #{sat.noradId} | {sat.mission}</p>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {/* Subsystems Mini Health */}
                  {health && (
                    <div className="space-y-2 mt-4 pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-500 font-light">Deterministic Health</span>
                        <span className={`font-semibold tracking-wide ${score < 50 ? 'text-rose-600' : score < 80 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {score} / 100
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {(['power', 'thermal', 'communication', 'attitude', 'payload'] as const).map(sub => {
                          const subScore = health.subsystems[sub]?.score ?? 100;
                          return (
                            <div key={sub} className="flex flex-col items-center">
                              <div className="w-full h-1.5 rounded-md bg-zinc-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-md ${
                                    subScore < 50 ? 'bg-rose-500' : subScore < 80 ? 'bg-amber-500' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${subScore}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-zinc-400 uppercase mt-1 truncate max-w-full font-light">
                                {sub.slice(0, 3)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-400 font-light">
                    Source: {sat.dataSource}
                  </span>
                  <Link
                    to={`/telemetry?satelliteId=${sat.satelliteId}`}
                    className="text-xs font-mono text-zinc-900 hover:text-black font-medium"
                  >
                    Inspect Telemetry →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Anomalies Feed */}
      <div className="bg-white border border-zinc-200 rounded-md p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 tracking-wide">Recent Anomalies & AI Investigations</h2>
            <p className="text-xs text-zinc-500 font-light tracking-wide mt-0.5">
              Evaluated across Rule Engine, Statistical 3-Sigma Control, and Isolation Forest ML
            </p>
          </div>
          <Link to="/anomalies" className="text-xs font-mono text-zinc-600 hover:text-black font-normal transition-colors">
            View All in Anomaly Center →
          </Link>
        </div>

        {anomalies.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 font-mono text-xs font-light">
            No active anomalies detected across constellation. All subsystems operating within nominal envelopes.
          </div>
        ) : (
          <div className="space-y-2.5">
            {anomalies.map(anom => (
              <div
                key={anom.anomalyId}
                className="bg-zinc-50 border border-zinc-200 hover:border-zinc-300 p-4 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <StatusBadge status={anom.severity} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-950 tracking-wide">{anom.anomalyId}</span>
                      <span className="text-xs text-zinc-500 font-mono font-light">({anom.satelliteId})</span>
                      <span className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white text-zinc-700 text-[10px] font-mono uppercase font-normal">
                        {anom.detectionMethod} (score {anom.anomalyScore.toFixed(2)})
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 mt-1 font-normal tracking-wide">{anom.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-[11px] font-mono text-zinc-400 font-light">
                    {new Date(anom.detectedAt).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => setSelectedAnomaly(anom)}
                    className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-mono font-normal tracking-wide transition-colors shadow-xs"
                  >
                    AI Investigate →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investigation Modal */}
      {selectedAnomaly && (
        <InvestigationModal
          anomaly={selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
        />
      )}
    </div>
  );
};
