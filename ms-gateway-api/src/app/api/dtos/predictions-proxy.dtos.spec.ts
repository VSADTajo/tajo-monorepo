import { ArgumentMetadata } from '@nestjs/common';

import { CustomValidationPipe } from '../../../common/pipes/custom-validation.pipe';
import { CreateManualSimulationRequestDto } from './predictions-proxy.dtos';

/**
 * Guards the gateway's half of the manual-simulation contract.
 *
 * The gateway validates with `forbidNonWhitelisted`, so any field it does not
 * declare is a 400 — the request never reaches ms-predictions-api. That is how
 * `modelSource` broke: predictions declared it, the proxy DTO did not, and
 * launching anything other than the default answered
 * "property modelSource should not exist". Nothing failed in either service's
 * own suite, because neither owns the contract between them.
 *
 * Runs the real pipe rather than calling class-validator directly, so the test
 * fails for the same reason production would.
 */
describe('CreateManualSimulationRequestDto (gateway validation)', () => {
    const pipe = new CustomValidationPipe();
    const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: CreateManualSimulationRequestDto,
    };

    /** The smallest payload the backoffice can send. */
    function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            modmeteo: 'BOTH',
            maneuvers: [{ reservoirCode: 'E_09', outputFlowValue: 12.5 }],
            ...overrides,
        };
    }

    it.each(['SFTP', 'MOCK', 'FEWS_API'])('should accept modelSource=%s', async (modelSource) => {
        const result = await pipe.transform(basePayload({ modelSource }), metadata);

        // Not just accepted — it has to survive whitelisting, since the gateway
        // forwards the validated object and a stripped field would silently make
        // every simulation run as SFTP.
        expect(result).toMatchObject({ modelSource });
    });

    it('should accept a payload with no modelSource, so the default still applies', async () => {
        const result = await pipe.transform(basePayload(), metadata);

        expect(result.modelSource).toBeUndefined();
    });

    it('should reject an unknown model source', async () => {
        await expect(pipe.transform(basePayload({ modelSource: 'CARRIER_PIGEON' }), metadata)).rejects.toBeDefined();
    });

    it('should still reject a field the DTO does not declare', async () => {
        // Proves forbidNonWhitelisted is really in force, so the passing cases
        // above mean something.
        await expect(pipe.transform(basePayload({ notAField: 'x' }), metadata)).rejects.toBeDefined();
    });
});
