import { Bell, Droplets, FileText, Gauge, LogOut, Shield } from 'lucide-react';
import { memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/jwt';

interface SidebarProps {
  activePanel: 'logs' | 'forecasts' | 'input-data' | 'io-history' | 'balancer' | 'predictions-data' | 'reports' | 'administration' | 'hydro' | 'alerts' | 'prediction-types';
  onPanelChange: (panel: 'logs' | 'forecasts' | 'input-data' | 'io-history' | 'balancer' | 'predictions-data' | 'reports' | 'administration' | 'hydro' | 'alerts' | 'prediction-types') => void;
}

function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const { logout } = useAuth();
  return (
    <aside className="h-full w-full bg-slate-900 border-r border-slate-700/50 flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span>Tajo Backoffice</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Panel de monitoreo</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => onPanelChange('logs')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'logs'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Logs</span>
        </button>

        {isAdmin() && (
          <button
            onClick={() => onPanelChange('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              activePanel === 'alerts'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>Alertas</span>
          </button>
        )}

        {/* Forecasts - Comentado por ahora, no se usa */}
        {/* <button
          onClick={() => onPanelChange('forecasts')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'forecasts'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Forecasts</span>
        </button> */}

        {/* Hydro + Administration - solo para admins */}
        {isAdmin() && (
          <button
            onClick={() => onPanelChange('hydro')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              activePanel === 'hydro'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Droplets className="w-5 h-5" />
            <span>Hidrologia</span>
          </button>
        )}
        {isAdmin() && (
          <button
            onClick={() => onPanelChange('administration')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              activePanel === 'administration'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span>Administración</span>
          </button>
        )}
        {isAdmin() && (
          <button
            onClick={() => onPanelChange('prediction-types')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              activePanel === 'prediction-types'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Gauge className="w-5 h-5" />
            <span>Prediction Types</span>
          </button>
        )}

        {/* Resto de secciones ocultas; solo se muestra Logs */}
        {/* <button
          onClick={() => onPanelChange('input-data')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'input-data'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <Database className="w-5 h-5" />
          <span>Forecast Data</span>
        </button>

        <button
          onClick={() => onPanelChange('io-history')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'io-history'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <CloudDownload className="w-5 h-5" />
          <span>Model Files</span>
        </button>

        <button
          onClick={() => onPanelChange('predictions-data')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'predictions-data'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span>Model Results</span>
        </button>

        <button
          onClick={() => onPanelChange('reports')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'reports'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <FileDown className="w-5 h-5" />
          <span>Reports</span>
        </button>

        <button
          onClick={() => onPanelChange('balancer')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
            activePanel === 'balancer'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }`}
        >
          <Server className="w-5 h-5" />
          <span>Balancer</span>
        </button> */}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50 space-y-3">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar sesión</span>
        </button>
        <div className="text-xs text-slate-500">
          <p>Version 1.0.0</p>
          <p className="mt-1">© 2026 Tajo Backoffice</p>
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
