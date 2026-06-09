import { TOKEN_KEY } from '../api/auth';

interface JwtPayload {
    sub: string;
    roles: string[];
    type?: string;
    iat?: number;
    exp?: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(payload) as JwtPayload;
    } catch {
        return null;
    }
}

export function getCurrentUserRoles(): string[] {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return [];
    const payload = decodeJwtPayload(token);
    return payload?.roles ?? [];
}

export function isAdmin(): boolean {
    return getCurrentUserRoles().includes('admin');
}
