import { NextFunction, Request, Response } from "express";

// API Gateway base URL; fallback a valor legacy si no está definido
const API_GATEWAY_URL =
  process.env.URL_API_GATEWAY ||
  process.env.AUTH_API_URL ||
  "http://localhost:3000";

// Endpoint del gateway para validar tokens (sin prefijo api/v1)
const TOKEN_VALIDATE_URL = `${API_GATEWAY_URL}/auth/validate`;

/**
 * Validates authentication via:
 * 1. API Key: header "x-api-key" matching X_API_KEY env var (fast, no external call)
 * 2. Bearer token: validates against ThingsBoard /api/auth/user endpoint
 * If neither is valid, responds 401.
 */
export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.X_API_KEY;

  // Option 1: API Key authentication (preferred, faster)
  if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
    next();
    return;
  }

  // Option 2: Bearer token authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  let token = authHeader.slice(7).trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const response = await fetch(TOKEN_VALIDATE_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      console.warn("[auth] validate failed:", response.status, await response.text().catch(() => ""));
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const data = (await response.json()) as { valid?: boolean };
    if (!data.valid) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    next();
  } catch (err) {
    console.warn("[auth] validate request failed:", err instanceof Error ? err.message : err);
    res.status(401).json({ message: "Unauthorized" });
  }
}
