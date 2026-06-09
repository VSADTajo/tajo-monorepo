import { Router } from "express";
import { LogController } from "../controllers/log.controller";
import { upload } from "../middlewares/multer.middleware";

const logRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LogLevel:
 *       type: string
 *       enum: [info, warning, error]
 *       description: Log severity level
 *
 *     Log:
 *       type: object
 *       properties:
 *         _id: { type: string, description: Unique identifier }
 *         level: { $ref: '#/components/schemas/LogLevel' }
 *         message: { type: string }
 *         entity: { type: string, description: Business entity or aggregate (e.g., order, user) }
 *         source: { type: string, nullable: true }
 *         meta: { type: object, additionalProperties: true, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     CreateLogRequest:
 *       type: object
 *       required: [message]
 *       properties:
 *         level: { $ref: '#/components/schemas/LogLevel' }
 *         message: { type: string }
 *         entity: { type: string, description: Business entity or aggregate }
 *         source: { type: string }
 *         meta: { type: object, additionalProperties: true }
 *
 *     Error:
 *       type: object
 *       properties:
 *         message: { type: string }
 */

/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: Create a new log entry
 *     description: Create a log entry with optional file attachment. Only message is required.
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [message, entity]
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [info, warning, error]
 *                 description: Log severity level
 *               message:
 *                 type: string
 *                 description: Log message
 *               entity:
 *                 type: string
 *                 description: Business entity or aggregate
 *               source:
 *                 type: string
 *                 description: Source of the log
 *               meta:
 *                 type: string
 *                 description: Additional metadata (JSON string)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (CSV, XML, JSON, PDF, etc.)
 *     responses:
 *       201:
 *         description: Log created successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Log' }
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.post("/", upload.single("file"), LogController.createLog);

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get all logs
 *     description: List all log entries (newest first).
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Log' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.get("/", LogController.getLogs);

/**
 * @swagger
 * /api/logs/filter:
 *   get:
 *     summary: Get logs with filters
 *     description: Retrieve logs filtered by entity and/or date range (createdAt between dateFrom and dateTo)
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *         required: false
 *         description: Entity name to filter by
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warning, error]
 *         required: false
 *         description: Log level to filter by
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: ISO date to filter from (inclusive)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: ISO date to filter to (inclusive)
 *     responses:
 *       200:
 *         description: Successfully retrieved filtered logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Log' }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.get("/filter", LogController.getLogsFiltered);

/**
 * @swagger
 * /api/logs/count:
 *   get:
 *     summary: Get total count of logs
 *     description: Returns the total number of log entries in the database
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved total count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   description: Total number of logs
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.get("/count", LogController.getTotalCount);

/**
 * @swagger
 * /api/logs/count/{entity}:
 *   get:
 *     summary: Get count of logs by entity
 *     description: Returns the total number of log entries for a specific entity
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: entity
 *         schema:
 *           type: string
 *         required: true
 *         description: Entity name
 *     responses:
 *       200:
 *         description: Successfully retrieved count for entity
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   description: Total number of logs for the entity
 *       400:
 *         description: Bad request - Entity parameter is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.get("/count/:entity", LogController.getCountByEntity);

/**
 * @swagger
 * /api/logs/entities:
 *   get:
 *     summary: Get all unique entities
 *     description: Returns an array of all unique entity names present in the database
 *     tags: [Logs]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of entities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Predictions", "Notifications", "Stations"]
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
logRouter.get("/entities", LogController.getAllEntities);

export default logRouter;
