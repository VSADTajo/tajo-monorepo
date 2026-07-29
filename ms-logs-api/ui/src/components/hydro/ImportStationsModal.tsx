import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import SearchableSelect from './SearchableSelect';
import { listBasins, importStations, type ImportStationsResult } from './api';

interface Props {
    open: boolean;
    onClose: () => void;
    onImported: () => void;
}

export default function ImportStationsModal({ open, onClose, onImported }: Props) {
    const [basinId, setBasinId] = useState('');
    const [createMissing, setCreateMissing] = useState(false);
    const [items, setItems] = useState<unknown[]>([]);
    const [fileName, setFileName] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [result, setResult] = useState<ImportStationsResult | null>(null);

    const { data: basinsData } = useQuery({
        queryKey: ['basins'],
        queryFn: listBasins,
        staleTime: 5 * 60 * 1000,
        enabled: open,
    });
    const basinOptions = (basinsData?.items ?? []).map((b) => ({ value: b.id, label: b.name }));

    const mutation = useMutation({
        mutationFn: () => importStations({ basinId, createMissingSubBasins: createMissing, items }),
        onSuccess: (res) => {
            setResult(res);
            onImported();
        },
    });

    function handleFile(file: File) {
        setParseError(null);
        setResult(null);
        mutation.reset();
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                const arr = Array.isArray(parsed) ? parsed : parsed?.items;
                if (!Array.isArray(arr)) {
                    throw new Error('El JSON debe ser un array o un objeto { items: [...] }');
                }
                setItems(arr);
                setFileName(file.name);
            } catch (e) {
                setItems([]);
                setFileName('');
                setParseError(e instanceof Error ? e.message : 'JSON inválido');
            }
        };
        reader.readAsText(file);
    }

    function reset() {
        setBasinId('');
        setCreateMissing(false);
        setItems([]);
        setFileName('');
        setParseError(null);
        setResult(null);
        mutation.reset();
    }

    function close() {
        reset();
        onClose();
    }

    if (!open) return null;

    const errMsg = mutation.isError
        ? ((mutation.error as { response?: { data?: { ErrorDescription?: string } }; message?: string })?.response?.data
              ?.ErrorDescription ??
          (mutation.error as { message?: string })?.message ??
          'Error al importar')
        : null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 shrink-0">
                    <h3 className="text-sm font-semibold text-slate-100">Importar estaciones (JSON)</h3>
                    <button onClick={close} className="text-slate-400 hover:text-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 overflow-auto flex-1 space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Cuenca (basin) *</label>
                        <SearchableSelect
                            options={basinOptions}
                            value={basinId}
                            onChange={setBasinId}
                            placeholder="Seleccionar cuenca"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Archivo JSON *</label>
                        <input
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                            }}
                            className="w-full text-xs text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-cyan-600 file:text-white file:text-xs hover:file:bg-cyan-500 file:cursor-pointer"
                        />
                        {fileName && !parseError && (
                            <p className="text-xs text-emerald-400 mt-1">
                                {fileName} — {items.length} estaciones detectadas
                            </p>
                        )}
                        {parseError && <p className="text-xs text-red-400 mt-1">{parseError}</p>}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={createMissing}
                            onChange={(e) => setCreateMissing(e.target.checked)}
                            className="accent-cyan-600"
                        />
                        Crear sub-cuencas faltantes automáticamente
                    </label>

                    {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}

                    {result && (
                        <div className="border border-slate-700/50 rounded-lg p-3 bg-slate-900/50 space-y-2">
                            <div className="flex flex-wrap gap-4 text-xs">
                                <span className="text-emerald-400">Creadas: {result.created}</span>
                                <span className="text-cyan-400">Actualizadas: {result.updated}</span>
                                <span className="text-amber-400">Omitidas: {result.skipped}</span>
                                <span className="text-slate-400">Total: {result.total}</span>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="max-h-40 overflow-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-500 text-left">
                                                <th className="py-1 pr-3 font-medium">Código</th>
                                                <th className="py-1 font-medium">Motivo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.errors.map((er, i) => (
                                                <tr key={i} className="border-t border-slate-800">
                                                    <td className="py-1 pr-3 text-slate-300 align-top">{er.stationCode}</td>
                                                    <td className="py-1 text-red-400">{er.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700/50 shrink-0">
                    <button onClick={close} className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100">
                        Cerrar
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={!basinId || items.length === 0 || mutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                    >
                        <Upload size={14} /> {mutation.isPending ? 'Importando...' : 'Importar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
