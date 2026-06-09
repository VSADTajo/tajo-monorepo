import { useState } from 'react';
import { Plus, Trash2, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGroups, createGroup, deleteGroup, listRoles, assignRoleToGroup, removeRoleFromGroup } from './api';

function GroupRolesRow({ groupId, roles: initialRoles }: { groupId: string; roles: Array<{ id: string; name: string; description?: string | null }> }) {
    const [expanded, setExpanded] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const queryClient = useQueryClient();

    const { data: allRoles = [] } = useQuery({ queryKey: ['roles'], queryFn: listRoles, staleTime: 5 * 60 * 1000 });

    const assignMutation = useMutation({
        mutationFn: () => assignRoleToGroup(groupId, selectedRoleId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); setSelectedRoleId(''); },
    });

    const removeMutation = useMutation({
        mutationFn: (roleId: string) => removeRoleFromGroup(groupId, roleId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
    });

    const availableRoles = allRoles.filter((r) => !initialRoles.some((gr) => gr.id === r.id));

    return (
        <div className="border-t border-slate-700/50 bg-slate-800/30">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Ocultar roles' : `Gestionar roles (${initialRoles.length})`}
            </button>

            {expanded && (
                <div className="px-4 pb-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                        {initialRoles.length === 0 && <span className="text-xs text-slate-600">Sin roles asignados</span>}
                        {initialRoles.map((role) => (
                            <span key={role.id} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
                                {role.name}
                                <button onClick={() => removeMutation.mutate(role.id)} className="hover:text-red-400 transition-colors">
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                    </div>
                    {availableRoles.length > 0 && (
                        <div className="flex gap-2">
                            <select
                                value={selectedRoleId}
                                onChange={(e) => setSelectedRoleId(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                            >
                                <option value="">Seleccionar rol a asignar...</option>
                                {availableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <button
                                onClick={() => assignMutation.mutate()}
                                disabled={!selectedRoleId || assignMutation.isPending}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
                            >
                                Asignar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function GroupsTab() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', description: '' });

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['groups'],
        queryFn: listGroups,
        staleTime: 5 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: () => createGroup(form.name.trim(), form.description.trim() || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setShowForm(false);
            setForm({ name: '', description: '' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteGroup(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setConfirmDeleteId(null);
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">Grupos ({groups.length})</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium transition-colors"
                >
                    <Plus size={14} />
                    Nuevo grupo
                </button>
            </div>

            {isLoading ? (
                <div className="text-center text-slate-500 text-sm py-12">Cargando grupos...</div>
            ) : groups.length === 0 ? (
                <div className="text-center py-12">
                    <Users size={32} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay grupos. Crea el primero.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {groups.map((group) => (
                        <div key={group.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                        <Users size={14} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">{group.name}</p>
                                        {group.description && <p className="text-xs text-slate-500">{group.description}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                                        {group.roles.length} roles
                                    </span>
                                    <button
                                        onClick={() => setConfirmDeleteId(group.id)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md p-1.5 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <GroupRolesRow groupId={group.id} roles={group.roles} />
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                        <h3 className="text-slate-100 font-semibold text-base">Eliminar grupo</h3>
                        <p className="text-sm text-slate-400">
                            Se eliminara el grupo y todas sus asignaciones de roles y usuarios. No se puede deshacer.
                        </p>
                        {deleteMutation.isError && <p className="text-red-400 text-xs">Error al eliminar el grupo.</p>}
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button
                                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                            <h2 className="text-slate-100 font-semibold text-base">Crear grupo</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200">
                                <span className="text-lg">&times;</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="ej. supervisores-campo"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                                <input
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Descripcion opcional"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            {createMutation.isError && <p className="text-red-400 text-xs">Error: el nombre puede ya existir.</p>}
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700">
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={createMutation.isPending || !form.name.trim()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                {createMutation.isPending ? 'Creando...' : 'Crear grupo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
