import { useState } from 'react';
import { Plus, Pencil, Trash2, Power, X, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBasins, createBasin, updateBasin, toggleBasin, deleteBasin } from './api';
import type { Basin } from '../../types/hydro';

interface BasinForm {
    name: string;
    code: string;
    description: string;
}

const emptyForm: BasinForm = { name: '', code: '', description: '' };

export default function BasinsTab() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingBasin, setEditingBasin] = useState<Basin | null>(null);
    const [form, setForm] = useState<BasinForm>(emptyForm);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['basins'],
        queryFn: listBasins,
        staleTime: 2 * 60 * 1000,
    });

    const allBasins = data?.items ?? [];
    const basins = search
        ? allBasins.filter((b) => `${b.name} ${b.code} ${b.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))
        : allBasins;

    const createMutation = useMutation({
        mutationFn: () => createBasin({ name: form.name, code: form.code, description: form.description || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['basins'] });
            closeForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: () => updateBasin(editingBasin!.id, { name: form.name, code: form.code, description: form.description || null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['basins'] });
            closeForm();
        },
    });

    const toggleMutation = useMutation({
        mutationFn: toggleBasin,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['basins'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteBasin,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['basins'] });
            setConfirmDeleteId(null);
        },
    });

    function openCreate() {
        setEditingBasin(null);
        setForm(emptyForm);
        setShowForm(true);
    }

    function openEdit(basin: Basin) {
        setEditingBasin(basin);
        setForm({ name: basin.name, code: basin.code, description: basin.description ?? '' });
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingBasin(null);
        setForm(emptyForm);
    }

    function handleSubmit() {
        if (editingBasin) updateMutation.mutate();
        else createMutation.mutate();
    }

    const isPending = createMutation.isPending || updateMutation.isPending;

    if (isLoading) return <p className="text-center text-slate-500 py-8">Cargando cuencas...</p>;

    return (
        <>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-200 shrink-0">Cuencas ({basins.length})</h2>
                <div className="flex gap-2 flex-1 justify-end items-center">
                    <div className="relative max-w-xs min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                            placeholder="Buscar cuenca..."
                        />
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg font-medium transition-colors shrink-0">
                        <Plus size={14} /> Nueva cuenca
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {basins.map((basin) => (
                    <div key={basin.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{basin.name}</p>
                                <p className="text-xs text-slate-500 truncate">{basin.code}{basin.description ? ` - ${basin.description}` : ''}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded border ${basin.isActive ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-slate-500 bg-slate-700/30 border-slate-600'}`}>
                                {basin.isActive ? 'activo' : 'inactivo'}
                            </span>
                            <button onClick={() => toggleMutation.mutate(basin.id)} className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-md transition-colors" title="Toggle activo">
                                <Power size={14} />
                            </button>
                            <button onClick={() => openEdit(basin)} className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-colors" title="Editar">
                                <Pencil size={14} />
                            </button>
                            <button onClick={() => setConfirmDeleteId(basin.id)} className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors" title="Eliminar">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {basins.length === 0 && <p className="text-center text-slate-600 py-8">No hay cuencas registradas</p>}
            </div>

            {/* Create / Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-sm font-semibold text-slate-100">{editingBasin ? 'Editar cuenca' : 'Nueva cuenca'}</h3>
                            <button onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: Cabecera" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Codigo *</label>
                                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500" placeholder="Ej: CABECERA" />
                            </div>
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
                            <button onClick={handleSubmit} disabled={!form.name || !form.code || isPending} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                                {isPending ? 'Guardando...' : editingBasin ? 'Guardar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-5">
                        <p className="text-sm text-slate-200 mb-4">Estas seguro de que deseas eliminar esta cuenca?</p>
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
