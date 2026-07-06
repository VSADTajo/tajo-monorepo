import { Topics } from './messaging.registry';

describe('messaging.registry', () => {
    it('should expose MANUAL_OUTPUT_FETCHED routing key with value simulation.manual.output.fetched', () => {
        expect(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED).toBe('simulation.manual.output.fetched');
    });
});
