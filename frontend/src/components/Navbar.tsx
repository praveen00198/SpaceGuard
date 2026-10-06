import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';

interface NavbarProps {
  activeAnomalyCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeAnomalyCount = 0 }) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const connectionStatus = useRealtimeStatus();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors ${
      isActive
        ? 'bg-black text-white shadow-xs'
        : 'text-zinc-600 hover:text-black hover:bg-zinc-100 font-normal'
    }`;

  const renderConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-xs" />
            <span className="text-xs font-mono tracking-wide text-zinc-700 font-normal">LINK LIVE</span>
          </>
        );
      case 'reconnecting':
        return (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono tracking-wide text-amber-700 font-normal">RECONNECTING...</span>
          </>
        );
      case 'connecting':
        return (
          <>
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-mono tracking-wide text-sky-700 font-normal">CONNECTING...</span>
          </>
        );
      case 'disconnected':
      default:
        return (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-600" />
            <span className="text-xs font-mono tracking-wide text-rose-700 font-normal">LINK OFFLINE</span>
          </>
        );
    }
  };

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-black text-white flex items-center justify-center font-semibold text-xs tracking-wider shadow-xs">
              SG
            </div>
            <div>
              <span className="font-semibold text-base tracking-wide text-zinc-950 flex items-center gap-2">
                SpaceGuard <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-300 bg-zinc-100 text-zinc-700 font-normal tracking-wide">AI</span>
              </span>
              <p className="text-[11px] text-zinc-500 font-light tracking-wide leading-tight">Evidence-Grounded Spacecraft Health</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <NavLink to="/" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/telemetry" className={navLinkClass}>
              Telemetry Explorer
            </NavLink>
            <NavLink to="/anomalies" className={navLinkClass}>
              Anomaly Center
              {activeAnomalyCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-normal rounded tracking-wide">
                  {activeAnomalyCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/simulation" className={navLinkClass}>
              Simulation Lab
            </NavLink>
          </nav>
        </div>

        {/* Right side UTC Clock & Status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono font-light">Mission Elapsed Time</span>
            <span className="text-xs font-mono font-medium tracking-wide text-zinc-900">{utcTime || 'SYNCHRONIZING...'}</span>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
            {renderConnectionBadge()}
          </div>
        </div>
      </div>
    </header>
  );
};
