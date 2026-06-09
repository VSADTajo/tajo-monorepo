import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';

// ─────────────────────────────────────────────────────────────
// CreateNotification
// ─────────────────────────────────────────────────────────────

export class CreateNotificationRequestDto {
    @ApiProperty({ description: 'Notification type', example: 'THRESHOLD_EXCEEDED' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    type: string;

    @ApiProperty({ description: 'Source service', example: 'ms-predictions-api' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    source: string;

    @ApiProperty({ description: 'Notification title', example: 'Umbral superado en estación X' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    title: string;

    @ApiProperty({ description: 'Notification message', example: 'El nivel de agua supera el umbral configurado' })
    @IsNotEmpty()
    @IsString()
    message: string;

    @ApiProperty({ description: 'Severity level', enum: NotificationSeverity, example: NotificationSeverity.CRITICAL })
    @IsNotEmpty()
    @IsEnum(NotificationSeverity)
    severity: NotificationSeverity;

    @ApiPropertyOptional({ description: 'Additional metadata', example: { stationId: 'uuid', thresholdValue: 5.0 } })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// ListNotifications Query
// ─────────────────────────────────────────────────────────────

export class ListNotificationsQueryDto {
    @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', example: 20, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    pageSize?: number = 20;

    @ApiPropertyOptional({ description: 'Filter by status (comma-separated)', example: 'UNREAD,READ' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Filter by severity', enum: NotificationSeverity })
    @IsOptional()
    @IsEnum(NotificationSeverity)
    severity?: NotificationSeverity;

    @ApiPropertyOptional({ description: 'Filter by source service', example: 'ms-predictions-api' })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ description: 'Filter by notification type', example: 'THRESHOLD_EXCEEDED' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ description: 'Filter from date (ISO8601)', example: '2026-01-01T00:00:00.000Z' })
    @IsOptional()
    @IsString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'Filter to date (ISO8601)', example: '2026-12-31T23:59:59.999Z' })
    @IsOptional()
    @IsString()
    toDate?: string;
}

// ─────────────────────────────────────────────────────────────
// Notification ID Param
// ─────────────────────────────────────────────────────────────

export class NotificationIdParamDto {
    @ApiProperty({ description: 'Notification UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    @IsUUID('4')
    id: string;
}

// ─────────────────────────────────────────────────────────────
// Bulk Operations
// ─────────────────────────────────────────────────────────────

export class BulkIdsRequestDto {
    @ApiProperty({ description: 'Array of notification UUIDs', example: ['uuid-1', 'uuid-2'] })
    @IsArray()
    @ArrayMaxSize(100)
    @IsUUID('4', { each: true })
    ids: string[];
}

// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────

export class NotificationResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    id: string;

    @ApiProperty({ example: 'THRESHOLD_EXCEEDED' })
    type: string;

    @ApiProperty({ example: 'ms-predictions-api' })
    source: string;

    @ApiProperty({ example: 'Umbral superado en estación X' })
    title: string;

    @ApiProperty({ example: 'El nivel de agua supera el umbral configurado' })
    message: string;

    @ApiProperty({ example: { stationId: 'uuid', thresholdValue: 5.0 } })
    metadata: Record<string, unknown>;

    @ApiProperty({ enum: NotificationSeverity, example: NotificationSeverity.CRITICAL })
    severity: string;

    @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.UNREAD })
    status: string;

    @ApiProperty({ example: '2026-03-20T10:00:00.000Z' })
    createdAt: string;

    @ApiProperty({ example: '2026-03-20T10:00:00.000Z' })
    updatedAt: string;
}

export class ListNotificationsResponseDto {
    @ApiProperty({ type: [NotificationResponseDto] })
    data: NotificationResponseDto[];

    @ApiProperty({ example: 150 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 20 })
    pageSize: number;

    @ApiProperty({ example: 8 })
    totalPages: number;
}

export class UpdateNotificationResponseDto {
    @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    id: string;

    @ApiProperty({ enum: NotificationStatus, example: NotificationStatus.READ })
    status: string;

    @ApiProperty({ example: '2026-03-20T10:05:00.000Z' })
    updatedAt: string;
}

export class BulkUpdateResponseDto {
    @ApiProperty({ example: ['uuid-1', 'uuid-2'] })
    updated: string[];

    @ApiProperty({ example: ['uuid-3'] })
    notFound: string[];
}
