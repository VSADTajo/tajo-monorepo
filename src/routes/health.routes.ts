import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import os from "os";

const healthRouter = Router();

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
  };
  system: {
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
    };
  };
}

interface ServiceHealth {
  status: "up" | "down" | "degraded";
  responseTime?: number;
  details?: string;
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get system health status
 *     description: Returns health information about the API and its dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                 system:
 *                   type: object
 */
healthRouter.get("/", async (_req: Request, res: Response) => {
  const startTime = Date.now();

  // Check database connection
  let dbStatus: ServiceHealth = { status: "down" };
  try {
    const dbStart = Date.now();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping();
      dbStatus = {
        status: "up",
        responseTime: Date.now() - dbStart,
      };
    } else {
      dbStatus = {
        status: "down",
        details: "Database connection not established",
      };
    }
  } catch (error) {
    dbStatus = {
      status: "down",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Calculate memory usage
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  // Build health response
  const health: HealthStatus = {
    status: dbStatus.status === "up" ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    services: {
      api: {
        status: "up",
        responseTime: Date.now() - startTime,
      },
      database: dbStatus,
    },
    system: {
      memory: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        usagePercent: Math.round((usedMemory / totalMemory) * 100),
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
    },
  };

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

export default healthRouter;
