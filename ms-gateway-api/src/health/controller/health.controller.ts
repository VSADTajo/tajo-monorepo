import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Healthchecks')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private http: HttpHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    @ApiOperation({
        summary: 'Health check',
        description: 'Returns service health status (e.g. dependency ping).',
    })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    @ApiResponse({ status: 503, description: 'Service unhealthy' })
    check() {
        return this.health.check([() => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com')]);
    }
}
