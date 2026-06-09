import { useState } from 'react';
import { Shield } from 'lucide-react';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';
import { PermissionsTab } from './PermissionsTab';
import { GroupsTab } from './GroupsTab';

type Tab = 'users' | 'permissions' | 'roles' | 'groups';

const TAB_LABELS: Record<Tab, string> = {
    users: 'Usuarios',
    permissions: 'Permisos',
    roles: 'Roles',
    groups: 'Grupos',
};

export function AdministrationPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('users');

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-100">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                        <Shield size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">Administracion</h1>
                        <p className="text-xs text-slate-400">Gestion de usuarios, permisos, roles y grupos</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-4">
                    {(['users', 'permissions', 'roles', 'groups'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                        >
                            {TAB_LABELS[tab]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'permissions' && <PermissionsTab />}
                {activeTab === 'roles' && <RolesTab />}
                {activeTab === 'groups' && <GroupsTab />}
            </div>
        </div>
    );
}
