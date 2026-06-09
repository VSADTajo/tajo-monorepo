import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * DTOs for User proxy endpoints. Validation whitelists properties; body is forwarded to ms-user-api.
 */

export class UpdateUserRequestDto {
    @ApiProperty({ description: 'User full name', example: 'Jane Doe', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'User email address', example: 'jane.doe@example.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;
}

export class UserResponseDto {
    @ApiProperty({ description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Full name', example: 'John Doe' })
    name: string;

    @ApiProperty({ description: 'Email address', example: 'john@example.com' })
    email: string;

    @ApiProperty({ description: 'Created at (ISO)', example: '2024-01-15T10:00:00.000Z' })
    createdAt: string;

    @ApiProperty({ description: 'Updated at (ISO)', example: '2024-01-15T10:00:00.000Z' })
    updatedAt: string;
}
