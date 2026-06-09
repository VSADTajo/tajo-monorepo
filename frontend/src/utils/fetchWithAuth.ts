import { refreshAccessToken } from '../api/auth.api';

export const ACCESS_TOKEN_KEY = 'sftp_access_token';
export const REFRESH_TOKEN_KEY = 'sftp_refresh_token';

export function clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getTokenExpiry(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
        return null;
    }
}

async function proactiveRefreshIfNeeded(): Promise<void> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;

    const exp = getTokenExpiry(token);
    if (exp === null) return;

    const secondsRemaining = exp - Math.floor(Date.now() / 1000);
    if (secondsRemaining < 60) {
        await tryRefresh();
    }
}

async function tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
        const data = await refreshAccessToken(refreshToken);
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // 1. Proactive refresh: refresh if token expires within 60s
    await proactiveRefreshIfNeeded();

    // 2. Inject token
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    // 3. Make request
    const response = await fetch(input, { ...init, headers });

    // 4. Handle 401: attempt refresh + retry once
    if (response.status === 401) {
        const refreshed = await tryRefresh();
        if (!refreshed) {
            clearTokens();
            window.location.href = '/login';
            return response;
        }
        const newToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(input, { ...init, headers });
    }

    return response;
}
