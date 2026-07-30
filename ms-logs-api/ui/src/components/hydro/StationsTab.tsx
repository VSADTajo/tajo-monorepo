import { useState } from 'react';
import { Plus, Pencil, Trash2, Power, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStations, createStation, updateStation, toggleStation, deleteStation, updateThreshold, listSubBasins } from './api';
import type { Station } from '../../types/hydro';
import { STATION_TYPES, STATION_TYPE_LABELS } from '../../types/hydro';

interface StationForm {
    name: string;
    stationCode: string;
    stationType: string;
    subBasinId: string;
    subBasinName: string;
    latitude: string;
    longitude: string;
    altitude: string;
    description: string;
    // Threshold fields
    umbralNivel1: string; umbralNivel2: string; umbralNivel3: string;
    umbralCaudal1: string; umbralCaudal2: string; umbralCaudal3: string;
    maxNivelMuro: string; maxNivelCaseta: string;
    umbralVolumen1: string; umbralVolumen2: string; umbralVolumen3: string;
    caudalEntrada: string; caudalSalida: string; capacidad: string;
    parametro: string; senal: string;
}

const emptyForm: StationForm = {
    name: '', stationCode: '', stationType: '', subBasinId: '', subBasinName: '',
    latitude: '', longitude: '', altitude: '', description: '',
    umbralNivel1: '', umbralNivel2: '', umbralNivel3: '',
    umbralCaudal1: '', umbralCaudal2: '', umbralCaudal3: '',
    maxNivelMuro: '', maxNivelCaseta: '',
    umbralVolumen1: '', umbralVolumen2: '', umbralVolumen3: '',
    caudalEntrada: '', caudalSalida: '', capacidad: '',
    parametro: '', senal: '',
};

function getMainThreshold(st: Station): string {
    const t = st.threshold;
    if (!t) return 'N/A';
    if (t.umbralCaudal1 != null) return `Q1: ${t.umbralCaudal1}`;
    if (t.umbralNivel1 != null) return `N1: ${t.umbralNivel1}`;
    if (t.umbralVolumen1 != null) return `V1: ${t.umbralVolumen1}`;
    return 'N/A';
}

