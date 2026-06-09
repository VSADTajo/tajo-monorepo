import { useState } from 'react';
import PreHistoricalConfig from './PreHistoricalConfig';
import StateFilesTable from './StateFilesTable';
import LisfloodStateFilesTable from './LisfloodStateFilesTable';
import { Server, Activity } from 'lucide-react';

type ActiveModel = 'hec-hms' | 'lisflood';

export default function BalancerPanel() {
  const [activeModel, setActiveModel] = useState<ActiveModel>('hec-hms');

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30">
                <Server className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Balancer Status</h1>
                <p className="text-slate-400">Monitor state files and pre-historical configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Live</span>
            </div>
          </header>

          {/* Model Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveModel('hec-hms')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeModel === 'hec-hms'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              HEC-HMS
            </button>
            <button
              onClick={() => setActiveModel('lisflood')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeModel === 'lisflood'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              Lisflood
            </button>
          </div>

          {activeModel === 'hec-hms' ? (
            <>
              {/* Configuration Section */}
              <section>
                <PreHistoricalConfig />
              </section>

              {/* State Files Section */}
              <section>
                <StateFilesTable />
              </section>
            </>
          ) : (
            <section>
              <LisfloodStateFilesTable />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
