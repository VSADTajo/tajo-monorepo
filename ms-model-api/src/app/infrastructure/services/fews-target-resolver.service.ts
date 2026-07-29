import { Injectable } from '@nestjs/common';

import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { FewsTarget } from '@domain/types/fews-target.type';
import { ModelSource } from '@domain/types/model-source.type';
import { MOCK_FEWS_FILTER_ID, MOCK_FEWS_SERVICE_PATH, MOCK_FEWS_WORKFLOW_ID } from '@common/mock-fews.constants';

/**
 * Decides which PI REST service a run talks to.
 *
 * This is the whole difference between MOCK and FEWS_API: same launcher, same
 * client, same requests — only these values change. Keeping the decision in one
 * place also means the poller can rebuild the right target later from nothing
 * more than the run's stored model source.
 */
@Injectable()
export class FewsTargetResolverService {
    constructor(private readonly config: FewsApiConfigService) {}

    resolve(source: ModelSource): FewsTarget {
        if (source === 'MOCK') {
            return {
                baseUrl: this.config.mockBaseUrl,
                servicePath: MOCK_FEWS_SERVICE_PATH,
                filterId: MOCK_FEWS_FILTER_ID,
                workflowId: MOCK_FEWS_WORKFLOW_ID,
                username: '',
                password: '',
            };
        }

        return {
            baseUrl: this.config.baseUrl,
            servicePath: this.config.servicePath,
            filterId: this.config.filterId,
            workflowId: this.config.workflowId,
            username: this.config.username,
            password: this.config.password,
        };
    }
}
