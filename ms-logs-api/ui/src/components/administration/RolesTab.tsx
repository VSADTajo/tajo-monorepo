import { useState } from 'react';
import { Plus, Edit2, Shield, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRoles, deleteRole } from './api';
import { RoleFormModal } from './RoleFormModal';
import { Role } from '../../types/admin';

export function RolesTab() {
    const queryClient = useQueryClient();
    const [modalRole, setModalRole] = useState<Role | null | undefined>(undefined); // undefined = cerrado
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: listRoles,
        staleTime: 5 * 60 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: (roleId: string) => deleteRole(roleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setConfirmDeleteId(null);
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">Roles ({roles.length})</h2>
                <button
                    onClick={() => setModalRole(null)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium transition-colors"
                >
                    <Plus size={14} />
                    Nuevo rol
                </button>
            </div>

            {isLoading ? (
                <div className="text-center text-slate-500 text-sm py-12">Cargando roles...</div>
            ) : roles.length === 0 ? (
                <div className="text-center py-12">
                    <Shield size={32} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay roles. Creá el primero.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                    <Shield size={14} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-200">{role.name}</p>
                                    {role.description && (
                                        <p className="text-xs text-slate-500">{role.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setModalRole(role)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-md transition-colors"
                                >
                                    <Edit2 size={12} />
                                    Editar permisos
                                </button>
                                {role.name !== 'admin' && (
                                    <button
                                        onClick={() => setConfirmDeleteId(role.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                                    >
                                        <Trash2 size={12} />
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal confirmación eliminación */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                        <h3 className="text-slate-100 font-semibold text-base">Eliminar rol</h3>
                        <p className="text-sm text-slate-400">
                            ¿Estás seguro? Esta acción eliminará el rol y lo desvinculará de todos los usuarios que lo tengan asignado. No se puede deshacer.
                        </p>
                        {deleteMutation.isError && (
                            <p className="text-red-400 text-xs">Error al eliminar el rol.</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
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

            {modalRole !== undefined && (
                <RoleFormModal role={modalRole} onClose={() => setModalRole(undefined)} />
            )}
        </div>
    );
}
