import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller";

const reportsRouter = Router();

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: List reports
 *     description: List report files from scheduler (PREV_CAB DAT). Filter by provider (WRF/ECMWF) and simulation_date (YYYYMMDDHH). Pagination via limit/offset.
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema: { type: string, enum: [WRF, ECMWF], default: WRF }
 *       - in: query
 *         name: simulation_date
 *         schema: { type: string, description: YYYYMMDDHH }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of report files and total_count
 *       500:
 *         description: Internal server error
 */
reportsRouter.get("/", ReportsController.listReports);

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate report
 *     description: Execute scheduler task to generate the latest PREV_CAB report
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Force execution even if scheduler is paused
 *     responses:
 *       200:
 *         description: Task execution response
 *       500:
 *         description: Internal server error
 */
reportsRouter.post("/generate", ReportsController.generateReport);

/**
 * @swagger
 * /api/reports/{filename}:
 *   get:
 *     summary: Download report
 *     description: Download a report file by filename
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Report filename returned by listReports
 *     responses:
 *       200:
 *         description: File download
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
reportsRouter.get("/:filename", ReportsController.downloadReport);

/**
 * @swagger
 * /api/reports/{filename}:
 *   delete:
 *     summary: Delete report
 *     description: Delete a report file by filename (proxy to scheduler)
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: File deleted
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
reportsRouter.delete("/:filename", ReportsController.deleteReport);

export default reportsRouter;

