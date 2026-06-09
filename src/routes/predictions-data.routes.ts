import { Router } from "express";
import { PredictionsSimulationsController } from "../controllers/predictions-simulations.controller";

const predictionsDataRouter = Router();

/**
 * @swagger
 * /api/predictions-data/simulations/historical:
 *   get:
 *     summary: Get historical simulations
 *     description: Paginated historical simulations from external API (proxy with x-api-key)
 *     tags: [Predictions Data]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: simulation_environment
 *         schema:
 *           type: string
 *         description: Filter by simulation environment
 *       - in: query
 *         name: basin
 *         schema:
 *           type: string
 *         description: Filter by basin (cuenca)
 *       - in: query
 *         name: created_by
 *         schema:
 *           type: string
 *         description: Filter by user who created the simulation
 *       - in: query
 *         name: maneuver_created_by
 *         schema:
 *           type: string
 *         description: Filter by user who created maneuvers
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 24
 *         description: Items per page
 *       - in: query
 *         name: only_unarchived_maneuvers
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Only simulations with non-archived maneuvers
 *     responses:
 *       200:
 *         description: Paginated historical simulations
 *       500:
 *         description: Internal server error
 */
predictionsDataRouter.get(
    "/simulations/historical",
    PredictionsSimulationsController.getHistoricalSimulations
);

/**
 * @swagger
 * /api/predictions-data/prediction-results:
 *   get:
 *     summary: Get prediction results
 *     description: List prediction results (proxy to external API)
 *     tags: [Predictions Data]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date-time }
 *         description: Start of date range (ISO 8601)
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date-time }
 *         description: End of date range (ISO 8601)
 *       - in: query
 *         name: simulation_date
 *         schema: { type: string }
 *         description: Filter by simulation (YYYYMMDD, 12 or 14 digits)
 *       - in: query
 *         name: station_name
 *         schema: { type: string }
 *       - in: query
 *         name: sub_basin_name
 *         schema: { type: string }
 *       - in: query
 *         name: prediction_type
 *         schema: { type: string }
 *       - in: query
 *         name: prediction_provider
 *         schema: { type: string }
 *       - in: query
 *         name: predicted_by
 *         schema: { type: string }
 *       - in: query
 *         name: percentile
 *         schema: { type: integer, enum: [10, 25, 50, 75, 90] }
 *     responses:
 *       200:
 *         description: List of prediction results
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
predictionsDataRouter.get(
    "/prediction-results",
    PredictionsSimulationsController.getPredictionResults
);

predictionsDataRouter.get(
    "/stations",
    PredictionsSimulationsController.getStations
);

predictionsDataRouter.get(
    "/historical-predictions/:subBasinName",
    PredictionsSimulationsController.getHistoricalPredictions
);

export default predictionsDataRouter;
