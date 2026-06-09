import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserStatus } from '@domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────
// GetUserByEmail (interno: id, password hasheada, roles, status)
// ─────────────────────────────────────────────────────────────

export class GetUserByEmailRoleItemDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty({ nullable: true }) description: string | null;
}

export class GetUserByEmailResponseDto {
    @ApiProperty() id: string;
    @ApiProperty({ description: 'Password (hash, solo uso interno)' }) password: string;
    @ApiProperty({ type: [GetUserByEmailRoleItemDto] }) roles: GetUserByEmailRoleItemDto[];
    @ApiProperty({ enum: UserStatus }) status: string;
}

// ─────────────────────────────────────────────────────────────
// UpdatePassword
// ─────────────────────────────────────────────────────────────

export class UpdatePasswordRequestDto {
    @ApiProperty({ description: 'New password (hash)', example: '$2b$10$...' })
    @IsNotEmpty()
    @IsString()
    password: string;
}

// ─────────────────────────────────────────────────────────────
// GetUserStatus
// ─────────────────────────────────────────────────────────────

export class GetUserStatusResponseDto {
    @ApiProperty({ enum: UserStatus }) status: string;
}

// ─────────────────────────────────────────────────────────────
// RegisterUser
// ─────────────────────────────────────────────────────────────

export class RegisterUserRequestDto {
    @ApiProperty({
        description: 'Full name of the user',
        example: 'John Doe',
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Password (hash from AUTH-API)',
        example: '$2b$10$...',
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;
}

export class RegisterUserResponseDto {
    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User status after registration',
        example: 'active',
    })
    status: string;

    @ApiProperty({
        description: 'ID of the welcome email sent',
        example: '660e8400-e29b-41d4-a716-446655440001',
    })
    welcomeEmailId: string;
}

// ─────────────────────────────────────────────────────────────
// UpdateUser
// ─────────────────────────────────────────────────────────────

export class UpdateUserRequestDto {
    @ApiPropertyOptional({
        description: 'Full name of the user',
        example: 'John Doe',
    })
    @IsOptional()
    @IsString()
    @MinLength(2)
    name?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'User status', enum: UserStatus })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;
}

export class UpdateUserResponseDto {
    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User status',
        example: 'active',
    })
    status: string;

    @ApiProperty({
        description: 'ID of the welcome email sent',
        example: '660e8400-e29b-41d4-a716-446655440001',
        nullable: true,
    })
    welcomeEmailId: string | null;
}

// ─────────────────────────────────────────────────────────────
// ListUsers
// ─────────────────────────────────────────────────────────────

export class UserItemDto {
    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User status',
        example: 'active',
        enum: UserStatus,
    })
    status: string;
}

export class ListUsersResponseDto {
    @ApiProperty({
        description: 'List of all users',
        type: [UserItemDto],
    })
    users: UserItemDto[];
}

// ─────────────────────────────────────────────────────────────
// GetUserById
// ─────────────────────────────────────────────────────────────

export class GetUserByIdResponseDto {
    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User status',
        example: 'active',
    })
    status: string;

    @ApiProperty({
        description: 'ID of the welcome email sent',
        example: '660e8400-e29b-41d4-a716-446655440001',
        nullable: true,
    })
    welcomeEmailId: string | null;
}
