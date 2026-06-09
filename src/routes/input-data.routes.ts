import { Router } from 'express';
import { InputDataController } from '../controllers/input-data.controller';

const inputDataRouter = Router();

/**
 * @swagger
 * /api/input-data/smc:
 *   get:
 *     summary: Get SMC data from ThingsBoard
 *     description: Retrieve telemetry data from SMC_Sensor and SMC_Alert devices in ThingsBoard with pagination
 *     tags: [Input Data]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Items per page
 *       - in: query
 *         name: station_name
 *         schema:
 *           type: string
 *         description: Filter by station name
 *       - in: query
 *         name: sub_basin_name
 *         schema:
 *           type: string
 *         description: Filter by sub basin name
 *     responses:
 *       200:
 *         description: Paginated list of SMC data points
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       device_id:
 *                         type: string
 *                       device_name:
 *                         type: string
 *                       device_type:
 *                         type: string
 *                         enum: [SMC_Sensor, SMC_Alert]
 *                       station_name:
 *                         type: string
 *                       sub_basin_name:
 *                         type: string
 *                       uxc_code:
 *                         type: string
 *                       variable_code:
 *                         type: string
 *                       sensor_name:
 *                         type: string
 *                       timestamp:
 *                         type: integer
 *                       value:
 *                         type: number
 *                       units:
 *                         type: string
 *                       key:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
inputDataRouter.get('/smc/devices', InputDataController.getSmcDevices);
inputDataRouter.get('/smc', InputDataController.getSmcData);

export default inputDataRouter;
