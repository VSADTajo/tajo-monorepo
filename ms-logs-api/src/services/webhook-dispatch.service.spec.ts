import { resolveWebhookEvents, SimulationRoutingKeys } from './webhook-dispatch.service';
import { WebhookEvent } from '../types/webhook.types';

describe('resolveWebhookEvents', () => {
    it('maps input dispatched to INPUT_UPLOADED', () => {
        expect(resolveWebhookEvents(SimulationRoutingKeys.MANUAL_DISPATCHED, {})).toEqual([
            WebhookEvent.INPUT_UPLOADED,
        ]);
    });

    it('maps balance computed to BALANCE_COMPUTED', () => {
        expect(resolveWebhookEvents(SimulationRoutingKeys.MANUAL_BALANCE_COMPUTED, {})).toEqual([
            WebhookEvent.BALANCE_COMPUTED,
        ]);
    });

    it('maps an intermediate status change to STATUS_CHANGED only', () => {
        expect(resolveWebhookEvents(SimulationRoutingKeys.STATUS_UPDATED, { status: 'IN_PROGRESS' })).toEqual([
            WebhookEvent.STATUS_CHANGED,
        ]);
    });

    it('fans out FINALIZED to STATUS_CHANGED + COMPLETED', () => {
        expect(resolveWebhookEvents(SimulationRoutingKeys.STATUS_UPDATED, { status: 'FINALIZED' })).toEqual([
            WebhookEvent.STATUS_CHANGED,
            WebhookEvent.COMPLETED,
        ]);
    });

    it('fans out MODEL_FAILED to STATUS_CHANGED + FAILED', () => {
        expect(resolveWebhookEvents(SimulationRoutingKeys.STATUS_UPDATED, { status: 'MODEL_FAILED' })).toEqual([
            WebhookEvent.STATUS_CHANGED,
            WebhookEvent.FAILED,
        ]);
    });

    it('ignores unknown routing keys', () => {
        expect(resolveWebhookEvents('something.else', {})).toEqual([]);
    });
});
