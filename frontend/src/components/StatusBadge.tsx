import React from 'react';
import type { HealthStatus, AnomalySeverity } from '../types';

interface StatusBadgeProps {
  status: HealthStatus | AnomalySeverity | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toLowerCase();

  let bgClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
  let dotClass = 'bg-zinc-400';

  if (s === 'nominal' || s === 'low' || s === 'active' || s === 'resolved') {
    bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    dotClass = 'bg-emerald-600';
  } else if (s === 'degraded' || s === 'medium' || s === 'warning' || s === 'investigating') {
    bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
    dotClass = 'bg-amber-600';
  } else if (s === 'critical' || s === 'high') {
    bgClass = 'bg-rose-50 text-rose-800 border-rose-200';
    dotClass = 'bg-rose-600 animate-pulse';
  }

  const pxClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${pxClass} ${bgClass} font-mono tracking-wide font-normal uppercase`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
};
