import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
// Solo se muestra la sección de Logs; el resto comentado para no romper nada
// import { BalancerPanel } from './components/balancer';
import { AdministrationPanel } from './components/administration';
import { AlertsPanel } from './components/alerts';
import { HydroPanel } from './components/hydro';
import { PredictionTypesPanel } from './components/prediction-types';
import Dashboard from './components/dashboard';
// import ForecastPanel from './components/forecasts/ForecastPanel';
// import InputDataPanel from './components/input-data/InputDataPanel';
// import { IOHistoryPanel } from './components/io-history';
import Login from './components/Login';
import { PredictionsDataPanel } from './components/predictions-data';
// import { ReportsPanel } from './components/reports';
import Sidebar from './components/Sidebar';
import { useAuth } from './contexts/AuthContext';
import { isAdmin } from './utils/jwt';

function App() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isLoginPage = location.pathname === '/login';

  const [activePanel, setActivePanel] = useState<'logs' | 'forecasts' | 'input-data' | 'io-history' | 'balancer' | 'predictions-data' | 'reports' | 'administration' | 'hydro' | 'alerts' | 'prediction-types'>('logs');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoginPage) {
    if (!isLoading && isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const renderPanel = () => {
    switch (activePanel) {
      case 'logs':
        return <Dashboard />;
      case 'alerts':
        return <AlertsPanel />;
      case 'administration':
        return <AdministrationPanel />;
      case 'hydro':
        return <HydroPanel />;
      case 'prediction-types':
        return <PredictionTypesPanel />;
      // case 'forecasts':
      //   return <ForecastPanel />;
      // case 'input-data':
      //   return <InputDataPanel />;
      // case 'io-history':
      //   return <IOHistoryPanel />;
      case 'predictions-data':
        return isAdmin() ? <PredictionsDataPanel /> : <Dashboard />;
      // case 'reports':
      //   return <ReportsPanel />;
      // case 'balancer':
      //   return <BalancerPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 p-2 rounded-lg text-white hover:bg-slate-700 transition-colors"
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar - Fixed width, always visible on desktop */}
      <div
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:relative
          w-64 h-full
          flex-none
          transition-transform duration-300 ease-in-out
          z-40
        `}
      >
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content - Takes remaining space */}
      <main className="flex-1 h-full overflow-auto bg-slate-950 pt-16 lg:pt-0">
        {renderPanel()}
      </main>
    </div>
  );
}

export default App;
