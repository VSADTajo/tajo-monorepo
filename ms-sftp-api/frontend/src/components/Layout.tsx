import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function SidebarLink({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
            }
        >
            {children}
        </NavLink>
    );
}

export function Layout() {
    const { logout, getAccessToken } = useAuth();

    const copyToken = async () => {
        const token = getAccessToken();
        if (token) await navigator.clipboard.writeText(token);
    };

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 flex flex-col flex-shrink-0">
                <div className="px-4 py-5 border-b border-gray-700">
                    <h1 className="text-lg font-semibold text-white">SFTP Manager</h1>
                    <p className="text-xs text-gray-400 mt-1">File Mapping Engine</p>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
                    {/* Schemas Section */}
                    <div>
                        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Schemas
                        </p>
                        <div className="mt-2 space-y-1">
                            <SidebarLink to="/" end>
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                All Schemas
                            </SidebarLink>
                            <SidebarLink to="/schemas/create">
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                New Schema
                            </SidebarLink>
                        </div>
                    </div>

                    {/* Paths & Files Section */}
                    <div>
                        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Paths & Files
                        </p>
                        <div className="mt-2 space-y-1">
                            <SidebarLink to="/paths" end>
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                                </svg>
                                Paths & Files
                            </SidebarLink>
                        </div>
                    </div>

                    {/* SFTP Users Section */}
                    <div>
                        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            SFTP Users
                        </p>
                        <div className="mt-2 space-y-1">
                            <SidebarLink to="/sftp-users" end>
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                </svg>
                                All Users
                            </SidebarLink>
                            <SidebarLink to="/sftp-users/create">
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                                </svg>
                                New User
                            </SidebarLink>
                        </div>
                    </div>
                </nav>

                <div className="px-3 py-4 border-t border-gray-700 space-y-2">
                    <button
                        onClick={copyToken}
                        className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                        <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                        </svg>
                        Copiar Token
                    </button>
                    <button
                        onClick={logout}
                        className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-red-700 hover:text-white transition-colors"
                    >
                        <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        Salir
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-gray-50">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
