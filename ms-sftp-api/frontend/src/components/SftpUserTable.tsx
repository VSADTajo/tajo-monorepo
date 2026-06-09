import { Link } from 'react-router-dom';
import type { SftpUser } from '../types/sftp-user.types';
import { StatusToggle } from './StatusToggle';

interface SftpUserTableProps {
    users: SftpUser[];
    onToggle: (id: string, isActive: boolean) => void;
    onDelete: (id: string) => void;
    isToggling?: boolean;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'hace un momento';
    if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)}h`;
    return `hace ${Math.floor(diff / 86_400_000)} días`;
}

export function SftpUserTable({ users, onToggle, onDelete, isToggling }: SftpUserTableProps) {
    if (users.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500 text-sm">No hay usuarios SFTP configurados aún.</p>
                <Link
                    to="/sftp-users/create"
                    className="mt-4 inline-block bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                    Crear el primer usuario
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Directorio raíz</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 flex-shrink-0">
                                        <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </span>
                                    <span className="text-sm font-mono text-gray-900">{user.username}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                {user.rootDirectory}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                    <StatusToggle
                                        isActive={user.isActive}
                                        onToggle={(active) => onToggle(user.id, active)}
                                        disabled={isToggling}
                                    />
                                    <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {user.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span title={new Date(user.createdAt).toLocaleString()}>
                                    {relativeTime(user.createdAt)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                                <Link
                                    to={`/sftp-users/${user.id}/edit`}
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                    Editar
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`¿Eliminar usuario SFTP "${user.username}"?`)) {
                                            onDelete(user.id);
                                        }
                                    }}
                                    className="text-red-600 hover:text-red-900 font-medium"
                                >
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
