import { Express } from "express";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export function setupSwagger(app: Express) {
  // Rutas relativas a cwd (raíz del proyecto); en dev son .ts, en prod dist/*.js
  const base = process.cwd();
  const apis = [
    path.join(base, "src", "routes", "*.ts"),
    path.join(base, "dist", "routes", "*.js"),
    path.join(base, "src", "controllers", "*.ts"),
    path.join(base, "dist", "controllers", "*.js"),
  ];

  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "API Logs",
        version: "1.0.0",
        description: "Servicio centralizado de logs para distintas entidades",
      },
      servers: [
        {
          url: process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`,
          description: "API Server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token obtained from ThingsBoard login endpoint",
          },
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API Key for service-to-service authentication",
          },
        },
      },
      security: [
        { BearerAuth: [] },
        { ApiKeyAuth: [] },
      ],
    },
    apis,
  };

  const swaggerSpec = swaggerJsdoc(options);

  // Monta Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
