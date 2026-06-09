import { useState } from 'react';
import { Plus, Pencil, Trash2, Power, X, Search } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSubBasins, createSubBasin, updateSubBasin, toggleSubBasin, deleteSubBasin, listBasins } from './api';
import type { SubBasin } from '../../types/hydro';

interface SubBasinForm {
    name: string;
    code: string;
    basinId: string;
    description: string;
}

const emptyForm: SubBasinForm = { name: '', code: '', basinId: '', description: '' };

export default function SubBasinsTab() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<SubBasin | null>(null);
    const [form, setForm] = useState<SubBasinForm>(emptyForm);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [filterBasinId, setFilterBasinId] = useState<string>('');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['sub-basins'],
        queryFn: () => listSubBasins(),
        staleTime: 2 * 60 * 1000,
    });

    const { data: basinsData } = useQuery({
        queryKey: ['basins'],
        queryFn: listBasins,
        staleTime: 5 * 60 * 1000,
    });

    const rawSubBasins = data?.items ?? [];
    const subBasins = rawSubBasins.filter((sb) => {
        if (filterBasinId && sb.basinId !== filterBasinId) return false;
        if (search && !`${sb.name} ${sb.code} ${sb.basinName ?? ''} ${sb.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });
    const basins = basinsData?.items ?? [];
    const basinOptions = basins.map((b) => ({ value: b.id, label: b.name }));

    const createMutation = useMutation({
        mutationFn: () => createSubBasin({ name: form.name, code: form.code, basinId: form.basinId, description: form.description || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-basins'] });
            closeForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: () => updateSubBasin(editingItem!.id, { name: form.name, code: form.code, description: form.description || null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-basins'] });
            closeForm();
        },
    });

    const toggleMutation = useMutation({
        mutationFn: toggleSubBasin,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sub-basins'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteSubBasin,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sub-basins'] });
            setConfirmDeleteId(null);
        },
    });

    function openCreate() {
        setEditingItem(null);
        setForm(emptyForm);
        setShowForm(true);
    }

    function openEdit(item: SubBasin) {
        setEditingItem(item);
        setForm({ name: item.name, code: item.code, basinId: item.basinId, description: item.description ?? '' });
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingItem(null);
        setForm(emptyForm);
    }

    function handleSubmit() {
        if (editingItem) updateMutation.mutate();
        else createMutation.mutate();
    }

    const isPending = createMutation.isPending || updateMutation.isPending;

    if (isLoading) return <p className="text-center text-slate-500 py-8">Cargando subcuencas...</p>;

    return (
        <>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-200 shrink-0">Subcuencas ({subBasins.length})</h2>
                <div className="flex gap-2 flex-1 justify-end flex-wrap items-center">
                    <div className="relative flex-1 max-w-xs min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                            placeholder="Buscar subcuenca..."
                        />
                    </div>
                    <SearchableSelect
                        options={basinOptions}
                        value={filterBasinId}
                        onChange={setFilterBasinId}
                        placeholder="Todas las cuencas"
                        className="w-48"
                    />
                    <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg font-medium transition-colors shrink-0">
                        <Plus size={14} /> Nueva subcuenca
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {subBasins.map((sb) => (
                    <div key={sb.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{sb.name}</p>
                                <p className="text-xs text-slate-500 truncate">{sb.code} &middot; Cuenca: {sb.basinName ?? 'N/A'}{sb.area ? ` &middot; ${sb.area.toFixed(1)} km2` : ''}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded border ${sb.isActive ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-slate-500 bg-slate-700/30 border-slate-600'}`}>
                                {sb.isActive ? 'activo' : 'inactivo'}
                            </span>
                            <button onClick={() => toggleMutation.mutate(sb.id)} className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-md transition-colors" title="Toggle activo">
                                <Power size={14} />
                            </button>
                            <button onClick={() => openEdit(sb)} className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-colors" title="Editar">
                                <Pencil size={14} />
                            </button>
                            <button onClick={() => setConfirmDeleteId(sb.id)} className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors" title="Eliminar">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {subBasins.length === 0 && <p className="text-center text-slate-600 py-8">No hay subcuencas registradas</p>}
            </div>

            {/* Create / Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-100">{editingItem ? 'Editar subcuenca' : 'Nueva subcuenca'}</h3>
                            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: ENTREPE&Ntilde;AS" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Codigo *</label>
                                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: E_01" />
                            </div>
                            {!editingItem && (
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Cuenca *</label>
                                    <SearchableSelect
                                        options={basinOptions}
                                        value={form.basinId}
                                        onChange={(val) => setForm({ ...form, basinId: val })}
                                        placeholder="Seleccionar cuenca"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Opcional" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700/50">
                            {(createMutation.isError || updateMutation.isError) && (
                                <p className="text-xs text-red-400 mr-auto">Error al guardar</p>
                            )}
                            <button onClick={closeForm} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button onClick={handleSubmit} disabled={!form.name || !form.code || (!editingItem && !form.basinId) || isPending} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
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
                        <p className="text-sm text-slate-200 mb-4">Estas seguro de que deseas eliminar esta subcuenca?</p>
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
