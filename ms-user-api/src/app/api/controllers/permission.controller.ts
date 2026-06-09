import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

import {
    CreatePermissionRequestDto,
    CreatePermissionResponseDto,
    ListPermissionsResponseDto,
    SyncPermissionsRequestDto,
    SyncPermissionsResponseDto,
} from '@api/dtos/permission.dtos';
import {
    CreatePermissionMapper,
    ListPermissionsMapper,
    SyncPermissionsMapper,
} from '@application/mappers/permission.mappers';
import { DeletePermissionCommand, SyncPermissionsCommand } from '@application/commands/permission.commands';
import { SyncPermissionsResult } from '@domain/results/permission.result';
import { ListPermissionsQuery } from '@application/queries/permission.queries';
import { ListPermissionsResult } from '@domain/results/permission.result';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get()
    @ApiEndpoint({
        summary: 'List all permissions',
        response: { status: 200, type: ListPermissionsResponseDto, description: 'List of all permissions' },
    })
    async listPermissions(): Promise<ListPermissionsResponseDto> {
        this.logger.log('List permissions request');
        try {
            const result = await this.cachingQueryBus.execute<ListPermissionsResult>(new ListPermissionsQuery());
            return ListPermissionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error listing permissions: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post()
    @ApiEndpoint({
        summary: 'Create a new permission',
        body: CreatePermissionRequestDto,
        response: { status: 201, type: CreatePermissionResponseDto, description: 'Permission created' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'Permission with this method+path already exists' },
        ],
    })
    async createPermission(@Body() dto: CreatePermissionRequestDto): Promise<CreatePermissionResponseDto> {
        this.logger.log(`Create permission request: ${dto.method} ${dto.path}`);
        const command = CreatePermissionMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreatePermissionMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error creating permission: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('sync')
    @ApiEndpoint({
        summary: 'Sync permissions from gateway routes (upsert by method+path)',
        body: SyncPermissionsRequestDto,
        response: { status: 200, type: SyncPermissionsResponseDto, description: 'All permissions after sync' },
    })
    async syncPermissions(@Body() dto: SyncPermissionsRequestDto): Promise<SyncPermissionsResponseDto> {
        this.logger.log(`Sync permissions request: ${dto.routes.length} routes`);
        try {
            const command = SyncPermissionsMapper.toCommand(dto);
            const result = await this.commandBus.execute<SyncPermissionsCommand, SyncPermissionsResult>(command);
            return SyncPermissionsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error syncing permissions: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete a permission (must not be assigned to any role)',
        response: { status: 200, description: 'Permission deleted' },
        errors: [
            { status: 404, description: 'Permission not found' },
            { status: 409, description: 'Permission is assigned to roles' },
        ],
    })
    async deletePermission(@Param('id') id: string): Promise<void> {
        this.logger.log(`Delete permission request: ${id}`);
        try {
            await this.commandBus.execute(new DeletePermissionCommand({ permissionId: id }));
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error(`Error deleting permission: ${error}`);
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
