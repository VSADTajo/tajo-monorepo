import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsDefined,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// Shared: SFTP Connection
// ─────────────────────────────────────────────────────────────

export class SftpConnectionDto {
    @ApiProperty({ description: 'SFTP server hostname or IP', example: 'sftp.example.com' })
    @IsNotEmpty()
    @IsString()
    host: string;

    @ApiPropertyOptional({ description: 'SFTP server port', default: 22, example: 22 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({ description: 'SFTP username', example: 'sftp-user' })
    @IsNotEmpty()
    @IsString()
    username: string;

    @ApiPropertyOptional({ description: 'SFTP password (optional if privateKey provided)', example: 'secret123' })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional({ description: 'SSH private key in PEM format (optional if password provided)' })
    @IsOptional()
    @IsString()
    privateKey?: string;
}

// ─────────────────────────────────────────────────────────────
// SFTP: Remote File Info
// ─────────────────────────────────────────────────────────────

export class RemoteFileInfoDto {
    @ApiProperty({ description: 'Remote file name', example: 'data-2026-03.csv' })
    name: string;

    @ApiProperty({ description: 'Full path on remote server', example: '/data/incoming/data-2026-03.csv' })
    path: string;

    @ApiProperty({ description: 'Size in bytes', example: 5242880 })
    size: number;

    @ApiProperty({ description: 'Last modification date', example: '2026-03-04T08:00:00Z' })
    modifiedAt: string;

    @ApiProperty({ description: 'True if this is a directory', example: false })
    isDirectory: boolean;
}

// ─────────────────────────────────────────────────────────────
// SftpListFiles
// ─────────────────────────────────────────────────────────────

export class SftpListFilesRequestDto {
    @ApiProperty({ description: 'SFTP connection details', type: SftpConnectionDto })
    @IsDefined()
    @ValidateNested()
    @Type(() => SftpConnectionDto)
    connection: SftpConnectionDto;

    @ApiProperty({ description: 'Remote directory path', example: '/data/incoming' })
    @IsNotEmpty()
    @IsString()
    directory: string;
}

export class SftpListFilesResponseDto {
    @ApiProperty({ description: 'Remote directory path', example: '/data/incoming' })
    directory: string;

    @ApiProperty({ description: 'List of remote files', type: [RemoteFileInfoDto] })
    files: RemoteFileInfoDto[];
}

// ─────────────────────────────────────────────────────────────
// SftpDownloadFile
// ─────────────────────────────────────────────────────────────

export class SftpDownloadFileRequestDto {
    @ApiProperty({ description: 'SFTP connection details', type: SftpConnectionDto })
    @IsDefined()
    @ValidateNested()
    @Type(() => SftpConnectionDto)
    connection: SftpConnectionDto;

    @ApiProperty({ description: 'Remote file path', example: '/data/incoming/report.csv' })
    @IsNotEmpty()
    @IsString()
    path: string;
}

// ─────────────────────────────────────────────────────────────
// SftpDownloadToLocal
// ─────────────────────────────────────────────────────────────

export class SftpDownloadToLocalRequestDto {
    @ApiProperty({ description: 'SFTP connection details', type: SftpConnectionDto })
    @IsDefined()
    @ValidateNested()
    @Type(() => SftpConnectionDto)
    connection: SftpConnectionDto;

    @ApiProperty({ description: 'Remote file path on SFTP server', example: '/data/incoming/report.csv' })
    @IsNotEmpty()
    @IsString()
    remotePath: string;

    @ApiProperty({
        description: 'Local destination path (relative to STORAGE_BASE_PATH)',
        example: 'inbox/external/report.csv',
    })
    @IsNotEmpty()
    @IsString()
    localPath: string;

    @ApiPropertyOptional({ description: 'Allow overwrite if local file exists', default: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    overwrite?: boolean;
}

export class SftpDownloadToLocalResponseDto {
    @ApiProperty({ description: 'Remote source path', example: '/data/incoming/report.csv' })
    remotePath: string;

    @ApiProperty({ description: 'Local destination path', example: 'inbox/external/report.csv' })
    localPath: string;

    @ApiProperty({ description: 'File size in bytes', example: 5242880 })
    size: number;
}

// ─────────────────────────────────────────────────────────────
// SftpMoveFile
// ─────────────────────────────────────────────────────────────

export class SftpMoveFileRequestDto {
    @ApiProperty({ description: 'SFTP connection details', type: SftpConnectionDto })
    @IsDefined()
    @ValidateNested()
    @Type(() => SftpConnectionDto)
    connection: SftpConnectionDto;

    @ApiProperty({ description: 'Remote source path', example: '/data/incoming/report.csv' })
    @IsNotEmpty()
    @IsString()
    sourcePath: string;

    @ApiProperty({ description: 'Remote destination path', example: '/data/processed/report.csv' })
    @IsNotEmpty()
    @IsString()
    destinationPath: string;
}

export class SftpMoveFileResponseDto {
    @ApiProperty({ description: 'Source path', example: '/data/incoming/report.csv' })
    sourcePath: string;

    @ApiProperty({ description: 'Destination path', example: '/data/processed/report.csv' })
    destinationPath: string;
}

// ─────────────────────────────────────────────────────────────
// SftpDeleteFile
// ─────────────────────────────────────────────────────────────

export class SftpDeleteFileRequestDto {
    @ApiProperty({ description: 'SFTP connection details', type: SftpConnectionDto })
    @IsDefined()
    @ValidateNested()
    @Type(() => SftpConnectionDto)
    connection: SftpConnectionDto;

    @ApiProperty({ description: 'Remote file path', example: '/data/processed/old-report.csv' })
    @IsNotEmpty()
    @IsString()
    path: string;
}

export class SftpDeleteFileResponseDto {
    @ApiProperty({ description: 'Deleted remote path', example: '/data/processed/old-report.csv' })
    deletedPath: string;
}
