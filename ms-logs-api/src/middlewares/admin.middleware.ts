import { NextFunction, Request, Response } from "express";

/**
 * Authorizes admin-only endpoints. Runs AFTER `validateToken` (which already authenticated the caller).
 *
 * Allowed when either:
 *  - the request used the privileged machine key (`x-api-key` === `X_API_KEY`), or
 *  - the Bearer JWT carries the `admin` role.
 *
 * The JWT signature was already validated upstream (gateway `/auth/validate`); here we only read
 * the roles claim from the payload to authorize.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers["x-api-key"];
    const expectedApiKey = process.env.X_API_KEY;
    if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    const roles = authHeader?.startsWith("Bearer ") ? rolesFromToken(authHeader.slice(7).trim()) : [];
    if (roles.includes("admin")) {
        next();
        return;
    }

    res.status(403).json({ success: false, error: "Forbidden: admin role required" });
}

function rolesFromToken(token: string): string[] {
    try {
        const parts = token.split(".");
        const payloadPart = parts[1];
        if (parts.length !== 3 || !payloadPart) return [];
        const payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf-8")) as { roles?: string[] };
        return Array.isArray(payload.roles) ? payload.roles : [];
    } catch {
        return [];
    }
}
