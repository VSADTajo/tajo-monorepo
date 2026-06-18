import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

import {
    CreateGroupRequestDto,
    CreateGroupResponseDto,
    ListGroupsResponseDto,
    AssignRoleToGroupRequestDto,
    AssignRoleToGroupResponseDto,
    MessageResponseDto,
} from '@api/dtos/group.dtos';
import { CreateGroupMapper, ListGroupsMapper, AssignRoleToGroupMapper } from '@application/mappers/group.mappers';
import {
    DeleteGroupCommand,
    AssignRoleToGroupCommand,
    RemoveRoleFromGroupCommand,
} from '@application/commands/group.commands';
import { ListGroupsQuery } from '@application/queries/group.queries';
import { ListGroupsResult } from '@domain/results/group.result';
import { ApiError } from '@domain/errors/api.error';
import { EntityError } from '@domain/errors/entity.error';
import { ApiEndpoint } from '@swagger/api-endpoint.decorator';

@ApiTags('Groups')
@Controller('groups')
export class GroupController {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly cachingQueryBus: CachingQueryBus,
    ) {}

    @Get()
    @ApiEndpoint({
        summary: 'List all groups with their roles',
        response: { status: 200, type: ListGroupsResponseDto, description: 'List of groups' },
    })
    async listGroups(): Promise<ListGroupsResponseDto> {
        this.logger.log('List groups request');
        try {
            const result = await this.cachingQueryBus.execute<ListGroupsResult>(new ListGroupsQuery());
            return ListGroupsMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error listing groups', entity: 'Group', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post()
    @ApiEndpoint({
        summary: 'Create a new group',
        body: CreateGroupRequestDto,
        response: { status: 201, type: CreateGroupResponseDto, description: 'Group created' },
        errors: [
            { status: 400, description: 'Validation error' },
            { status: 409, description: 'Group with this name already exists' },
        ],
    })
    async createGroup(@Body() dto: CreateGroupRequestDto): Promise<CreateGroupResponseDto> {
        this.logger.log(`Create group request: ${dto.name}`);
        const command = CreateGroupMapper.toCommand(dto);
        try {
            const result = await this.commandBus.execute(command);
            return CreateGroupMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof EntityError) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error creating group', entity: 'Group', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id')
    @ApiEndpoint({
        summary: 'Delete a group (cascades to group_roles and user_groups)',
        response: { status: 200, description: 'Group deleted' },
        errors: [{ status: 404, description: 'Group not found' }],
    })
    async deleteGroup(@Param('id') id: string): Promise<void> {
        this.logger.log(`Delete group request: ${id}`);
        try {
            await this.commandBus.execute(new DeleteGroupCommand({ groupId: id }));
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error deleting group', entity: 'Group', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post(':id/roles')
    @ApiEndpoint({
        summary: 'Assign a role to a group',
        body: AssignRoleToGroupRequestDto,
        response: { status: 201, type: AssignRoleToGroupResponseDto, description: 'Role assigned to group' },
        errors: [
            { status: 404, description: 'Group or role not found' },
            { status: 409, description: 'Group already has this role' },
        ],
    })
    async assignRoleToGroup(
        @Param('id') groupId: string,
        @Body() dto: AssignRoleToGroupRequestDto,
    ): Promise<AssignRoleToGroupResponseDto> {
        this.logger.log(`Assign role to group: groupId=${groupId}, roleId=${dto.roleId}`);
        try {
            const result = await this.commandBus.execute(new AssignRoleToGroupCommand({ groupId, roleId: dto.roleId }));
            return AssignRoleToGroupMapper.toResponseDto(result);
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error assigning role to group', entity: 'Group', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Delete(':id/roles/:roleId')
    @ApiEndpoint({
        summary: 'Remove a role from a group',
        response: { status: 200, type: MessageResponseDto, description: 'Role removed from group' },
        errors: [{ status: 404, description: 'Assignment not found' }],
    })
    async removeRoleFromGroup(
        @Param('id') groupId: string,
        @Param('roleId') roleId: string,
    ): Promise<MessageResponseDto> {
        this.logger.log(`Remove role from group: groupId=${groupId}, roleId=${roleId}`);
        try {
            const result = await this.commandBus.execute(new RemoveRoleFromGroupCommand({ groupId, roleId }));
            return { message: result.message };
        } catch (error) {
            if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
            this.logger.error({ msg: 'Error removing role from group', entity: 'Group', error: String(error) });
            throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
