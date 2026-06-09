import { useState } from 'react';
import { Key, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncPermissionsFromGateway, listPermissions } from './api';

const METHOD_COLORS: Record<string, string> = {
    GET: 'text-emerald-400 bg-emerald-400/10',
    POST: 'text-blue-400 bg-blue-400/10',
    PUT: 'text-yellow-400 bg-yellow-400/10',
    PATCH: 'text-orange-400 bg-orange-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
};

export function PermissionsTab() {
    const queryClient = useQueryClient();
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

    const { data: permissions = [], isLoading } = useQuery({
        queryKey: ['permissions'],
        queryFn: listPermissions,
        staleTime: 5 * 60 * 1000,
    });

    const syncMutation = useMutation({
        mutationFn: syncPermissionsFromGateway,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permissions'] }),
    });

    const toggleTag = (tag: string) => {
        setExpandedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
        });
    };

    // Group by tag
    const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
        const tag = p.tag || 'Other';
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push(p);
        return acc;
    }, {});
    const tags = Object.keys(grouped).sort();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">
                    Permisos ({permissions.length}) — auto-derivados del gateway
                </h2>
                <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
                    {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
                </button>
            </div>

            {syncMutation.isError && (
                <p className="text-red-400 text-xs">Error al sincronizar. Verifica que el gateway este activo.</p>
            )}

            {isLoading ? (
                <div className="text-center text-slate-500 text-sm py-12">Cargando permisos...</div>
            ) : permissions.length === 0 ? (
                <div className="text-center py-12">
                    <Key size={32} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay permisos sincronizados.</p>
                    <button
                        onClick={() => syncMutation.mutate()}
                        className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                    >
                        Sincronizar desde gateway
                    </button>
                </div>
            ) : (
                <div className="space-y-1">
                    {tags.map((tag) => {
                        const tagPermissions = grouped[tag];
                        const isExpanded = expandedTags.has(tag);
                        return (
                            <div key={tag} className="border border-slate-700/50 rounded-lg overflow-hidden">
                                <div
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-700/50 cursor-pointer select-none"
                                    onClick={() => toggleTag(tag)}
                                >
                                    {isExpanded ? (
                                        <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                    ) : (
                                        <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                    )}
                                    <span className="text-sm font-medium text-slate-200 flex-1">{tag}</span>
                                    <span className="text-xs text-slate-500">{tagPermissions.length} rutas</span>
                                </div>

                                {isExpanded && (
                                    <div className="divide-y divide-slate-700/30">
                                        {tagPermissions.map((p) => (
                                            <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                                                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[p.method] ?? 'text-slate-400 bg-slate-700'}`}>
                                                    {p.method}
                                                </span>
                                                <span className="text-xs font-mono text-slate-300 flex-1 truncate">{p.path}</span>
                                                {p.name && <span className="text-xs text-slate-500 truncate max-w-48">{p.name}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
