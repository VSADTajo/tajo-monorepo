import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────

export class LoginRequestDto {
    @ApiProperty({
        description: 'User email address',
        example: 'john@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Password',
        example: 'MyP@ssw0rd',
    })
    @IsNotEmpty()
    @IsString()
    password: string;
}

export class LoginResponseDto {
    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'Access token expiration (e.g. 15m)',
        example: '15m',
    })
    expiresIn: string;

    @ApiProperty({
        description: 'Token type',
        example: 'Bearer',
    })
    tokenType: string;

    @ApiProperty({
        description: 'JWT refresh token (long-lived, use to obtain new access token)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;

    @ApiProperty({
        description: 'Refresh token expiration (e.g. 15d)',
        example: '15d',
    })
    refreshExpiresIn: string;
}

// ─────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────

export class RegisterRequestDto {
    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Password (will be hashed before sending to user-api)',
        example: 'MyP@ssw0rd',
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;
}

export class RegisterResponseDto {
    @ApiProperty({
        description: 'Created user ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    userId: string;
}

// ─────────────────────────────────────────────────────────────
// RefreshToken
// ─────────────────────────────────────────────────────────────

export class RefreshTokenRequestDto {
    @ApiProperty({
        description: 'Refresh token obtained from login',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsNotEmpty()
    @IsString()
    refreshToken: string;
}

// Refresh response reuses LoginResponseDto (accessToken, expiresIn, tokenType, refreshToken, refreshExpiresIn)

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

export class LogoutRequestDto {
    @ApiProperty({
        description: 'Access or refresh token to invalidate',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsNotEmpty()
    @IsString()
    token: string;
}

export class LogoutResponseDto {
    @ApiProperty({
        description: 'Whether the token was successfully invalidated',
        example: true,
    })
    success: boolean;
}

// ─────────────────────────────────────────────────────────────
// ValidateToken
// ─────────────────────────────────────────────────────────────

export class ValidateTokenRequestDto {
    @ApiProperty({
        description: 'JWT token to validate',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsNotEmpty()
    @IsString()
    token: string;
}

export class ValidateTokenResponseDto {
    @ApiProperty({
        description: 'Whether the token is valid',
        example: true,
    })
    valid: boolean;

    @ApiProperty({
        description: 'User ID from token',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    userId: string;

    @ApiProperty({
        description: 'User roles from token',
        example: ['admin', 'editor'],
    })
    roles: string[];

    @ApiProperty({
        description: 'User email (from user-api)',
        example: 'john@example.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'User full name (from user-api)',
        example: 'John Doe',
        required: false,
    })
    name?: string;
}

// ─────────────────────────────────────────────────────────────
// ChangePassword
// ─────────────────────────────────────────────────────────────

export class ChangePasswordRequestDto {
    @ApiProperty({
        description: 'User email address (used to find user in user-api)',
        example: 'john@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Current password (verified before updating)',
        example: 'MyP@ssw0rd',
    })
    @IsNotEmpty()
    @IsString()
    currentPassword: string;

    @ApiProperty({
        description: 'New password (min 8 characters, will be hashed before sending to user-api)',
        example: 'NewP@ssw0rd123',
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters' })
    newPassword: string;
}

export class ChangePasswordResponseDto {
    @ApiProperty({
        description: 'Whether the password was updated successfully',
        example: true,
    })
    success: boolean;
}
