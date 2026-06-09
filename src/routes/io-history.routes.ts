import { Router } from "express";
import { IOHistoryController } from "../controllers/io-history.controller";

const ioHistoryRouter = Router();

/**
 * @swagger
 * /api/io-history/input:
 *   get:
 *     summary: List input files
 *     description: List all input files (sent to model) with optional filters
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [WRF, ECMWF, SMC]
 *         description: Filter by provider
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *         description: Filter from date (YYYYMMDDHH)
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *         description: Filter to date (YYYYMMDDHH)
 *       - in: query
 *         name: ensemble
 *         schema:
 *           type: string
 *         description: Filter by ensemble (ECMWF only)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of input files
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/input", IOHistoryController.listInputFiles);

/**
 * @swagger
 * /api/io-history/output:
 *   get:
 *     summary: List output files
 *     description: List all output files (received from model) with optional filters
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [WRF, ECMWF, SMC]
 *         description: Filter by provider
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *         description: Filter from date (YYYYMMDDHH)
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *         description: Filter to date (YYYYMMDDHH)
 *       - in: query
 *         name: ensemble
 *         schema:
 *           type: string
 *         description: Filter by ensemble (ECMWF only)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of output files
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/output", IOHistoryController.listOutputFiles);

/**
 * @swagger
 * /api/io-history/metadata:
 *   get:
 *     summary: Get IO History metadata
 *     description: Get global metadata for input and output files
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: IO History metadata
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/metadata", IOHistoryController.getMetadata);

/**
 * @swagger
 * /api/io-history/providers:
 *   get:
 *     summary: Get available providers
 *     description: Get list of providers with file counts
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Available providers
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/providers", IOHistoryController.getProviders);

/**
 * @swagger
 * /api/io-history/simulation-dates:
 *   get:
 *     summary: Get available simulation dates
 *     description: Get list of unique simulation dates
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: io_type
 *         schema:
 *           type: string
 *           enum: [input, output]
 *         description: Filter by IO type
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [WRF, ECMWF, SMC]
 *         description: Filter by provider
 *     responses:
 *       200:
 *         description: Available simulation dates
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/simulation-dates", IOHistoryController.getSimulationDates);

/**
 * @swagger
 * /api/io-history/input/{provider}/{filename}/download:
 *   get:
 *     summary: Download input file
 *     description: Download an input file in the specified format
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider name (WRF, ECMWF, SMC)
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Filename (e.g., job_123_2026021312.parquet)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [original, csv, json, parquet]
 *           default: original
 *         description: Download format
 *     responses:
 *       200:
 *         description: File download
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/input/:provider/:filename/download", IOHistoryController.downloadInputFile);

/**
 * @swagger
 * /api/io-history/output/{provider}/{filename}/download:
 *   get:
 *     summary: Download output file
 *     description: Download an output file in the specified format
 *     tags: [IO History]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider name (WRF, ECMWF, SMC)
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Filename (e.g., job_123_2026021312.parquet)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [original, csv, json, parquet]
 *           default: original
 *         description: Download format
 *     responses:
 *       200:
 *         description: File download
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
ioHistoryRouter.get("/output/:provider/:filename/download", IOHistoryController.downloadOutputFile);

export default ioHistoryRouter;
