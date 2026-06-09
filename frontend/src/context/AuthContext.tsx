import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { loginUser } from '../api/auth.api';

const ACCESS_TOKEN_KEY = 'sftp_access_token';
const REFRESH_TOKEN_KEY = 'sftp_refresh_token';

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem(ACCESS_TOKEN_KEY));
    const [isLoading, setIsLoading] = useState(false);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await loginUser(email, password);
            localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
            setIsAuthenticated(true);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setIsAuthenticated(false);
    };

    const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, getAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
