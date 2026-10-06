import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { ITelemetryReading } from '../types';

interface TelemetryChartProps {
  parameter: string;
  unit: string;
  data: ITelemetryReading[];
  nominalMin?: number;
  nominalMax?: number;
  color?: string;
  height?: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  parameter,
  unit,
  data,
  nominalMin,
  nominalMax,
  color = '#0284c7', // Sky-600
  height = 240,
}) => {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: Number(d.value.toFixed(2)),
    raw: d,
  }));

  const latestVal = data.length > 0 ? data[data.length - 1].value : null;

  return (
    <div className="bg-white border border-zinc-200 rounded-md p-4 flex flex-col justify-between shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wide text-zinc-500 font-light block">
            {parameter.replace(/_/g, ' ')}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-semibold font-mono text-zinc-950 tracking-wide">
              {latestVal !== null ? latestVal.toFixed(2) : '—'}
            </span>
            <span className="text-xs font-mono text-zinc-500 font-light tracking-wide">{unit}</span>
          </div>
        </div>

        {nominalMin !== undefined && nominalMax !== undefined && (
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono tracking-wide text-zinc-400 font-light block">Nominal Envelope</span>
            <span className="text-xs font-mono tracking-wide text-zinc-600 font-normal">
              {nominalMin} to {nominalMax} {unit}
            </span>
          </div>
        )}
      </div>

      <div style={{ width: '100%', height }}>
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 font-mono text-xs tracking-wide font-light">
            Awaiting telemetry packet feed...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="time" stroke="#a1a1aa" tick={{ fontSize: 10, fill: '#71717a' }} minTickGap={25} />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fontSize: 10, fill: '#71717a' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#09090b',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
                labelStyle={{ color: '#52525b', fontWeight: '500' }}
                formatter={(val: unknown) => [typeof val === 'number' ? `${val.toFixed(2)} ${unit}` : `${val} ${unit}`, 'Telemetry']}
              />
              {nominalMax !== undefined && (
                <ReferenceLine y={nominalMax} stroke="#d97706" strokeDasharray="4 4" opacity={0.7} />
              )}
              {nominalMin !== undefined && (
                <ReferenceLine y={nominalMin} stroke="#d97706" strokeDasharray="4 4" opacity={0.7} />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
