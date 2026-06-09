import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTOs for Role proxy endpoints. Validation whitelists properties; body is forwarded to ms-user-api.
 */

export class CreateRoleRequestDto {
    @ApiProperty({
        description: 'Role name (unique)',
        example: 'editor',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Optional description',
        example: 'Can edit content',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class AssignRoleRequestDto {
    @ApiProperty({
        description: 'Role ID (UUID) to assign to the user',
        example: '660e8400-e29b-41d4-a716-446655440001',
    })
    @IsNotEmpty()
    @IsString()
    roleId: string;
}

export class RoleResponseDto {
    @ApiProperty({ description: 'Role UUID', example: '660e8400-e29b-41d4-a716-446655440001' })
    id: string;

    @ApiProperty({ description: 'Role name', example: 'editor' })
    name: string;

    @ApiProperty({ description: 'Role description', example: 'Can edit content', required: false })
    description?: string;
}
