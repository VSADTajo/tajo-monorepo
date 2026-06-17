import { useState, useEffect } from 'react';
import { Pencil, X, Search } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStations, getResguardosByStation, getResguardoByDate, updateResguardo } from './api';
import type { RawResguardoValues } from '../../types/hydro';

interface ResguardoForm {
    reserveVolume: string;
    reserveLevel: string;
    minimumVolume: string;
}

const emptyForm: ResguardoForm = { reserveVolume: '', reserveLevel: '', minimumVolume: '' };

function fmt(value: number | null): string {
    return value == null ? 'N/A' : String(value);
}

export default function ResguardosTab() {
    const queryClient = useQueryClient();
    const [stationCode, setStationCode] = useState<string>('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [search, setSearch] = useState('');
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [form, setForm] = useState<ResguardoForm>(emptyForm);

    // Station selector — only EMBALSE_SAIH stations have resguardos
    const { data: stationsData } = useQuery({
        queryKey: ['stations'],
        queryFn: () => listStations(),
        staleTime: 5 * 60 * 1000,
    });
    const stationOptions = (stationsData?.items ?? [])
        .filter((st) => st.stationType === 'EMBALSE_SAIH')
        .map((st) => ({ value: st.stationCode, label: `${st.name} (${st.stationCode})` }));

    // Resguardo time series for the selected station
    const { data, isLoading } = useQuery({
        queryKey: ['resguardos', stationCode, from, to],
        queryFn: () => getResguardosByStation(stationCode, { from: from || undefined, to: to || undefined }),
        enabled: !!stationCode,
        staleTime: 60 * 1000,
    });

    const rows = Object.entries(data?.entries ?? {})
        .map(([date, values]) => ({ date, ...values }))
        .filter((r) => !search || r.date.includes(search))
        .sort((a, b) => b.date.localeCompare(a.date));

    // Detail (original + edited) for the row being edited
    const { data: detail } = useQuery({
        queryKey: ['resguardo', stationCode, editingDate],
        queryFn: () => getResguardoByDate(stationCode, editingDate!),
        enabled: !!stationCode && !!editingDate,
    });

    useEffect(() => {
        if (detail) {
            setForm({
                reserveVolume: detail.edited.reserveVolume?.toString() ?? '',
                reserveLevel: detail.edited.reserveLevel?.toString() ?? '',
                minimumVolume: detail.edited.minimumVolume?.toString() ?? '',
            });
        }
    }, [detail]);

    const updateMutation = useMutation({
        mutationFn: () => {
            const payload: RawResguardoValues = {
                reserveVolume: form.reserveVolume === '' ? null : parseFloat(form.reserveVolume),
                reserveLevel: form.reserveLevel === '' ? null : parseFloat(form.reserveLevel),
                minimumVolume: form.minimumVolume === '' ? null : parseFloat(form.minimumVolume),
            };
            return updateResguardo(stationCode, editingDate!, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resguardos', stationCode] });
            queryClient.invalidateQueries({ queryKey: ['resguardo', stationCode, editingDate] });
            closeForm();
        },
    });

    function closeForm() {
        setEditingDate(null);
        setForm(emptyForm);
    }

    return (
        <>
            {/* Header + Filters */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-200 shrink-0">Resguardos ({rows.length})</h2>
                <div className="flex gap-2 flex-1 justify-end flex-wrap items-center">
                    <SearchableSelect
                        options={stationOptions}
                        value={stationCode}
                        onChange={setStationCode}
                        placeholder="Seleccionar estacion"
                        className="w-56"
                    />
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            title="Desde"
                        />
                        <span className="text-slate-500 text-xs">-</span>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            title="Hasta"
                        />
                    </div>
                    <div className="relative max-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                            placeholder="Buscar fecha..."
                        />
                    </div>
                </div>
            </div>

            {/* Body */}
            {!stationCode ? (
                <p className="text-center text-slate-600 py-8">Selecciona una estacion para ver sus resguardos</p>
            ) : isLoading ? (
                <p className="text-center text-slate-500 py-8">Cargando resguardos...</p>
            ) : rows.length === 0 ? (
                <p className="text-center text-slate-600 py-8">No hay resguardos para esta estacion</p>
            ) : (
                <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-800/60 text-slate-400">
                                <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                                <th className="text-right font-medium px-4 py-2.5">Vol. resguardo (Hm3)</th>
                                <th className="text-right font-medium px-4 py-2.5">Cota resguardo (m)</th>
                                <th className="text-right font-medium px-4 py-2.5">Vol. minimo (Hm3)</th>
                                <th className="px-4 py-2.5 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.date} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="px-4 py-2.5 text-slate-200">{r.date}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-300">{fmt(r.reserveVolume)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-300">{fmt(r.reserveLevel)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-300">{fmt(r.minimumVolume)}</td>
                                    <td className="px-4 py-2.5 text-right">
                                        <button
                                            onClick={() => setEditingDate(r.date)}
                                            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editingDate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-100">Editar resguardo &middot; {editingDate}</h3>
                            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="px-5 py-4">
                            {!detail ? (
                                <p className="text-center text-slate-500 py-6">Cargando...</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-3 items-end">
                                        <span className="text-xs text-cyan-500/70 font-medium">Editado (modificable)</span>
                                        <span></span>
                                        <span className="text-xs text-slate-500 font-medium text-right">Original (solo lectura)</span>

                                        {/* Reserve volume */}
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Vol. resguardo (Hm3)</label>
                                            <input type="number" step="0.001" value={form.reserveVolume} onChange={(e) => setForm({ ...form, reserveVolume: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" placeholder="(usa original)" />
                                        </div>
                                        <span className="text-slate-600 pb-2">&larr;</span>
                                        <div className="text-right pb-2 text-sm text-slate-400">{fmt(detail.original.reserveVolume)}</div>

                                        {/* Reserve level */}
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Cota resguardo (m)</label>
                                            <input type="number" step="0.001" value={form.reserveLevel} onChange={(e) => setForm({ ...form, reserveLevel: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" placeholder="(usa original)" />
                                        </div>
                                        <span className="text-slate-600 pb-2">&larr;</span>
                                        <div className="text-right pb-2 text-sm text-slate-400">{fmt(detail.original.reserveLevel)}</div>

                                        {/* Minimum volume */}
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Vol. minimo (Hm3)</label>
                                            <input type="number" step="0.001" value={form.minimumVolume} onChange={(e) => setForm({ ...form, minimumVolume: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" placeholder="(usa original)" />
                                        </div>
                                        <span className="text-slate-600 pb-2">&larr;</span>
                                        <div className="text-right pb-2 text-sm text-slate-400">{fmt(detail.original.minimumVolume)}</div>
                                    </div>
                                    <p className="text-xs text-slate-500">Dejar un campo vacio aplica el valor original.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700/50">
                            {updateMutation.isError && <p className="text-xs text-red-400 mr-auto">Error al guardar</p>}
                            <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button onClick={() => updateMutation.mutate()} disabled={!detail || updateMutation.isPending} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
