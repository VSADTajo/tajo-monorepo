import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const webhookRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WebhookSubscription:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         url: { type: string }
 *         event: { type: string, enum: [manual_simulation.input_uploaded, manual_simulation.status_changed, manual_simulation.completed, manual_simulation.failed, manual_simulation.balance_computed] }
 *         active: { type: boolean }
 *         secret: { type: string, nullable: true }
 *         description: { type: string }
 *         lastDeliveredAt: { type: string, format: date-time, nullable: true }
 *         lastError: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     CreateWebhookRequest:
 *       type: object
 *       required: [url, event]
 *       properties:
 *         url: { type: string }
 *         event: { type: string }
 *         active: { type: boolean, default: true }
 *         secret: { type: string }
 *         description: { type: string }
 */

/**
 * @swagger
 * /api/webhooks/events:
 *   get:
 *     summary: List available webhook events (catalog for the dropdown)
 *     tags: [Webhooks]
 *     responses:
 *       200: { description: List of events }
 */
webhookRouter.get('/events', WebhookController.getEvents);

/**
 * @swagger
 * /api/webhooks/deliveries:
 *   get:
 *     summary: List recent webhook deliveries (audit log)
 *     tags: [Webhooks]
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Delivery history }
 */
webhookRouter.get('/deliveries', WebhookController.listDeliveries);

/**
 * @swagger
 * /api/webhooks:
 *   post:
 *     summary: Create a webhook subscription
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWebhookRequest'
 *     responses:
 *       201: { description: Subscription created }
 *   get:
 *     summary: List all webhook subscriptions
 *     tags: [Webhooks]
 *     responses:
 *       200: { description: List of subscriptions }
 */
webhookRouter.post('/', WebhookController.create);
webhookRouter.get('/', WebhookController.findAll);

/**
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     summary: Get a webhook subscription
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Subscription }
 *       404: { description: Not found }
 *   put:
 *     summary: Update a webhook subscription
 *     tags: [Webhooks]
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
 *             $ref: '#/components/schemas/CreateWebhookRequest'
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Delete a webhook subscription
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
webhookRouter.get('/:id', WebhookController.findById);
webhookRouter.put('/:id', WebhookController.update);
webhookRouter.delete('/:id', WebhookController.delete);

/**
 * @swagger
 * /api/webhooks/{id}/toggle:
 *   patch:
 *     summary: Enable or disable a webhook subscription
 *     tags: [Webhooks]
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
 *             required: [active]
 *             properties:
 *               active: { type: boolean }
 *     responses:
 *       200: { description: Toggled }
 */
webhookRouter.patch('/:id/toggle', WebhookController.toggle);

export default webhookRouter;
