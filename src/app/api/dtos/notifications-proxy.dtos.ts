import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Shared: NotificationItem
// ─────────────────────────────────────────────────────────────

export class NotificationItemDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
    @ApiProperty({ example: 'THRESHOLD_EXCEEDED' }) type: string;
    @ApiProperty({ example: 'ms-predictions-api' }) source: string;
    @ApiProperty({ example: 'Umbral superado en estación AC01' }) title: string;
    @ApiProperty({ example: 'El valor predicho 6.2 superó el umbral de 5.5' }) message: string;
    @ApiProperty({ nullable: true, example: { stationId: 'AC01', actualValue: 6.2 } }) metadata: Record<
        string,
        unknown
    > | null;
    @ApiProperty({ example: 'CRITICAL' }) severity: string;
    @ApiProperty({ example: 'UNREAD' }) status: string;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) createdAt: Date | undefined;
    @ApiProperty({ example: '2026-03-24T00:00:00.000Z' }) updatedAt: Date | undefined;
}

// ─────────────────────────────────────────────────────────────
// ListNotifications
// ─────────────────────────────────────────────────────────────

export class ListNotificationsResponseDto {
    @ApiProperty({ type: [NotificationItemDto] }) items: NotificationItemDto[];
    @ApiProperty({ example: 42 }) total: number;
}
