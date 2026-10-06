import React, { useState, useEffect } from 'react';
import type { SimulationScenarioConfig } from '../types';
import { api } from '../services/api';
import { subscribeToSimulationStatus, subscribeToSatelliteTelemetry, onReconnect } from '../services/socket';

export const SimulationPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<SimulationScenarioConfig[]>([]);
  const [status, setStatus] = useState<{
    isRunning: boolean;
    currentScenario: string;
    targetSatelliteId: string;
    ticksGenerated: number;
  }>({
    isRunning: false,
    currentScenario: 'normal',
    targetSatelliteId: 'SG-1',
    ticksGenerated: 0,
  });

  const [selectedScenario, setSelectedScenario] = useState<string>('thermal-spike');
  const [selectedSatellite, setSelectedSatellite] = useState<string>('SG-1');
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = () => {
    api.getSimulationStatus()
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    api.getSimulationScenarios().then(setScenarios).catch(() => {});
    fetchStatus();

    // Subscribe to live simulation status changes
    const unsubscribeStatus = subscribeToSimulationStatus((newStatus) => {
      setStatus(newStatus);
    });

    // Real-time telemetry tick tracking from live Socket.IO stream
    const unsubscribeTelemetry = subscribeToSatelliteTelemetry(
      '',
      (reading) => {
        if (reading.source === 'simulator') {
          setStatus(prev => ({
            ...prev,
            ticksGenerated: prev.ticksGenerated + 1,
          }));
        }
      }
    );

    // Resynchronize on reconnect
    const unsubscribeReconnect = onReconnect(() => {
      fetchStatus();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTelemetry();
      unsubscribeReconnect();
    };
  }, []);

  const handleStart = async (scenarioId?: string) => {
    const sc = scenarioId || selectedScenario;
    try {
      const res = await api.startSimulation(sc, selectedSatellite);
      if (res?.status) {
        setStatus(res.status);
      }
      setMessage(`Scenario '${sc}' successfully initiated on ${selectedSatellite}.`);
    } catch {
      setMessage('Failed to start simulation');
    }
  };

  const handleStop = async () => {
    try {
      const res = await api.stopSimulation();
      if (res?.status) {
        setStatus(res.status);
      }
      setMessage('Simulation stopped.');
    } catch {
      setMessage('Failed to stop simulation');
    }
  };

  return (
    <div className="space-y-6 tracking-wide">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold tracking-wide text-zinc-950">Spacecraft Simulation & Fault Injection Lab</h1>
        <p className="text-xs text-zinc-600 font-normal tracking-wide mt-0.5">
          Inject real-time physical spacecraft anomalies into live telemetry streams to evaluate detection sensitivity and AI reasoning
        </p>
      </div>

      {/* Active Simulation Status Deck */}
      <div className="bg-white border border-zinc-200 rounded-md p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <span className="text-xs uppercase font-mono tracking-wide text-zinc-400 block mb-1 font-light">
              Simulation Telemetry Generator
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold font-mono text-zinc-950 tracking-wide">
                {status.isRunning ? status.currentScenario.toUpperCase() : 'STANDBY / IDLE'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono uppercase tracking-wide font-normal ${
                  status.isRunning
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.isRunning ? 'bg-emerald-600 animate-pulse' : 'bg-zinc-400'}`} />
                {status.isRunning ? 'Streaming Packets' : 'Stopped'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status.isRunning ? (
              <button
                onClick={handleStop}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-normal tracking-wide rounded-md shadow-xs transition-colors"
              >
                STOP SIMULATION
              </button>
            ) : (
              <button
                onClick={() => handleStart()}
                className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-white font-mono text-xs font-normal tracking-wide rounded-md shadow-xs transition-colors"
              >
                START SELECTED SCENARIO
              </button>
            )}
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 font-mono text-xs">
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Target Spacecraft</span>
            <span className="text-sm font-semibold text-zinc-950 tracking-wide">{status.targetSatelliteId}</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Ticks Ingested</span>
            <span className="text-sm font-semibold text-zinc-950 tracking-wide">{status.ticksGenerated} packets</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Sampling Rate</span>
            <span className="text-sm font-normal text-zinc-700 tracking-wide">1.0 Hz (1000ms)</span>
          </div>
          <div>
            <span className="text-zinc-400 uppercase block text-[10px] font-light tracking-wide">Ground Truth Provenance</span>
            <span className="text-sm font-medium text-zinc-900 tracking-wide">Simulated / Canonical</span>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-md text-xs font-mono font-normal tracking-wide">
            {message}
          </div>
        )}
      </div>

      {/* Target Satellite Selection */}
      <div className="bg-white border border-zinc-200 p-4 rounded-md flex items-center justify-between font-mono text-xs shadow-2xs">
        <span className="text-zinc-700 font-normal tracking-wide">Inject Faults into Spacecraft:</span>
        <div className="flex gap-2">
          {['SG-1', 'SG-2', 'SG-3'].map(id => (
            <button
              key={id}
              onClick={() => setSelectedSatellite(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wide transition-colors ${
                selectedSatellite === id
                  ? 'bg-black text-white font-medium shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 font-normal border border-zinc-200'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Scenarios Catalog Grid */}
      <div>
        <h2 className="text-base font-semibold text-zinc-950 tracking-wide mb-3">Fault Injection Scenarios</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map(sc => {
            const isCurrent = status.isRunning && status.currentScenario === sc.id;
            const isSelected = selectedScenario === sc.id;

            return (
              <div
                key={sc.id}
                onClick={() => setSelectedScenario(sc.id)}
                className={`bg-white border rounded-md p-5 cursor-pointer transition-all flex flex-col justify-between shadow-2xs ${
                  isCurrent
                    ? 'border-zinc-950 ring-1 ring-zinc-950 bg-zinc-50/50'
                    : isSelected
                    ? 'border-zinc-400 bg-zinc-50/30'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-700 font-mono text-[10px] uppercase font-normal tracking-wide">
                      Subsystem: {sc.targetSubsystem}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-medium tracking-wide">
                        ACTIVE STREAM
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-950 mb-1 tracking-wide">{sc.name}</h3>
                  <p className="text-xs text-zinc-600 font-normal leading-relaxed mb-4 tracking-wide">{sc.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-400 font-light tracking-wide">
                    Param: {sc.targetParameter}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStart(sc.id);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wide transition-colors ${
                      isCurrent
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-normal'
                        : 'bg-black text-white hover:bg-zinc-800 font-normal shadow-xs'
                    }`}
                  >
                    {isCurrent ? 'Restart' : 'Trigger Now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
