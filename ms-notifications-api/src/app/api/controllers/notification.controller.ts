import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

// DTOs
import {
    CreateNotificationRequestDto,
    ListNotificationsQueryDto,
    NotificationResponseDto,
    ListNotificationsResponseDto,
    UpdateNotificationResponseDto,
    BulkIdsRequestDto,
    BulkUpdateResponseDto,
} from '@api/dtos/notification.dtos';

// Mappers
import {
    CreateNotificationMapper,
    ListNotificationsMapper,
    MarkAsReadMapper,
    ArchiveNotificationMapper,
    BulkOperationsMapper,
} from '@application/mappers/notification.mappers';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

// Domain results
import { ListNotificationsResult } from '@domain/results/notification.result';

// Cache
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    // ─────────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────────

    @Post()
    @ApiEndpoint({
        summary: 'Create a notification',
        body: CreateNotificationRequestDto,
        response: { status: 201, type: NotificationResponseDto, description: 'Notification created' },
        errors: [{ status: 400, description: 'Validation error' }],
    })
    async create(@Body() dto: CreateNotificationRequestDto): Promise<NotificationResponseDto> {
        const command = CreateNotificationMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateNotificationMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────

    @Get()
    @ApiEndpoint({
        summary: 'List notifications with filters and pagination',
        response: { status: 200, type: ListNotificationsResponseDto, description: 'Paginated list of notifications' },
    })
    async findAll(@Query() dto: ListNotificationsQueryDto): Promise<ListNotificationsResponseDto> {
        const query = ListNotificationsMapper.toQuery(dto);
        try {
            const result = await this.cachingQueryBus.execute<ListNotificationsResult>(query);
            return ListNotificationsMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Mark as Read
    // ─────────────────────────────────────────────────────────────

    @Patch(':id/read')
    @ApiEndpoint({
        summary: 'Mark a notification as read',
        response: { status: 200, type: UpdateNotificationResponseDto, description: 'Notification marked as read' },
        errors: [{ status: 404, description: 'Notification not found' }],
    })
    async markAsRead(@Param('id') id: string): Promise<UpdateNotificationResponseDto> {
        const command = MarkAsReadMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return MarkAsReadMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Archive
    // ─────────────────────────────────────────────────────────────

    @Patch(':id/archive')
    @ApiEndpoint({
        summary: 'Archive a notification',
        response: { status: 200, type: UpdateNotificationResponseDto, description: 'Notification archived' },
        errors: [
            { status: 400, description: 'Already archived' },
            { status: 404, description: 'Notification not found' },
        ],
    })
    async archive(@Param('id') id: string): Promise<UpdateNotificationResponseDto> {
        const command = ArchiveNotificationMapper.toCommand(id);
        try {
            const result = await this.commandBus.execute(command);
            return ArchiveNotificationMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Bulk Mark as Read
    // ─────────────────────────────────────────────────────────────

    @Patch('bulk/read')
    @ApiEndpoint({
        summary: 'Mark multiple notifications as read',
        body: BulkIdsRequestDto,
        response: { status: 200, type: BulkUpdateResponseDto, description: 'Bulk mark-as-read result' },
        errors: [{ status: 400, description: 'Validation error' }],
    })
    async bulkMarkAsRead(@Body() dto: BulkIdsRequestDto): Promise<BulkUpdateResponseDto> {
        const command = BulkOperationsMapper.toBulkReadCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return BulkOperationsMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Bulk Archive
    // ─────────────────────────────────────────────────────────────

    @Patch('bulk/archive')
    @ApiEndpoint({
        summary: 'Archive multiple notifications',
        body: BulkIdsRequestDto,
        response: { status: 200, type: BulkUpdateResponseDto, description: 'Bulk archive result' },
        errors: [{ status: 400, description: 'Validation error' }],
    })
    async bulkArchive(@Body() dto: BulkIdsRequestDto): Promise<BulkUpdateResponseDto> {
        const command = BulkOperationsMapper.toBulkArchiveCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return BulkOperationsMapper.toResponseDto(result);
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Error Handler
    // ─────────────────────────────────────────────────────────────

    private handleError(error: unknown): never {
        if (error instanceof EntityError) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        if (error instanceof ApiError) {
            throw new HttpException(error.message, error.statusCode);
        }
        this.logger.error({ msg: 'Notification operation error', entity: 'Notifications', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
