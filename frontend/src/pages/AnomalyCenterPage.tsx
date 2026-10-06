import React, { useState, useEffect } from 'react';
import type { IAnomaly, AnomalyStatus } from '../types';
import { api } from '../services/api';
import { subscribeToAnomalies, onReconnect } from '../services/socket';
import { StatusBadge } from '../components/StatusBadge';
import { InvestigationModal } from '../components/InvestigationModal';

const MAX_ANOMALIES_STORED = 100;

export const AnomalyCenterPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<IAnomaly[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<IAnomaly | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    try {
      const data = await api.getAnomalies();
      setAnomalies(data.slice(0, MAX_ANOMALIES_STORED));
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch anomalies';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();

    // Subscribe to live anomaly alerts via Socket.IO
    const unsubscribeSocket = subscribeToAnomalies((newAnomaly) => {
      setAnomalies(prev => {
        // Prevent duplicate anomaly entries
        if (prev.some(a => a.anomalyId === newAnomaly.anomalyId)) {
          return prev;
        }
        const next = [newAnomaly, ...prev];
        if (next.length > MAX_ANOMALIES_STORED) {
          next.pop(); // Bounded in-memory list
        }
        return next;
      });
    });

    // Reconcile anomalies on reconnect
    const unsubscribeReconnect = onReconnect(() => {
      fetchAnomalies();
    });

    return () => {
      unsubscribeSocket();
      unsubscribeReconnect();
    };
  }, []);

  const handleUpdateStatus = async (anomalyId: string, newStatus: string) => {
    try {
      const updated = await api.updateAnomalyStatus(anomalyId, newStatus);
      setAnomalies(prev =>
        prev.map(a => (a.anomalyId === anomalyId ? { ...a, status: updated.status as AnomalyStatus } : a))
      );
    } catch {
      // Handled gracefully without breaking UI
    }
  };

  const filtered = anomalies.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (methodFilter !== 'all' && a.detectionMethod !== methodFilter) return false;
    return true;
  });

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const activeCount = anomalies.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6 tracking-wide">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-zinc-950">Anomaly Command Center</h1>
          <p className="text-xs text-zinc-600 font-normal tracking-wide mt-0.5">
            Multi-engine anomaly detection feed across Rule limits, Statistical 3-Sigma, and Isolation Forest ML
          </p>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-md bg-white border border-zinc-200 shadow-2xs">
            <span className="text-zinc-500 uppercase mr-2 font-light">Active:</span>
            <span className="font-semibold text-zinc-950">{activeCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800">
            <span className="uppercase mr-2 font-light">Critical:</span>
            <span className="font-semibold">{criticalCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
            <span className="uppercase mr-2 font-light">High:</span>
            <span className="font-semibold">{highCount}</span>
          </div>
        </div>
      </div>

      {/* Error state if REST API failed */}
      {loadError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-md flex items-center justify-between text-xs font-mono text-rose-800 tracking-wide font-normal">
          <span>Anomaly Database Offline: {loadError}</span>
          <button
            onClick={() => { setIsLoading(true); fetchAnomalies(); }}
            className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-800 rounded border border-rose-300 font-normal transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-md p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Severity Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase font-light">Severity:</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 font-normal tracking-wide focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase font-light">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 font-normal tracking-wide focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {/* Method Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase font-light">Method:</span>
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 font-normal tracking-wide focus:outline-none focus:border-zinc-500"
            >
              <option value="all">All Detectors</option>
              <option value="hybrid">Hybrid Consensus</option>
              <option value="rule">Rule Engine</option>
              <option value="statistical">Statistical 3-Sigma</option>
              <option value="ml">Isolation Forest ML</option>
            </select>
          </div>
        </div>

        <span className="text-zinc-400 font-light text-xs">
          Showing {filtered.length} of {anomalies.length} records
        </span>
      </div>

      {/* Loading state indicator */}
      {isLoading && anomalies.length === 0 && (
        <div className="bg-white border border-zinc-200 p-8 rounded-md text-center font-mono text-xs text-zinc-500 font-light tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-900 animate-ping mr-2" />
          Loading detected anomalies...
        </div>
      )}

      {/* Anomalies Table / List */}
      <div className="bg-white border border-zinc-200 rounded-md overflow-hidden shadow-2xs">
        {filtered.length === 0 && !isLoading ? (
          <div className="py-16 text-center text-zinc-400 font-mono text-xs font-light">
            No anomalies matching selected filters.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {filtered.map(anom => (
              <div
                key={anom.anomalyId}
                className="p-4 sm:p-5 hover:bg-zinc-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="pt-0.5">
                    <StatusBadge status={anom.severity} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-950 tracking-wide">{anom.anomalyId}</span>
                      <span className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-700 font-mono text-xs font-normal">
                        {anom.satelliteId}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-zinc-200 bg-white text-zinc-800 font-mono text-xs font-normal capitalize">
                        {anom.detectionMethod} detector
                      </span>
                      <span className="text-xs font-mono text-zinc-400 font-light">
                        Score: {anom.anomalyScore.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-800 mt-1.5 font-normal tracking-wide">{anom.description}</p>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-zinc-500 font-light">
                      <span>Parameter: <strong className="text-zinc-900 font-medium">{anom.parameter}</strong></span>
                      <span>Value: <strong className="text-rose-600 font-medium">{anom.value.toFixed(2)}{anom.unit}</strong></span>
                      <span>Baseline: <strong className="text-emerald-700 font-medium">{anom.baseline.toFixed(2)}{anom.unit}</strong></span>
                      <span>Detected: {new Date(anom.detectedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                  {/* Status Dropdown */}
                  <select
                    value={anom.status}
                    onChange={e => handleUpdateStatus(anom.anomalyId, e.target.value)}
                    className="bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-800 font-mono text-xs font-normal focus:outline-none focus:border-zinc-500"
                  >
                    <option value="active">Active</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>

                  <button
                    onClick={() => setSelectedAnomaly(anom)}
                    className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-mono font-normal tracking-wide transition-colors shadow-xs flex items-center gap-1.5"
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
