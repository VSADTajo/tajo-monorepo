import { useEffect, useState, useCallback } from 'react';
import { X, Search, Check, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createRole, listPermissions, getRolePermissions, syncRolePermissions } from './api';
import { Role } from '../../types/admin';

interface Props {
    role?: Role | null; // null = create mode
    onClose: () => void;
}

const METHOD_COLORS: Record<string, string> = {
    GET: 'text-emerald-400 bg-emerald-400/10',
    POST: 'text-blue-400 bg-blue-400/10',
    PUT: 'text-yellow-400 bg-yellow-400/10',
    PATCH: 'text-orange-400 bg-orange-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
};

export function RoleFormModal({ role, onClose }: Props) {
    const queryClient = useQueryClient();
    const isEdit = !!role;
    const isAdminRole = role?.name === 'admin';

    const [name, setName] = useState(role?.name ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    const { data: permissions = [], isLoading: loadingPermissions } = useQuery({
        queryKey: ['permissions'],
        queryFn: listPermissions,
        staleTime: 5 * 60 * 1000,
    });

    const { data: existingPerms = [] } = useQuery({
        queryKey: ['role-permissions', role?.id],
        queryFn: () => getRolePermissions(role!.id),
        enabled: isEdit,
    });

    useEffect(() => {
        if (existingPerms.length > 0) {
            setSelected(new Set(existingPerms.map((p) => p.id)));
        }
    }, [existingPerms]);

    const togglePermission = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const mutation = useMutation({
        mutationFn: async () => {
            let roleId = role?.id;
            if (!isEdit) {
                const created = await createRole(name.trim(), description.trim() || undefined);
                roleId = created.id;
            }
            const currentRoleName = isEdit ? role!.name : name.trim();
            await syncRolePermissions(roleId!, currentRoleName, Array.from(selected));
            return roleId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            if (isEdit) {
                queryClient.invalidateQueries({ queryKey: ['role-permissions', role!.id] });
            }
            onClose();
        },
    });

    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

    const toggleTag = useCallback((tag: string) => {
        setExpandedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
        });
    }, []);

    const selectAllByTag = useCallback((_tag: string, tagPerms: typeof permissions) => {
        setSelected((prev) => {
            const next = new Set(prev);
            const allSelected = tagPerms.every((p) => next.has(p.id));
            tagPerms.forEach((p) => {
                if (allSelected) next.delete(p.id);
                else next.add(p.id);
            });
            return next;
        });
    }, []);

    const filtered = permissions.filter(
        (p) =>
            p.path.toLowerCase().includes(search.toLowerCase()) ||
            p.method.toLowerCase().includes(search.toLowerCase()) ||
            (p.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (p.tag ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    // Group by tag
    const grouped = filtered.reduce<Record<string, typeof permissions>>((acc, p) => {
        const tag = p.tag || 'Other';
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push(p);
        return acc;
    }, {});
    const tags = Object.keys(grouped).sort();

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <h2 className="text-slate-100 font-semibold text-base">
                        {isEdit ? `Editar rol: ${role.name}` : 'Crear rol'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6 space-y-5">
                    {!isEdit && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nombre del rol *</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="ej. supervisor"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Descripcion</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descripcion opcional"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>
                    )}

                    {isAdminRole ? (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                            <ShieldCheck size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-300">Bypass de administrador</p>
                                <p className="text-xs text-amber-400/80 mt-1">
                                    El rol <span className="font-mono font-bold">admin</span> omite todas las verificaciones de permisos en el gateway.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-400">
                                    Permisos — {selected.size} seleccionados
                                </label>
                                <button
                                    onClick={() => setSelected(new Set())}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar permisos..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            {loadingPermissions ? (
                                <div className="text-center text-slate-500 text-sm py-8">Cargando permisos...</div>
                            ) : tags.length === 0 ? (
                                <div className="text-center text-slate-500 text-sm py-6">
                                    {permissions.length === 0 ? 'No hay permisos sincronizados. Sincroniza desde la tab "Permisos" primero.' : 'No se encontraron permisos'}
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-80 overflow-auto pr-1">
                                    {tags.map((tag) => {
                                        const tagPerms = grouped[tag];
                                        const isExpanded = expandedTags.has(tag);
                                        const allSelected = tagPerms.every((p) => selected.has(p.id));
                                        const someSelected = tagPerms.some((p) => selected.has(p.id));

                                        return (
                                            <div key={tag} className="border border-slate-700/50 rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/50 cursor-pointer select-none"
                                                    onClick={() => toggleTag(tag)}
                                                >
                                                    {isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                                                    <span className="text-sm font-medium text-slate-200 flex-1">{tag}</span>
                                                    <span className="text-xs text-slate-500">{tagPerms.length} rutas</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); selectAllByTag(tag, tagPerms); }}
                                                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                                            allSelected ? 'text-purple-300 bg-purple-500/20' : someSelected ? 'text-slate-300 bg-slate-600/50' : 'text-slate-500 hover:text-slate-300'
                                                        }`}
                                                    >
                                                        {allSelected ? 'Deseleccionar' : 'Seleccionar todo'}
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="divide-y divide-slate-700/30">
                                                        {tagPerms.map((perm) => {
                                                            const isChecked = selected.has(perm.id);
                                                            return (
                                                                <label key={perm.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 cursor-pointer">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                                        isChecked ? 'bg-purple-500 border-purple-500' : 'border-slate-600 bg-slate-800'
                                                                    }`}>
                                                                        {isChecked && <Check size={10} className="text-white" />}
                                                                    </div>
                                                                    <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => togglePermission(perm.id)} />
                                                                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[perm.method] ?? 'text-slate-400 bg-slate-700'}`}>
                                                                        {perm.method}
                                                                    </span>
                                                                    <span className="text-xs font-mono text-slate-300 flex-1 truncate">{perm.path}</span>
                                                                    {perm.name && <span className="text-xs text-slate-500 truncate max-w-32">{perm.name}</span>}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
                    {mutation.isError && (
                        <p className="text-red-400 text-xs">Error al guardar. Intenta de nuevo.</p>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                            Cancelar
                        </button>
                        {!isAdminRole && (
                            <button
                                onClick={() => mutation.mutate()}
                                disabled={mutation.isPending || (!isEdit && !name.trim())}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                            >
                                {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar permisos' : 'Crear rol'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
