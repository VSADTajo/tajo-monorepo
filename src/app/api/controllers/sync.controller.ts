import { Controller, HttpException, HttpStatus, Inject, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { SyncGeoserverResponseDto } from '@api/dtos/sync.dtos';
import { SyncGeoserverMapper } from '@application/mappers/sync.mappers';
import { SyncGeoserverCommand } from '@application/commands/sync.commands';
import { SyncGeoserverResult } from '@domain/results/sync.results';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
    ) {}

    @Post('geoserver')
    @ApiEndpoint({
        summary: 'Sync data from GeoServer database',
        response: { status: 201, type: SyncGeoserverResponseDto, description: 'Sync completed successfully' },
        errors: [{ status: 500, description: 'GeoServer database unreachable or sync failed' }],
    })
    async syncGeoserver(): Promise<SyncGeoserverResponseDto> {
        this.logger.log('Sync GeoServer request received');
        try {
            const command = new SyncGeoserverCommand();
            const result = await this.commandBus.execute<SyncGeoserverCommand, SyncGeoserverResult>(command);
            return SyncGeoserverMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) {
                throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            if (error instanceof ApiError) {
                throw new HttpException(error.message, error.statusCode);
            }
            this.logger.error(`Error syncing GeoServer: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
