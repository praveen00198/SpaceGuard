import React, { useState, useEffect } from 'react';
import type { IAnomaly, IAIAssessment, CorrelationReport } from '../types';
import { api } from '../services/api';
import { StatusBadge } from './StatusBadge';

interface InvestigationModalProps {
  anomaly: IAnomaly | null;
  onClose: () => void;
}

export const InvestigationModal: React.FC<InvestigationModalProps> = ({ anomaly, onClose }) => {
  const [assessment, setAssessment] = useState<IAIAssessment | null>(null);
  const [correlationReport, setCorrelationReport] = useState<CorrelationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!anomaly) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Fetch correlation report in parallel
    api.getCorrelationReport(anomaly.anomalyId)
      .then(report => {
        if (isMounted && report) {
          setCorrelationReport(report);
        }
      })
      .catch(() => {
        // Non-blocking: correlation fetch failure shouldn't block assessment display
      });

    // Try fetching existing or generate fresh
    api.getAssessment(anomaly.anomalyId)
      .then(data => {
        if (!isMounted) return;
        if (data) {
          setAssessment(data);
          setLoading(false);
        } else {
          // Generate on the fly
          return api.generateAssessment(anomaly.anomalyId).then(gen => {
            if (isMounted) {
              setAssessment(gen);
              setLoading(false);
            }
          });
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve assessment');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [anomaly]);

  if (!anomaly) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-zinc-200 w-full max-w-4xl max-h-[90vh] rounded-md shadow-xl flex flex-col overflow-hidden text-zinc-900 tracking-wide">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded bg-black text-white font-mono text-xs tracking-wide font-normal">
              AI INVESTIGATION
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950 flex items-center gap-2 tracking-wide">
                {anomaly.anomalyId}
                <span className="text-xs font-normal text-zinc-500">on {anomaly.satelliteId}</span>
              </h2>
              <p className="text-xs text-zinc-500 font-mono font-light tracking-wide">
                Detected: {new Date(anomaly.detectedAt).toUTCString()} | Subsystem: {anomaly.subsystem.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={anomaly.severity} />
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-black p-1.5 rounded-md hover:bg-zinc-100 transition-colors text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Anomaly Core Telemetry Context Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-md border border-zinc-200 font-mono text-xs">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-light block">Parameter</span>
              <span className="text-sm text-zinc-950 font-medium tracking-wide">{anomaly.parameter}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-light block">Observed Value</span>
              <span className="text-sm text-rose-600 font-semibold tracking-wide">
                {anomaly.value.toFixed(2)} {anomaly.unit}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-light block">Expected Baseline</span>
              <span className="text-sm text-emerald-600 font-semibold tracking-wide">
                {anomaly.baseline.toFixed(2)} {anomaly.unit}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-light block">Detector / Method</span>
              <span className="text-sm text-zinc-900 font-medium capitalize tracking-wide">
                {anomaly.detectionMethod} ({anomaly.anomalyScore.toFixed(2)})
              </span>
            </div>
          </div>

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-zinc-500 tracking-wide font-light">
                Grounding AI reasoning over structured evidence package...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-mono tracking-wide">
              {error}
            </div>
          )}

          {assessment && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-mono tracking-wide text-zinc-900 font-medium">
                    Flight Controller Assessment
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 tracking-wide font-light">
                    Model: {assessment.modelUsed} ({assessment.latencyMs}ms)
                  </span>
                </div>
                <p className="text-sm text-zinc-900 font-normal leading-relaxed tracking-wide">
                  {assessment.summary}
                </p>
              </div>

              {/* Physical Subsystem Interpretation */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wide text-zinc-500 font-light mb-2">
                  Subsystem Dynamics & Physical Interpretation
                </h3>
                <p className="text-xs text-zinc-700 leading-relaxed bg-zinc-50 p-4 rounded-md border border-zinc-200 font-mono tracking-wide">
                  {assessment.interpretation}
                </p>
              </div>

              {/* Evidence-Linked Claims */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wide text-zinc-500 font-light mb-2">
                  Evidence-Grounded Claims (Principle 1: AI Reasons Over Evidence)
                </h3>
                <div className="space-y-2">
                  {assessment.evidenceClaims.map((claim, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-zinc-200 p-3.5 rounded-md flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <p className="text-xs text-zinc-800 flex-1 leading-relaxed tracking-wide font-normal">{claim.claim}</p>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {claim.evidenceIds.map(evId => (
                          <span
                            key={evId}
                            className="px-2 py-0.5 rounded border border-zinc-300 bg-zinc-100 text-zinc-700 font-mono text-[11px] tracking-wide font-normal"
                          >
                            {evId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correlated External Context & Environmental Evidence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wide text-zinc-500 font-light flex items-center gap-2">
                    <span>Correlated Space Context & Environmental Evidence</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 border border-zinc-300 text-zinc-700 font-mono font-normal tracking-wide">
                      Phase 4 Correlation
                    </span>
                  </h3>
                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded tracking-wide font-light">
                    Non-Causal Context (Temporal / Environmental Overlap Only)
                  </span>
                </div>

                {correlationReport && correlationReport.correlations.length > 0 ? (
                  <div className="space-y-2.5">
                    {correlationReport.correlations.map((corr, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-zinc-200 hover:border-zinc-300 transition-colors p-3.5 rounded-md space-y-2 font-mono text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide bg-zinc-100 border border-zinc-300 text-zinc-800">
                              {corr.relationship.replace('_', ' ')}
                            </span>
                            <span className="text-zinc-500 text-[11px] font-light tracking-wide">
                              Source: <strong className="text-zinc-900 font-medium">{corr.contextSource}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {corr.evidenceId && (
                              <span className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 text-[11px] tracking-wide font-normal">
                                {corr.evidenceId}
                              </span>
                            )}
                            <span className="text-[11px] text-zinc-500 font-light tracking-wide">
                              Confidence: <span className="text-emerald-700 font-medium">{Math.round(corr.confidence * 100)}%</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-zinc-800 font-sans text-xs tracking-wide leading-relaxed font-normal">
                          {corr.contextEvent}
                        </p>

                        <div className="pt-1 text-[11px] text-zinc-500 border-t border-zinc-100 font-light italic tracking-wide">
                          {corr.note}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-mono text-zinc-500 flex items-center justify-between tracking-wide font-light">
                    <span>No external solar/geomagnetic or radiation anomalies overlapping this temporal window.</span>
                    <span className="text-emerald-700 font-normal">Nominal Space Environment</span>
                  </div>
                )}
              </div>

              {/* Epistemological Boundaries: Knowns, Unknowns, Cannot Determine */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                {/* Known */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-md p-3.5">
                  <span className="text-emerald-800 font-medium uppercase tracking-wide block mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Known Facts
                  </span>
                  <ul className="space-y-1.5 text-zinc-800 list-disc list-inside font-normal tracking-wide">
                    {assessment.known.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </div>

                {/* Unknown */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-md p-3.5">
                  <span className="text-amber-800 font-medium uppercase tracking-wide block mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    Unknowns
                  </span>
                  <ul className="space-y-1.5 text-zinc-800 list-disc list-inside font-normal tracking-wide">
                    {assessment.unknown.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>

                {/* Cannot Determine */}
                <div className="bg-rose-50/50 border border-rose-200 rounded-md p-3.5">
                  <span className="text-rose-800 font-medium uppercase tracking-wide block mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                    Cannot Determine
                  </span>
                  <ul className="space-y-1.5 text-zinc-800 list-disc list-inside font-normal tracking-wide">
                    {assessment.cannotDetermine.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Uncertainty Statement */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-mono text-zinc-700 flex items-start gap-2 tracking-wide font-light">
                <span className="text-zinc-950 font-medium tracking-wide">UNCERTAINTY:</span>
                <span>{assessment.uncertainty}</span>
              </div>

              {/* Actionable Recommendations */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wide text-zinc-500 font-light mb-2">
                  Recommended Flight Controller Actions
                </h3>
                <div className="space-y-2">
                  {assessment.recommendedInvestigation.map((action, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-800 tracking-wide font-normal"
                    >
                      <span className="w-5 h-5 rounded bg-zinc-200 text-zinc-800 flex items-center justify-center font-mono text-[11px] font-medium shrink-0">
                        {i + 1}
                      </span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono font-light tracking-wide">
            Grounding principle verified: No invented evidence IDs permitted.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-mono font-normal tracking-wide transition-colors"
          >
            Close Investigation
          </button>
        </div>
      </div>
    </div>
  );
};
