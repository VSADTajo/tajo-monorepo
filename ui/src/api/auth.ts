import axios from 'axios';

// API Gateway base URL — gateway runs on port 80
const API_GATEWAY_URL =
  import.meta.env.VITE_URL_API_GATEWAY ||
  import.meta.env.AUTH_URL_API_GATEWAY ||
  'http://65.21.97.113';

export const TOKEN_KEY = 'token';
export const REFRESH_TOKEN_KEY = 'refreshToken';

const LOGIN_ENDPOINT = `${API_GATEWAY_URL}/auth/login`;
const REFRESH_ENDPOINT = `${API_GATEWAY_URL}/auth/refresh`;
const VALIDATE_ENDPOINT = `${API_GATEWAY_URL}/auth/validate`;
const LOGOUT_ENDPOINT = `${API_GATEWAY_URL}/auth/logout`;

export interface LoginResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  token?: string;
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
}

// Login: POST {API_GATEWAY_URL}/auth/login
export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await axios.post<LoginResponse>(
    LOGIN_ENDPOINT,
    {
      email,
      password,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  const token = data.accessToken ?? data.access_token ?? data.token;
  if (!token) {
    throw new Error('No token in response');
  }
  const refreshToken = data.refreshToken ?? data.refresh_token;
  return { token, refreshToken };
}

// Validar token: POST .../auth/validate
export async function validateToken(token: string): Promise<boolean> {
  try {
    const { data } = await axios.post<{ valid: boolean }>(
      VALIDATE_ENDPOINT,
      { token },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    return !!data.valid;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      return false;
    }
    throw err;
  }
}

// Refresh token: POST .../auth/refresh
export async function refreshAccessToken(refreshToken: string): Promise<LoginResult> {
  const { data } = await axios.post<LoginResponse>(
    REFRESH_ENDPOINT,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  const token = data.accessToken ?? data.access_token ?? data.token;
  if (!token) {
    throw new Error('No token in refresh response');
  }
  const newRefreshToken = data.refreshToken ?? data.refresh_token;
  return { token, refreshToken: newRefreshToken };
}

// Logout: POST .../auth/logout (best-effort)
export async function serverLogout(token: string): Promise<void> {
  try {
    await axios.post(
      LOGOUT_ENDPOINT,
      { token },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch {
    // Ignorar errores de logout remoto; se seguirá limpiando el cliente
  }
}

/** Limpia tokens en localStorage. */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Intenta refrescar usando el refreshToken almacenado. */
export async function tryRefreshAndGetToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    clearAuth();
    return null;
  }
  try {
    const result = await refreshAccessToken(refreshToken);
    localStorage.setItem(TOKEN_KEY, result.token);
    if (result.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    }
    return result.token;
  } catch {
    clearAuth();
    return null;
  }
}
