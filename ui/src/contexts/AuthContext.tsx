import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  clearAuth,
  serverLogout,
  tryRefreshAndGetToken,
  type LoginResult,
} from '../api/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (result: LoginResult) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((result: LoginResult) => {
    localStorage.setItem(TOKEN_KEY, result.token);
    if (result.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    }
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Best-effort: invalidar token en el gateway, pero no bloquea el logout local
      serverLogout(token);
    }
    clearAuth();
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token && !refreshToken) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (refreshToken) {
          const newToken = await tryRefreshAndGetToken();
          if (cancelled) return;
          setIsAuthenticated(!!newToken);
        } else {
          setIsAuthenticated(!!token);
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
