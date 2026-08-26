import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  PROVIDER_TYPES,
  SETTINGS_FIELDS,
  TYPE_DESCRIPTIONS,
  TYPE_LABELS,
  defaultBaseUrlFor,
  defaultSettingsFor,
} from './types';
import type { ProviderConfig, ProviderFormValues, ProviderType } from './types';

interface ProviderFormModalProps {
  provider: ProviderConfig | null;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => Promise<void>;
}

const MIN_POLLING_MINUTES = 5;

export default function ProviderFormModal({ provider, onClose, onSubmit }: ProviderFormModalProps) {
  const isEdit = provider !== null;

  const [name, setName] = useState(provider?.name ?? '');
  const [type, setType] = useState<ProviderType>(provider?.type ?? 'WISKI_API');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? defaultBaseUrlFor('WISKI_API'));
  const [pollingIntervalMinutes, setPollingIntervalMinutes] = useState(
    provider?.pollingIntervalMinutes ?? 60,
  );
  const [settings, setSettings] = useState<Record<string, unknown>>(
    provider?.settings ?? defaultSettingsFor('WISKI_API'),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawSettings, setRawSettings] = useState(() =>
    JSON.stringify(provider?.settings ?? defaultSettingsFor('WISKI_API'), null, 2),
  );
  const [rawError, setRawError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const knownFields = useMemo(() => SETTINGS_FIELDS[type] ?? [], [type]);

  // Anything the type does not declare stays visible in the advanced editor
  // rather than being silently dropped on save.
  const extraKeys = useMemo(
    () => Object.keys(settings).filter((key) => !knownFields.some((field) => field.key === key)),
    [settings, knownFields],
  );

  const onTypeChange = (nextType: ProviderType) => {
    setType(nextType);
    // Only reset when creating: on an edit, the operator's own settings win.
    if (!isEdit) {
      const nextSettings = defaultSettingsFor(nextType);
      setSettings(nextSettings);
      setRawSettings(JSON.stringify(nextSettings, null, 2));
      setBaseUrl(defaultBaseUrlFor(nextType));
    }
  };

  const onFieldChange = (key: string, value: string) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setRawSettings(JSON.stringify(next, null, 2));
  };

  const onRawChange = (value: string) => {
    setRawSettings(value);
    try {
      const parsed = JSON.parse(value || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setRawError('Los settings tienen que ser un objeto JSON.');
        return;
      }
      setSettings(parsed as Record<string, unknown>);
      setRawError(null);
    } catch {
      setRawError('JSON inválido — el resto del formulario sigue usando el último valor válido.');
    }
  };

  const submit = async () => {
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!baseUrl.trim()) {
      setError('La URL base es obligatoria.');
      return;
    }
    if (pollingIntervalMinutes < MIN_POLLING_MINUTES) {
      setError(`El intervalo mínimo es de ${MIN_POLLING_MINUTES} minutos.`);
      return;
    }
    if (rawError) {
      setError('Corregí el JSON de settings antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        baseUrl: baseUrl.trim(),
        pollingIntervalMinutes: Number(pollingIntervalMinutes),
        settings,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {isEdit ? 'Editar proveedor' : 'Nuevo proveedor de datos'}
            </h2>
            <p className="text-xs text-slate-400">{TYPE_DESCRIPTIONS[type]}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="WISKI Observados (API)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Tipo</span>
              <select
                value={type}
                onChange={(event) => onTypeChange(event.target.value as ProviderType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              >
                {PROVIDER_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">URL base</span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://apisaih.saihchtajo.es"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                Intervalo (minutos)
              </span>
              <input
                type="number"
                min={MIN_POLLING_MINUTES}
                value={pollingIntervalMinutes}
                onChange={(event) => setPollingIntervalMinutes(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Configuración del tipo
            </h3>

            <div className="space-y-3">
              {knownFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-400">
                    {field.label}
                  </span>
                  <input
                    value={String(settings[field.key] ?? '')}
                    onChange={(event) => onFieldChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                  {field.hint && <span className="mt-1 block text-xs text-slate-500">{field.hint}</span>}
                </label>
              ))}

              {extraKeys.length > 0 && (
                <p className="text-xs text-slate-500">
                  Además hay {extraKeys.length} clave(s) fuera del formulario ({extraKeys.join(', ')}
                  ): se editan en el JSON avanzado y se guardan igual.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowAdvanced((value) => !value)}
              className="mt-3 text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              {showAdvanced ? 'Ocultar JSON avanzado' : 'Editar JSON avanzado'}
            </button>

            {showAdvanced && (
              <div className="mt-3">
                <textarea
                  value={rawSettings}
                  onChange={(event) => onRawChange(event.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-sky-500"
                />
                {rawError && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {rawError}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700/50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
