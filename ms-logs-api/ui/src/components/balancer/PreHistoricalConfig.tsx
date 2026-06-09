import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPreHistoricalConfig, updatePreHistoricalConfig } from './api';
import { Settings, Save, AlertCircle, CheckCircle, Info, Globe, Power } from 'lucide-react';

type Language = 'en' | 'es';

const translations = {
  en: {
    title: 'Historical Configuration',
    status: 'Status',
    enabled: 'Enabled',
    disabled: 'Disabled',
    preHistoricalHours: 'Pre-Historical Hours',
    historicalHours: 'Historical Hours',
    preHistoricalDesc: 'Warm-up period (1-6)',
    historicalDesc: 'Simulation period (1-48)',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    errorLoading: 'Error loading config',
    preHistoricalInfo: 'Short simulation to warm up basin states before the main run.',
    historicalInfo: 'Main simulation using ThingsBoard data.',
    configInfo: 'Controls the historical simulation phases.',
  },
  es: {
    title: 'Configuración Histórica',
    status: 'Estado',
    enabled: 'Habilitado',
    disabled: 'Deshabilitado',
    preHistoricalHours: 'Horas Pre-Históricas',
    historicalHours: 'Horas Históricas',
    preHistoricalDesc: 'Período de calentamiento (1-6)',
    historicalDesc: 'Período de simulación (1-48)',
    saveChanges: 'Guardar Cambios',
    saving: 'Guardando...',
    errorLoading: 'Error cargando configuración',
    preHistoricalInfo: 'Simulación corta para calentar estados antes de la ejecución principal.',
    historicalInfo: 'Simulación principal usando datos de ThingsBoard.',
    configInfo: 'Controla las fases de simulación histórica.',
  },
};

interface InfoTooltipProps {
  text: string;
}

function InfoTooltip({ text }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className="absolute z-50 left-6 top-0 w-72 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-sm text-slate-300 leading-relaxed">
          <div className="absolute -left-2 top-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-slate-600" />
          {text}
        </div>
      )}
    </div>
  );
}

export default function PreHistoricalConfig() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [preHistHours, setPreHistHours] = useState(1);
  const [histHours, setHistHours] = useState(24);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    // Try to get saved preference, default to 'en'
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('configLanguage') as Language) || 'en';
    }
    return 'en';
  });

  const t = translations[language];

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['pre-historical-config'],
    queryFn: getPreHistoricalConfig,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setPreHistHours(config.pre_historical_hours);
      setHistHours(config.historical_hours);
    }
  }, [config]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('configLanguage', lang);
  };

  const saveMutation = useMutation({
    mutationFn: () => updatePreHistoricalConfig({
      enabled,
      pre_historical_hours: preHistHours,
      historical_hours: histHours,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pre-historical-config'] });
      setSaveMessage({ type: 'success', text: data.message });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error: Error) => {
      setSaveMessage({ type: 'error', text: error.message });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (newEnabled: boolean) => updatePreHistoricalConfig({ enabled: newEnabled }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pre-historical-config'] });
      setEnabled(data.config.enabled);
      setSaveMessage({ type: 'success', text: data.message });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error: Error) => {
      setSaveMessage({ type: 'error', text: error.message });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  const hasChanges = config && (preHistHours !== config.pre_historical_hours || histHours !== config.historical_hours);

  if (isLoading) {
    return (
      <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-10 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertCircle className="w-5 h-5" />
          <span>{t.errorLoading}: {(error as Error).message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">{t.title}</h2>
              <p className="text-sm text-slate-400">
                {t.status}: {enabled ? (
                  <span className="text-emerald-400">{t.enabled}</span>
                ) : (
                  <span className="text-amber-400">{t.disabled}</span>
                )}
              </p>
            </div>
            <InfoTooltip text={t.configInfo} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Enable/Disable Toggle */}
          <button
            onClick={() => toggleMutation.mutate(!enabled)}
            disabled={toggleMutation.isPending}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
              enabled
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600'
            } ${toggleMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
          >
            <Power className="w-4 h-4" />
            {toggleMutation.isPending ? '...' : (enabled ? t.enabled : t.disabled)}
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
            <Globe className="w-4 h-4 text-slate-400 ml-2" />
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                language === 'en'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleLanguageChange('es')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                language === 'es'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ES
            </button>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="block text-sm font-medium text-slate-300">
              {t.preHistoricalHours}
            </label>
            <InfoTooltip text={t.preHistoricalInfo} />
          </div>
          <input
            type="number"
            min="1"
            max="6"
            value={preHistHours}
            onChange={(e) => setPreHistHours(Math.min(6, Math.max(1, Number(e.target.value))))}
            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 mt-1">{t.preHistoricalDesc}</p>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="block text-sm font-medium text-slate-300">
              {t.historicalHours}
            </label>
            <InfoTooltip text={t.historicalInfo} />
          </div>
          <input
            type="number"
            min="1"
            max="48"
            value={histHours}
            onChange={(e) => setHistHours(Math.min(48, Math.max(1, Number(e.target.value))))}
            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 mt-1">{t.historicalDesc}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {saveMessage && (
            <div className={`flex items-center gap-2 text-sm ${
              saveMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {saveMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {saveMessage.text}
            </div>
          )}
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? t.saving : t.saveChanges}
        </button>
      </div>
    </div>
  );
}