export default function StationsTab() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Station | null>(null);
    const [form, setForm] = useState<StationForm>(emptyForm);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterSubBasinId, setFilterSubBasinId] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['stations'],
        queryFn: () => listStations(),
        staleTime: 2 * 60 * 1000,
    });

    const { data: subBasinsData } = useQuery({
        queryKey: ['sub-basins'],
        queryFn: () => listSubBasins(),
        staleTime: 5 * 60 * 1000,
    });

    const rawStations = data?.items ?? [];
    const stations = rawStations.filter((st) => {
        if (filterSubBasinId && st.subBasinId !== filterSubBasinId) return false;
        if (filterType && st.stationType !== filterType) return false;
        if (search && !`${st.name} ${st.stationCode} ${st.subBasinName} ${st.stationType} ${st.municipio ?? ''} ${st.provincia ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });
    const subBasins = subBasinsData?.items ?? [];
    const subBasinOptions = subBasins.map((sb) => ({ value: sb.id, label: sb.name }));
    const stationTypeOptions = STATION_TYPES.map((t) => ({ value: t, label: STATION_TYPE_LABELS[t] }));

    const createMutation = useMutation({
        mutationFn: () => {
            const payload: Parameters<typeof createStation>[0] = {
                name: form.name,
                stationCode: form.stationCode,
                stationType: form.stationType,
                subBasinId: form.subBasinId,
                subBasinName: form.subBasinName,
            };
            if (form.latitude) payload.latitude = parseFloat(form.latitude);
            if (form.longitude) payload.longitude = parseFloat(form.longitude);
            if (form.altitude) payload.altitude = parseFloat(form.altitude);
            if (form.description) payload.description = form.description;
            return createStation(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stations'] });
            closeForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: () => updateStation(editingItem!.id, {
            name: form.name || undefined,
            stationCode: form.stationCode || undefined,
            stationType: form.stationType || undefined,
            latitude: form.latitude ? parseFloat(form.latitude) : null,
            longitude: form.longitude ? parseFloat(form.longitude) : null,
            altitude: form.altitude ? parseFloat(form.altitude) : null,
            description: form.description || null,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stations'] });
            closeForm();
        },
    });

    const toggleMutation = useMutation({
        mutationFn: toggleStation,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stations'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stations'] });
            setConfirmDeleteId(null);
        },
    });

    const thresholdMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Record<string, number | string | null> }) => updateThreshold(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stations'] }),
    });

    function openCreate() {
        setEditingItem(null);
        setForm(emptyForm);
        setShowForm(true);
    }

    function openEdit(station: Station) {
        setEditingItem(station);
        const t = station.threshold;
        setForm({
            name: station.name,
            stationCode: station.stationCode,
            stationType: station.stationType,
            subBasinId: station.subBasinId,
            subBasinName: station.subBasinName,
            latitude: station.latitude?.toString() ?? '',
            longitude: station.longitude?.toString() ?? '',
            altitude: station.altitude?.toString() ?? '',
            description: station.description ?? '',
            umbralNivel1: t?.umbralNivel1?.toString() ?? '',
            umbralNivel2: t?.umbralNivel2?.toString() ?? '',
            umbralNivel3: t?.umbralNivel3?.toString() ?? '',
            umbralCaudal1: t?.umbralCaudal1?.toString() ?? '',
            umbralCaudal2: t?.umbralCaudal2?.toString() ?? '',
            umbralCaudal3: t?.umbralCaudal3?.toString() ?? '',
            maxNivelMuro: t?.maxNivelMuro?.toString() ?? '',
            maxNivelCaseta: t?.maxNivelCaseta?.toString() ?? '',
            umbralVolumen1: t?.umbralVolumen1?.toString() ?? '',
            umbralVolumen2: t?.umbralVolumen2?.toString() ?? '',
            umbralVolumen3: t?.umbralVolumen3?.toString() ?? '',
            caudalEntrada: t?.caudalEntrada?.toString() ?? '',
            caudalSalida: t?.caudalSalida?.toString() ?? '',
            capacidad: t?.capacidad?.toString() ?? '',
            parametro: t?.parametro ?? '',
            senal: t?.senal ?? '',
        });
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingItem(null);
        setForm(emptyForm);
    }

    function saveThresholdFromForm(stationId: string) {
        const payload: Record<string, number | string | null> = {};
        const numFields = ['umbralNivel1', 'umbralNivel2', 'umbralNivel3', 'umbralCaudal1', 'umbralCaudal2', 'umbralCaudal3', 'maxNivelMuro', 'maxNivelCaseta', 'umbralVolumen1', 'umbralVolumen2', 'umbralVolumen3', 'caudalEntrada', 'caudalSalida', 'capacidad'] as const;
        const strFields = ['parametro', 'senal'] as const;
        for (const f of numFields) payload[f] = form[f] ? parseFloat(form[f]) : null;
        for (const f of strFields) payload[f] = form[f] || null;
        thresholdMutation.mutate({ id: stationId, payload });
    }

    function handleSubmit() {
        if (editingItem) {
            updateMutation.mutate(undefined, {
                onSuccess: () => saveThresholdFromForm(editingItem.id),
            });
        } else {
            createMutation.mutate();
        }
    }

    function handleSubBasinChange(subBasinId: string) {
        const sb = subBasins.find((s) => s.id === subBasinId);
        setForm({ ...form, subBasinId, subBasinName: sb?.name ?? '' });
    }

    const isPending = createMutation.isPending || updateMutation.isPending;

    if (isLoading) return <p className="text-center text-slate-500 py-8">Cargando estaciones...</p>;

    return (
        <>
            {/* Header + Filters */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-200 shrink-0">Estaciones ({stations.length})</h2>
                <div className="flex gap-2 flex-1 justify-end flex-wrap items-center">
                    <div className="relative flex-1 max-w-xs min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                            placeholder="Buscar estacion..."
                        />
                    </div>
                    <SearchableSelect
                        options={subBasinOptions}
                        value={filterSubBasinId}
                        onChange={setFilterSubBasinId}
                        placeholder="Todas las subcuencas"
                        className="w-48"
                    />
                    <SearchableSelect
                        options={stationTypeOptions}
                        value={filterType}
                        onChange={setFilterType}
                        placeholder="Todos los tipos"
                        className="w-44"
                    />
                    <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg font-medium transition-colors shrink-0">
                        <Plus size={14} /> Nueva estacion
                    </button>
                </div>
            </div>

            {/* Stations List */}
            <div className="space-y-2">
                {stations.map((st) => {
                    const isExpanded = expandedId === st.id;
                    return (
                        <div key={st.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
                                <button onClick={() => setExpandedId(isExpanded ? null : st.id)} className="text-slate-400 shrink-0">
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{st.name}</p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {st.stationCode} &middot; {STATION_TYPE_LABELS[st.stationType] ?? st.stationType} &middot; {st.subBasinName}
                                        {st.threshold ? ` · ${getMainThreshold(st)}` : ''}
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded border ${st.isActive ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-slate-500 bg-slate-700/30 border-slate-600'}`}>
                                    {st.isActive ? 'activo' : 'inactivo'}
                                </span>
                                <button onClick={() => toggleMutation.mutate(st.id)} className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-md transition-colors" title="Toggle activo">
                                    <Power size={14} />
                                </button>
                                <button onClick={() => openEdit(st)} className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-colors" title="Editar">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => setConfirmDeleteId(st.id)} className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors" title="Eliminar">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div className="border-t border-slate-700/50 bg-slate-800/30 px-4 py-3">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                        <div><span className="text-slate-500">Codigo:</span> <span className="text-slate-300">{st.stationCode}</span></div>
                                        <div><span className="text-slate-500">Tipo:</span> <span className="text-slate-300">{STATION_TYPE_LABELS[st.stationType] ?? st.stationType}</span></div>
                                        <div><span className="text-slate-500">Subcuenca:</span> <span className="text-slate-300">{st.subBasinName}</span></div>
                                        <div><span className="text-slate-500">Parametro:</span> <span className="text-slate-300">{st.threshold?.parametro ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Latitud:</span> <span className="text-slate-300">{st.latitude ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Longitud:</span> <span className="text-slate-300">{st.longitude ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Altitud:</span> <span className="text-slate-300">{st.altitude ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Tipo cod:</span> <span className="text-slate-300">{st.tipoCod ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Municipio:</span> <span className="text-slate-300">{st.municipio ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Provincia:</span> <span className="text-slate-300">{st.provincia ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">CCAA:</span> <span className="text-slate-300">{st.ccaa ?? 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Descripcion:</span> <span className="text-slate-300">{st.description ?? 'N/A'}</span></div>
                                    </div>
                                    {/* Threshold fields (read-only) */}
                                    {st.threshold && (
                                        <div className="mt-3 pt-3 border-t border-slate-700/30">
                                            <p className="text-xs text-slate-400 font-medium mb-2">Umbrales</p>
                                            {st.stationType === 'EMBALSE_SAIH' ? (
                                                <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
                                                    <div><span className="text-slate-500">Umbral vol. 1:</span> <span className="text-slate-300">{st.threshold.umbralVolumen1 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral vol. 2:</span> <span className="text-slate-300">{st.threshold.umbralVolumen2 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral vol. 3:</span> <span className="text-slate-300">{st.threshold.umbralVolumen3 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Caudal entrada:</span> <span className="text-slate-300">{st.threshold.caudalEntrada ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Caudal salida:</span> <span className="text-slate-300">{st.threshold.caudalSalida ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Capacidad:</span> <span className="text-slate-300">{st.threshold.capacidad ?? 'N/A'}</span></div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
                                                    <div><span className="text-slate-500">Umbral nivel 1:</span> <span className="text-slate-300">{st.threshold.umbralNivel1 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral nivel 2:</span> <span className="text-slate-300">{st.threshold.umbralNivel2 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral nivel 3:</span> <span className="text-slate-300">{st.threshold.umbralNivel3 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral caudal 1:</span> <span className="text-slate-300">{st.threshold.umbralCaudal1 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral caudal 2:</span> <span className="text-slate-300">{st.threshold.umbralCaudal2 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Umbral caudal 3:</span> <span className="text-slate-300">{st.threshold.umbralCaudal3 ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Max nivel muro:</span> <span className="text-slate-300">{st.threshold.maxNivelMuro ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Max nivel caseta:</span> <span className="text-slate-300">{st.threshold.maxNivelCaseta ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Parametro:</span> <span className="text-slate-300">{st.threshold.parametro ?? 'N/A'}</span></div>
                                                    <div><span className="text-slate-500">Senal:</span> <span className="text-slate-300">{st.threshold.senal ?? 'N/A'}</span></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {stations.length === 0 && <p className="text-center text-slate-600 py-8">No hay estaciones registradas</p>}
            </div>

            {/* Create / Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 shrink-0">
                            <h3 className="text-sm font-semibold text-slate-100">{editingItem ? 'Editar estacion' : 'Nueva estacion'}</h3>
                            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="px-5 py-4 overflow-auto flex-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Nombre de la estacion" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Codigo *</label>
                                    <input value={form.stationCode} onChange={(e) => setForm({ ...form, stationCode: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: AC01" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Tipo *</label>
                                    <SearchableSelect
                                        options={stationTypeOptions}
                                        value={form.stationType}
                                        onChange={(val) => setForm({ ...form, stationType: val })}
                                        placeholder="Seleccionar tipo"
                                    />
                                </div>
                                {!editingItem && (
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Subcuenca *</label>
                                        <SearchableSelect
                                            options={subBasinOptions}
                                            value={form.subBasinId}
                                            onChange={handleSubBasinChange}
                                            placeholder="Seleccionar subcuenca"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Latitud</label>
                                    <input type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: 40.4826" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Longitud</label>
                                    <input type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: -1.4572" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Altitud (m)</label>
                                    <input type="number" step="0.1" value={form.altitude} onChange={(e) => setForm({ ...form, altitude: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: 750" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                                    <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Opcional" />
                                </div>
                            </div>
                            {/* Threshold section in modal */}
                            {editingItem && (
                                <div className="mt-4 pt-4 border-t border-slate-700/30">
                                    <p className="text-xs text-slate-400 font-medium mb-3">Umbrales</p>
                                    {(editingItem.stationType === 'EMBALSE_SAIH') ? (
                                        <>
                                            <p className="text-xs text-cyan-500/70 mb-1">Volumen (hm3)</p>
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral 1</label><input type="number" step="0.01" value={form.umbralVolumen1} onChange={(e) => setForm({ ...form, umbralVolumen1: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral 2</label><input type="number" step="0.01" value={form.umbralVolumen2} onChange={(e) => setForm({ ...form, umbralVolumen2: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral 3</label><input type="number" step="0.01" value={form.umbralVolumen3} onChange={(e) => setForm({ ...form, umbralVolumen3: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div><label className="text-xs text-slate-400 mb-1 block">Caudal entrada</label><input type="number" step="0.01" value={form.caudalEntrada} onChange={(e) => setForm({ ...form, caudalEntrada: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Caudal salida</label><input type="number" step="0.01" value={form.caudalSalida} onChange={(e) => setForm({ ...form, caudalSalida: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Capacidad</label><input type="number" step="0.01" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs text-cyan-500/70 mb-1">Nivel</p>
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral nivel 1</label><input type="number" step="0.01" value={form.umbralNivel1} onChange={(e) => setForm({ ...form, umbralNivel1: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral nivel 2</label><input type="number" step="0.01" value={form.umbralNivel2} onChange={(e) => setForm({ ...form, umbralNivel2: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral nivel 3</label><input type="number" step="0.01" value={form.umbralNivel3} onChange={(e) => setForm({ ...form, umbralNivel3: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                            </div>
                                            <p className="text-xs text-cyan-500/70 mb-1">Caudal (m3/s)</p>
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral caudal 1</label><input type="number" step="0.01" value={form.umbralCaudal1} onChange={(e) => setForm({ ...form, umbralCaudal1: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral caudal 2</label><input type="number" step="0.01" value={form.umbralCaudal2} onChange={(e) => setForm({ ...form, umbralCaudal2: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Umbral caudal 3</label><input type="number" step="0.01" value={form.umbralCaudal3} onChange={(e) => setForm({ ...form, umbralCaudal3: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3">
                                                <div><label className="text-xs text-slate-400 mb-1 block">Max nivel muro</label><input type="number" step="0.01" value={form.maxNivelMuro} onChange={(e) => setForm({ ...form, maxNivelMuro: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Max nivel caseta</label><input type="number" step="0.01" value={form.maxNivelCaseta} onChange={(e) => setForm({ ...form, maxNivelCaseta: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Parametro</label><input type="text" value={form.parametro} onChange={(e) => setForm({ ...form, parametro: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                                <div><label className="text-xs text-slate-400 mb-1 block">Senal</label><input type="text" value={form.senal} onChange={(e) => setForm({ ...form, senal: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500" /></div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700/50 shrink-0">
                            {(createMutation.isError || updateMutation.isError) && (
                                <p className="text-xs text-red-400 mr-auto">Error al guardar</p>
                            )}
                            <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button onClick={handleSubmit} disabled={!form.name || !form.stationCode || !form.stationType || (!editingItem && !form.subBasinId) || isPending} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                                {isPending ? 'Guardando...' : editingItem ? 'Guardar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-5">
                        <p className="text-sm text-slate-200 mb-4">Estas seguro de que deseas eliminar esta estacion?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button onClick={() => deleteMutation.mutate(confirmDeleteId)} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
