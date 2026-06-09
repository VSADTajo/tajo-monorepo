import { useState } from 'react';
import { Droplets } from 'lucide-react';
import BasinsTab from './BasinsTab';
import SubBasinsTab from './SubBasinsTab';
import StationsTab from './StationsTab';

type Tab = 'basins' | 'sub-basins' | 'stations';

const TAB_LABELS: Record<Tab, string> = {
    basins: 'Cuencas',
    'sub-basins': 'Subcuencas',
    stations: 'Estaciones',
};

export default function HydroPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('stations');

    return (
        <div className="h-full flex flex-col">
            <div className="border-b border-slate-700/50 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                        <Droplets className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Hidrologia</h1>
                        <p className="text-xs text-slate-400">Gestion de cuencas, subcuencas y estaciones</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    {(['basins', 'sub-basins', 'stations'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                        >
                            {TAB_LABELS[tab]}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'basins' && <BasinsTab />}
                {activeTab === 'sub-basins' && <SubBasinsTab />}
                {activeTab === 'stations' && <StationsTab />}
            </div>
        </div>
    );
}
