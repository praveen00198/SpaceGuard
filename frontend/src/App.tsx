import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { AnomalyCenterPage } from './pages/AnomalyCenterPage';
import { SimulationPage } from './pages/SimulationPage';
import { api } from './services/api';
import { subscribeToAnomalies, onReconnect } from './services/socket';

export default function App() {
  const [activeAnomalyCount, setActiveAnomalyCount] = useState<number>(0);

  useEffect(() => {
    const fetchActiveCount = () => {
      api.getAnomalies({ status: 'active' })
        .then(anoms => setActiveAnomalyCount(anoms.length))
        .catch(() => {});
    };

    fetchActiveCount();

    // Listen for real-time anomaly alerts
    const unsubscribeSocket = subscribeToAnomalies((anomaly) => {
      if (anomaly.status === 'active') {
        setActiveAnomalyCount(prev => prev + 1);
      }
    });

    // Resynchronize on reconnect
    const unsubscribeReconnect = onReconnect(() => {
      fetchActiveCount();
    });

    return () => {
      unsubscribeSocket();
      unsubscribeReconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans tracking-wide selection:bg-black selection:text-white">
        <Navbar activeAnomalyCount={activeAnomalyCount} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/telemetry" element={<TelemetryPage />} />
            <Route path="/anomalies" element={<AnomalyCenterPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs font-mono tracking-wide text-zinc-500 font-light">
          SpaceGuard AI — Evidence-grounded spacecraft health monitoring & anomaly investigation platform
        </footer>
      </div>
    </BrowserRouter>
  );
}
