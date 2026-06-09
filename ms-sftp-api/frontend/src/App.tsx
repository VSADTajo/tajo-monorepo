import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './guards/AuthGuard';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SchemasListPage } from './pages/SchemasListPage';
import { SchemaCreatePage } from './pages/SchemaCreatePage';
import { SchemaEditPage } from './pages/SchemaEditPage';
import { SftpUsersListPage } from './pages/SftpUsersListPage';
import { SftpUserCreatePage } from './pages/SftpUserCreatePage';
import { SftpUserEditPage } from './pages/SftpUserEditPage';
import { PathsManagerPage } from './pages/PathsManagerPage';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

function App() {
    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            element={
                                <AuthGuard>
                                    <Layout />
                                </AuthGuard>
                            }
                        >
                            <Route path="/" element={<SchemasListPage />} />
                            <Route path="/schemas/create" element={<SchemaCreatePage />} />
                            <Route path="/schemas/:id/edit" element={<SchemaEditPage />} />
                            <Route path="/sftp-users" element={<SftpUsersListPage />} />
                            <Route path="/sftp-users/create" element={<SftpUserCreatePage />} />
                            <Route path="/sftp-users/:id/edit" element={<SftpUserEditPage />} />
                            <Route path="/paths" element={<PathsManagerPage />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </QueryClientProvider>
        </AuthProvider>
    );
}

export default App;
