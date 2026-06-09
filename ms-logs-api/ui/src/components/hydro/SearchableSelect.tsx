import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Seleccionar...', className = '' }: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

    const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()),
    );

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function select(val: string) {
        onChange(val);
        setOpen(false);
        setSearch('');
    }

    function clear(e: React.MouseEvent) {
        e.stopPropagation();
        onChange('');
        setSearch('');
    }

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => { setOpen(!open); setSearch(''); }}
                className="w-full flex items-center gap-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 text-left"
            >
                <span className="flex-1 truncate">{selectedLabel || placeholder}</span>
                {value ? (
                    <X size={12} className="text-slate-500 hover:text-slate-300 shrink-0" onClick={clear} />
                ) : (
                    <ChevronDown size={12} className="text-slate-500 shrink-0" />
                )}
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border-b border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        placeholder="Buscar..."
                    />
                    <div className="max-h-48 overflow-auto">
                        {filtered.length === 0 && (
                            <p className="px-3 py-2 text-xs text-slate-500">Sin resultados</p>
                        )}
                        {filtered.map((o) => (
                            <button
                                key={o.value}
                                onClick={() => select(o.value)}
                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                    o.value === value
                                        ? 'bg-cyan-500/20 text-cyan-300'
                                        : 'text-slate-300 hover:bg-slate-700/50'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
