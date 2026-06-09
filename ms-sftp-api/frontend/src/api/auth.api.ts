const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    tokenType: string;
    refreshExpiresIn: string;
}

async function extractErrorMessage(res: Response): Promise<string> {
    try {
        const body = await res.json();
        return body.ErrorDescription || body.message || res.statusText;
    } catch {
        return res.statusText;
    }
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${AUTH_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<LoginResponse> {
    const res = await fetch(`${AUTH_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    return res.json();
}
