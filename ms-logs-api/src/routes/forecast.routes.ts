import { Router } from "express";
import { ForecastController } from "../controllers/forecast.controller";

const forecastRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StrategyType:
 *       type: string
 *       enum: [smc, ecmwf, wrf]
 *       description: Forecast strategy type
 *
 *     JobType:
 *       type: string
 *       enum: [forecast, historical]
 *       description: Job type
 *
 *     ForecastEvent:
 *       type: object
 *       required: [date, time, value]
 *       properties:
 *         date:
 *           type: string
 *           description: Event date (YYYY-MM-DD)
 *           example: "2026-01-12"
 *         time:
 *           type: string
 *           description: Event time (HH:mm:ss)
 *           example: "12:00:00"
 *         value:
 *           type: number
 *           description: Forecast value
 *           example: 2.659270
 *         flag:
 *           type: string
 *           description: Optional event flag
 *           example: "0"
 *
 *     Forecast:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         basin:
 *           type: string
 *           description: Basin/Station identifier (locationId from XML)
 *           example: "EA001"
 *         strategy:
 *           $ref: '#/components/schemas/StrategyType'
 *         model:
 *           type: string
 *           description: Model used for processing
 *           example: "HEC-HMS"
 *         jobType:
 *           $ref: '#/components/schemas/JobType'
 *         parameterId:
 *           type: string
 *           description: Parameter identifier
 *           example: "Discharge_forecast"
 *         units:
 *           type: string
 *           description: Units of measurement
 *           example: "m3/s"
 *         events:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForecastEvent'
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Forecast start date
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Forecast end date
 *         jobId:
 *           type: string
 *           description: Reference to the job that generated this forecast
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CreateForecastRequest:
 *       type: object
 *       required: [basin, strategy, jobType, events]
 *       properties:
 *         basin:
 *           type: string
 *           description: Basin/Station identifier
 *           example: "EA001"
 *         strategy:
 *           $ref: '#/components/schemas/StrategyType'
 *         model:
 *           type: string
 *           example: "HEC-HMS"
 *         jobType:
 *           $ref: '#/components/schemas/JobType'
 *         parameterId:
 *           type: string
 *           example: "Discharge_forecast"
 *         units:
 *           type: string
 *           example: "m3/s"
 *         events:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ForecastEvent'
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         jobId:
 *           type: string
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/forecasts:
 *   post:
 *     summary: Create a new forecast entry
 *     description: Create a forecast entry with basin, strategy, events, and other metadata
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateForecastRequest'
 *     responses:
 *       201:
 *         description: Forecast created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Forecast'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.post("/", ForecastController.createForecast);

