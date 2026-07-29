import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { MOCK_FEWS_ROUTE } from '@common/mock-fews.constants';
import { MockFewsTaskStoreService } from '@infrastructure/services/mock-fews-task-store.service';

/**
 * A stand-in for the Delft-FEWS PI REST service, exposing the four endpoints the
 * manual simulation flow uses.
 *
 * It exists so the MOCK model source drives the real client over real HTTP
 * instead of taking a shortcut. Previously MOCK dropped a result file straight
 * into the output folder, which exercised the half of the pipeline that already
 * worked and none of the FEWS integration — so the mode used to gain confidence
 * was the one that tested nothing new.
 *
 * The shapes here follow the published OpenAPI description of the real service:
 * `runtask` answers text/plain with the task id, `taskrunstatus` answers a flat
 * PI-JSON object, and the import answers a PI Diag document. Hidden from Swagger
 * because it is a test double, not part of this service's API.
 */
@ApiExcludeController()
@Controller(MOCK_FEWS_ROUTE)
export class MockFewsController {
    constructor(private readonly store: MockFewsTaskStoreService) {}

    @Post('timeseries')
    @HttpCode(HttpStatus.OK)
    @Header('Content-Type', 'application/xml')
    importTimeSeries(@Body() body: unknown): string {
        return this.store.importTimeSeries(body);
    }

    @Post('runtask')
    @HttpCode(HttpStatus.OK)
    @Header('Content-Type', 'text/plain')
    runTask(@Query('workflowId') workflowId: string): string {
        return this.store.runTask(workflowId);
    }

    @Get('taskrunstatus')
    taskRunStatus(@Query('taskId') taskId: string): unknown {
        return this.store.taskRunStatus(taskId);
    }

    @Get('timeseries')
    async timeSeries(@Query('taskRunIds') taskRunIds: string): Promise<unknown> {
        return this.store.timeSeries(taskRunIds);
    }
}
