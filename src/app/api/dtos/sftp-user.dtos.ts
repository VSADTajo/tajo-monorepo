import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// CreateSftpUser
// ─────────────────────────────────────────────────────────────

export class CreateSftpUserRequestDto {
    @ApiProperty({ description: 'SFTP username (lowercase, alphanumeric + hyphens/underscores)', example: 'empresa-x' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    username: string;

    @ApiProperty({ description: 'SFTP password', example: 'secure-password-123' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ description: 'Root directory for the user (relative to storage base path)', example: 'empresa-x' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(500)
    rootDirectory: string;
}

// ─────────────────────────────────────────────────────────────
// UpdateSftpUser
// ─────────────────────────────────────────────────────────────

export class UpdateSftpUserRequestDto {
    @ApiPropertyOptional({ description: 'New password (leave empty to keep current)', example: 'new-password-456' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ description: 'Root directory for the user', example: 'empresa-x' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    rootDirectory?: string;
}

// ─────────────────────────────────────────────────────────────
// ToggleSftpUser
// ─────────────────────────────────────────────────────────────

export class ToggleSftpUserRequestDto {
    @ApiProperty({ description: 'Whether the SFTP user is active', example: true })
    @IsBoolean()
    isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────

export class SftpUserResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    id: string;

    @ApiProperty({ example: 'empresa-x' })
    username: string;

    @ApiProperty({ example: 'empresa-x' })
    rootDirectory: string;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ example: '2026-03-06T10:00:00Z' })
    createdAt: string;

    @ApiProperty({ example: '2026-03-06T10:00:00Z' })
    updatedAt: string;
}

export class ListSftpUsersResponseDto {
    @ApiProperty({ type: [SftpUserResponseDto] })
    users: SftpUserResponseDto[];
}

export class DeleteSftpUserResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    deletedId: string;

    @ApiProperty({ example: 'empresa-x' })
    username: string;
}