/**
 * @swagger
 * /api/forecasts/batch:
 *   post:
 *     summary: Create multiple forecast entries
 *     description: Create multiple forecast entries in a single request
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [forecasts]
 *             properties:
 *               forecasts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/CreateForecastRequest'
 *     responses:
 *       201:
 *         description: Forecasts created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Forecast'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.post("/batch", ForecastController.createManyForecasts);

/**
 * @swagger
 * /api/forecasts:
 *   get:
 *     summary: Get all forecasts
 *     description: Retrieve all forecast entries sorted by creation date (newest first)
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of all forecasts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Forecast'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/", ForecastController.getForecasts);

/**
 * @swagger
 * /api/forecasts/filter:
 *   get:
 *     summary: Get forecasts with filters
 *     description: Retrieve forecasts filtered by basin, strategy, jobType, jobId, date range, simulation hour, or ensemble
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: basin
 *         schema:
 *           type: string
 *         description: Filter by basin/station (e.g., EA001)
 *       - in: query
 *         name: strategy
 *         schema:
 *           type: string
 *           enum: [smc, ecmwf, wrf]
 *         description: Filter by strategy type
 *       - in: query
 *         name: jobType
 *         schema:
 *           type: string
 *           enum: [forecast, historical]
 *         description: Filter by job type
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *         description: Filter by job ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this date (ISO 8601 format)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this date (ISO 8601 format)
 *       - in: query
 *         name: simulationHour
 *         schema:
 *           type: string
 *         description: Filter by simulation hour from metadata
 *       - in: query
 *         name: ensemble
 *         schema:
 *           type: string
 *         description: Filter by ensemble from metadata
 *     responses:
 *       200:
 *         description: Filtered list of forecasts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Forecast'
 *       400:
 *         description: Bad request - invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/filter", ForecastController.getForecastsFiltered);

/**
 * @swagger
 * /api/forecasts/count:
 *   get:
 *     summary: Get total forecast count
 *     description: Get the total number of forecast entries
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Total count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/count", ForecastController.getTotalCount);

/**
 * @swagger
 * /api/forecasts/basins:
 *   get:
 *     summary: Get all basin identifiers
 *     description: Get a sorted list of all unique basin identifiers
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of basin identifiers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/basins", ForecastController.getAllBasins);

/**
 * @swagger
 * /api/forecasts/strategies:
 *   get:
 *     summary: Get all strategies
 *     description: Get a sorted list of all unique strategies
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of strategies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/strategies", ForecastController.getAllStrategies);

/**
 * @swagger
 * /api/forecasts/simulation-dates:
 *   get:
 *     summary: Get all simulation dates
 *     description: Get a sorted list of all unique simulation dates from metadata
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of simulation dates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/simulation-dates", ForecastController.getAllSimulationDates);

/**
 * @swagger
 * /api/forecasts/ensembles:
 *   get:
 *     summary: Get all ensembles
 *     description: Get a sorted list of all unique ensembles from metadata
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of ensembles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/ensembles", ForecastController.getAllEnsembles);

/**
 * @swagger
 * /api/forecasts/basin/{basin}/count:
 *   get:
 *     summary: Get forecast count by basin
 *     description: Get the number of forecast entries for a specific basin
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: basin
 *         required: true
 *         schema:
 *           type: string
 *         description: Basin identifier
 *     responses:
 *       200:
 *         description: Count of forecasts for the basin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *       400:
 *         description: Bad request - missing basin parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/basin/:basin/count", ForecastController.getCountByBasin);

/**
 * @swagger
 * /api/forecasts/strategy/{strategy}/count:
 *   get:
 *     summary: Get forecast count by strategy
 *     description: Get the number of forecast entries for a specific strategy
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: strategy
 *         required: true
 *         schema:
 *           type: string
 *           enum: [smc, ecmwf, wrf]
 *         description: Strategy type
 *     responses:
 *       200:
 *         description: Count of forecasts for the strategy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *       400:
 *         description: Bad request - invalid strategy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/strategy/:strategy/count", ForecastController.getCountByStrategy);

/**
 * @swagger
 * /api/forecasts/{id}:
 *   get:
 *     summary: Get forecast by ID
 *     description: Retrieve a specific forecast entry by its ID
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Forecast ID
 *     responses:
 *       200:
 *         description: Forecast details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Forecast'
 *       400:
 *         description: Bad request - missing ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Forecast not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.get("/:id", ForecastController.getForecastById);

/**
 * @swagger
 * /api/forecasts/{id}:
 *   delete:
 *     summary: Delete forecast by ID
 *     description: Delete a specific forecast entry by its ID
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Forecast ID
 *     responses:
 *       200:
 *         description: Forecast deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - missing ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Forecast not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.delete("/:id", ForecastController.deleteForecastById);

/**
 * @swagger
 * /api/forecasts/job/{jobId}:
 *   delete:
 *     summary: Delete forecasts by job ID
 *     description: Delete all forecast entries associated with a specific job ID
 *     tags: [Forecasts]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Forecasts deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: number
 *       400:
 *         description: Bad request - missing jobId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
forecastRouter.delete("/job/:jobId", ForecastController.deleteForecastsByJobId);

export default forecastRouter;
