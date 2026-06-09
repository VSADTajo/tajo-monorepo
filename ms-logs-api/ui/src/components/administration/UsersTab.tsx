import { useState } from 'react';
import { UserPlus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRoles, listUsers, getUserRoles, assignRoleToUser, removeRoleFromUser, registerUser, deleteUser, listGroups, getUserGroups, assignGroupToUser, removeGroupFromUser } from './api';

interface CreateUserForm {
    name: string;
    email: string;
    password: string;
}

function UserRolesRow({ userId }: { userId: string }) {
    const [expanded, setExpanded] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState('');

    const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: listRoles, staleTime: 5 * 60 * 1000 });
    const { data: userRoles = [], refetch } = useQuery({
        queryKey: ['user-roles', userId],
        queryFn: () => getUserRoles(userId),
        enabled: expanded,
    });

    const assignMutation = useMutation({
        mutationFn: () => assignRoleToUser(userId, selectedRoleId),
        onSuccess: () => { refetch(); setSelectedRoleId(''); },
    });

    const removeMutation = useMutation({
        mutationFn: (roleId: string) => removeRoleFromUser(userId, roleId),
        onSuccess: () => refetch(),
    });

    const availableRoles = roles.filter((r) => !userRoles.some((ur) => ur.id === r.id));

    return (
        <div className="border-t border-slate-700/50 bg-slate-800/30">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Ocultar roles' : 'Gestionar roles'}
            </button>

            {expanded && (
                <div className="px-4 pb-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                        {userRoles.length === 0 && (
                            <span className="text-xs text-slate-600">Sin roles asignados</span>
                        )}
                        {userRoles.map((role) => (
                            <span
                                key={role.id}
                                className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300"
                            >
                                {role.name}
                                <button
                                    onClick={() => removeMutation.mutate(role.id)}
                                    className="hover:text-red-400 transition-colors"
                                >
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
                                {availableRoles.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
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

function UserGroupsRow({ userId }: { userId: string }) {
    const [expanded, setExpanded] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');

    const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: listGroups, staleTime: 5 * 60 * 1000 });
    const { data: userGroups = [], refetch } = useQuery({
        queryKey: ['user-groups', userId],
        queryFn: () => getUserGroups(userId),
        enabled: expanded,
    });

    const assignMutation = useMutation({
        mutationFn: () => assignGroupToUser(userId, selectedGroupId),
        onSuccess: () => { refetch(); setSelectedGroupId(''); },
    });

    const removeMutation = useMutation({
        mutationFn: (groupId: string) => removeGroupFromUser(userId, groupId),
        onSuccess: () => refetch(),
    });

    const availableGroups = groups.filter((g) => !userGroups.some((ug) => ug.id === g.id));

    return (
        <div className="border-t border-slate-700/50 bg-slate-800/30">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Ocultar grupos' : 'Gestionar grupos'}
            </button>

            {expanded && (
                <div className="px-4 pb-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                        {userGroups.length === 0 && <span className="text-xs text-slate-600">Sin grupos asignados</span>}
                        {userGroups.map((group) => (
                            <span key={group.id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                                {group.name}
                                <button onClick={() => removeMutation.mutate(group.id)} className="hover:text-red-400 transition-colors">
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                    </div>
                    {availableGroups.length > 0 && (
                        <div className="flex gap-2">
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Seleccionar grupo a asignar...</option>
                                {availableGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <button
                                onClick={() => assignMutation.mutate()}
                                disabled={!selectedGroupId || assignMutation.isPending}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
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

export function UsersTab() {
    const queryClient = useQueryClient();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState<CreateUserForm>({ name: '', email: '', password: '' });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: listUsers,
        staleTime: 2 * 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: () => registerUser(form.name, form.email, form.password),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowCreateForm(false);
            setForm({ name: '', email: '', password: '' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (userId: string) => deleteUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setConfirmDeleteId(null);
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">Usuarios ({users.length})</h2>
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium transition-colors"
                >
                    <UserPlus size={14} />
                    Nuevo usuario
                </button>
            </div>

            {isLoading && (
                <div className="text-center text-slate-500 text-sm py-8">Cargando usuarios...</div>
            )}

            {!isLoading && users.length === 0 && (
                <div className="text-center text-slate-600 text-sm py-8">No se encontraron usuarios</div>
            )}

            <div className="space-y-2">
                {users.map((user) => (
                    <div key={user.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
                            <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                                <span className="text-purple-300 text-sm font-semibold">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                            {user.status && (
                                <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${
                                    user.status === 'active'
                                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                                        : 'text-slate-400 bg-slate-700/50 border-slate-600/50'
                                }`}>
                                    {user.status === 'active' ? 'activo' : user.status}
                                </span>
                            )}
                            <button
                                onClick={() => setConfirmDeleteId(user.id)}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <UserRolesRow userId={user.id} />
                        <UserGroupsRow userId={user.id} />
                    </div>
                ))}
            </div>

            {/* Modal confirmación eliminación usuario */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                        <h3 className="text-slate-100 font-semibold text-base">Eliminar usuario</h3>
                        <p className="text-sm text-slate-400">
                            ¿Estás seguro? Esta acción eliminará el usuario permanentemente. No se puede deshacer.
                        </p>
                        {deleteMutation.isError && (
                            <p className="text-red-400 text-xs">Error al eliminar el usuario.</p>
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

            {showCreateForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                            <h2 className="text-slate-100 font-semibold text-base">Crear usuario</h2>
                            <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-200">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[
                                { label: 'Nombre completo *', key: 'name', type: 'text', placeholder: 'Juan Pérez' },
                                { label: 'Email *', key: 'email', type: 'email', placeholder: 'juan@ejemplo.com' },
                                { label: 'Contraseña *', key: 'password', type: 'password', placeholder: 'Mínimo 8 caracteres' },
                            ].map(({ label, key, type, placeholder }) => (
                                <div key={key}>
                                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                                    <input
                                        type={type}
                                        value={form[key as keyof CreateUserForm]}
                                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                        placeholder={placeholder}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            ))}
                            {createMutation.isError && (
                                <p className="text-red-400 text-xs">Error al crear el usuario. El email puede estar en uso.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700">
                            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={createMutation.isPending || !form.name || !form.email || !form.password}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
