import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStationOptions } from './api';
import type { StationOption } from '../../types/prediction-types';

interface StationAutocompleteProps {
    onSelect: (stationCode: string) => void;
}

const MAX_SUGGESTIONS = 8;

export default function StationAutocomplete({ onSelect }: StationAutocompleteProps) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const blurTimeout = useRef<number | undefined>(undefined);

    const { data: stations = [] } = useQuery({
        queryKey: ['station-options'],
        queryFn: getStationOptions,
        staleTime: 5 * 60 * 1000,
    });

    const suggestions = useMemo(() => {
        const q = input.trim().toLowerCase();
        if (!q) return stations.slice(0, MAX_SUGGESTIONS);
        return stations
            .filter(
                (s) =>
                    s.stationCode.toLowerCase().includes(q) ||
                    (s.name ?? '').toLowerCase().includes(q),
            )
            .slice(0, MAX_SUGGESTIONS);
    }, [input, stations]);

    const choose = (option: StationOption) => {
        setInput(option.stationCode);
        setOpen(false);
        onSelect(option.stationCode);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const code = input.trim();
        if (code) {
            setOpen(false);
            onSelect(code);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative flex gap-2 items-center">
            <div className="relative max-w-xs flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        // Delay so a click on a suggestion registers before the list closes.
                        blurTimeout.current = window.setTimeout(() => setOpen(false), 150);
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Código o nombre de estación (ej. E_01)"
                    autoComplete="off"
                />
                {open && suggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                        {suggestions.map((s) => (
                            <li key={s.stationCode}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        // onMouseDown fires before blur — keeps the selection reliable.
                                        e.preventDefault();
                                        window.clearTimeout(blurTimeout.current);
                                        choose(s);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between gap-3"
                                >
                                    <span className="font-medium text-slate-100">{s.stationCode}</span>
                                    {s.name && <span className="text-slate-400 truncate">{s.name}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <button
                type="submit"
                disabled={!input.trim()}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
            >
                Consultar
            </button>
        </form>
    );
}
