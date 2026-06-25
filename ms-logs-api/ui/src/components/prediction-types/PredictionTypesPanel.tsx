import { useState, type FormEvent } from 'react';
import { Gauge, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getPredictionTypesByStation } from './api';

export default function PredictionTypesPanel() {
    const [codeInput, setCodeInput] = useState('');
    const [stationCode, setStationCode] = useState('');

    const { data, isFetching, isError, error } = useQuery({
        queryKey: ['prediction-types-by-station', stationCode],
        queryFn: () => getPredictionTypesByStation(stationCode),
        enabled: !!stationCode,
        staleTime: 60 * 1000,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const code = codeInput.trim();
        if (code) setStationCode(code);
    };

    const types = data?.predictionTypes ?? [];

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                        <Gauge className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Prediction Types por estación</h1>
                        <p className="text-xs text-slate-400">Types con datos disponibles para una estación</p>
                    </div>
                </div>

                {/* Search form */}
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                    <div className="relative max-w-xs flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                            placeholder="Código de estación (ej. A001)"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!codeInput.trim()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                    >
                        Consultar
                    </button>
                </form>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {!stationCode && (
                    <p className="text-center text-slate-500 py-8">
                        Ingresá un código de estación para ver sus prediction types con datos.
                    </p>
                )}

                {stationCode && isFetching && (
                    <p className="text-center text-slate-500 py-8">Cargando types de {stationCode}…</p>
                )}

                {stationCode && !isFetching && isError && (
                    <p className="text-center text-red-400 py-8">
                        Error al consultar: {error instanceof Error ? error.message : 'intento fallido'}
                    </p>
                )}

                {stationCode && !isFetching && !isError && data && (
                    <>
                        <h2 className="text-sm font-semibold text-slate-200 mb-4">
                            Estación {data.stationCode} — {types.length} {types.length === 1 ? 'type' : 'types'} con datos
                        </h2>
                        {types.length === 0 ? (
                            <p className="text-center text-slate-600 py-8">
                                La estación {data.stationCode} no tiene types con datos.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {types.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-center gap-3 px-4 py-3 border border-slate-700/50 rounded-lg bg-slate-800/60"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-200">{t.name}</p>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded border text-indigo-300 bg-indigo-400/10 border-indigo-500/30">
                                            {t.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
