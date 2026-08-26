import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { MOCK_WISKI_ROUTE } from '@common/mock-wiski.constants';
import { MOCK_WISKI_OBSERVED_FIXTURE } from '@infrastructure/services/__fixtures__/wiski-observed.fixture';
import { WiskiObservedRecord } from '@infrastructure/services/wiski-json.mapper';

/**
 * A stand-in for the WISKI observed-data endpoint, answering the same flat
 * array of readings their service returns — newest first, no metadata, no
 * timezone offset.
 *
 * Hidden from Swagger because it is a test double, not part of this service's
 * API. Point a WISKI_API provider config at this service's own base url to run
 * the whole ingestion path end to end without their network.
 */
@ApiExcludeController()
@Controller(MOCK_WISKI_ROUTE)
export class MockWiskiController {
    @Get('tagus_flowcast_observado')
    observed(): WiskiObservedRecord[] {
        return MOCK_WISKI_OBSERVED_FIXTURE;
    }
}
