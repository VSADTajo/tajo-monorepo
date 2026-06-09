import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller';

const alertRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ConditionConfig:
 *       type: object
 *       required: [operator, value]
 *       properties:
 *         operator: { type: string, enum: [eq, neq, gt, lt, gte, lte] }
 *         value: { type: number }
 *         field: { type: string, default: count }
 *
 *     NotificationConfig:
 *       type: object
 *       required: [severity, title, message]
 *       properties:
 *         severity: { type: string, enum: [INFO, WARNING, CRITICAL] }
 *         title: { type: string }
 *         message: { type: string }
 *
 *     AlertRule:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         enabled: { type: boolean }
 *         dataSource: { type: string, enum: [mongodb_local, pg_predictions, pg_hydro, pg_model, pg_notifications, pg_meteo, pg_user, pg_sftp] }
 *         query: { type: string }
 *         condition: { $ref: '#/components/schemas/ConditionConfig' }
 *         intervalMinutes: { type: number, minimum: 1, maximum: 1440 }
 *         notification: { $ref: '#/components/schemas/NotificationConfig' }
 *         cooldownMinutes: { type: number, minimum: 1 }
 *         lastCheckedAt: { type: string, format: date-time, nullable: true }
 *         lastResult: { type: number, nullable: true }
 *         lastTriggeredAt: { type: string, format: date-time, nullable: true }
 *         consecutiveFailures: { type: number }
 *         lastError: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     CreateAlertRuleRequest:
 *       type: object
 *       required: [name, dataSource, query, condition, intervalMinutes, notification]
 *       properties:
 *         name: { type: string }
 *         description: { type: string }
 *         dataSource: { type: string, enum: [mongodb_local, pg_predictions, pg_hydro, pg_model, pg_notifications, pg_meteo, pg_user, pg_sftp] }
 *         query: { type: string }
 *         condition: { $ref: '#/components/schemas/ConditionConfig' }
 *         intervalMinutes: { type: number, minimum: 1, maximum: 1440 }
 *         notification: { $ref: '#/components/schemas/NotificationConfig' }
 *         cooldownMinutes: { type: number, default: 30 }
 */

/**
 * @swagger
 * /api/alerts/templates:
 *   get:
 *     summary: Get predefined alert templates
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: List of templates
 */
alertRouter.get('/templates', AlertController.getTemplates);

/**
 * @swagger
 * /api/alerts/datasources:
 *   get:
 *     summary: Get available data sources with connection status
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: List of data sources
 */
alertRouter.get('/datasources', AlertController.getDataSources);

/**
 * @swagger
 * /api/alerts/test-query:
 *   post:
 *     summary: Test a query without saving a rule
 *     tags: [Alerts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataSource, query]
 *             properties:
 *               dataSource: { type: string }
 *               query: { type: string }
 *     responses:
 *       200:
 *         description: Query result
 */
alertRouter.post('/test-query', AlertController.testQuery);

/**
 * @swagger
 * /api/alerts:
 *   post:
 *     summary: Create a new alert rule
 *     tags: [Alerts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAlertRuleRequest'
 *     responses:
 *       201:
 *         description: Rule created
 */
alertRouter.post('/', AlertController.create);

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: List all alert rules
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: List of alert rules
 */
alertRouter.get('/', AlertController.findAll);

/**
 * @swagger
 * /api/alerts/{id}:
 *   get:
 *     summary: Get a single alert rule
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alert rule
 *       404:
 *         description: Not found
 */
alertRouter.get('/:id', AlertController.findById);

/**
 * @swagger
 * /api/alerts/{id}:
 *   put:
 *     summary: Update an alert rule
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAlertRuleRequest'
 *     responses:
 *       200:
 *         description: Updated rule
 */
alertRouter.put('/:id', AlertController.update);

/**
 * @swagger
 * /api/alerts/{id}:
 *   delete:
 *     summary: Delete an alert rule
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
alertRouter.delete('/:id', AlertController.delete);

/**
 * @swagger
 * /api/alerts/{id}/toggle:
 *   patch:
 *     summary: Enable or disable an alert rule
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Toggled rule
 */
alertRouter.patch('/:id/toggle', AlertController.toggle);

/**
 * @swagger
 * /api/alerts/{id}/test:
 *   post:
 *     summary: Test a rule's query without dispatching notification
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Test result
 */
alertRouter.post('/:id/test', AlertController.testRule);

/**
 * @swagger
 * /api/alerts/{id}/history:
 *   get:
 *     summary: Get execution history for a rule
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Execution history
 */
alertRouter.get('/:id/history', AlertController.getHistory);

export default alertRouter;
