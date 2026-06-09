import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// ─────────────────────────────────────────────────────────────
// SearchGeoData
// ─────────────────────────────────────────────────────────────

export class SearchGeoDataRequestDto {
    @ApiProperty({
        description: 'Search query text',
        example: 'tajo',
    })
    @IsNotEmpty()
    @IsString()
    q: string;
}

export class SearchGeoDataItemDto {
    @ApiProperty({
        description: 'Origin of the geographic entity (punto_saih, subcuenca, sistema, zona_expl)',
        example: 'punto_saih',
    })
    origen: string;

    @ApiProperty({
        description: 'Entity code',
        example: 'P001',
        nullable: true,
    })
    codigo: string | null;

    @ApiProperty({
        description: 'Entity name',
        example: 'Estación Tajo',
    })
    nombre: string;

    @ApiProperty({
        description: 'Type code',
        example: 'EST',
        nullable: true,
    })
    tipoCod: string | null;

    @ApiProperty({
        description: 'X coordinate (longitude)',
        example: -3.7038,
    })
    x: number;

    @ApiProperty({
        description: 'Y coordinate (latitude)',
        example: 40.4168,
    })
    y: number;

    @ApiProperty({
        description: 'Full search text (nombre + codigo)',
        example: 'Estación Tajo P001',
    })
    searchText: string;
}

export class SearchGeoDataResponseDto {
    @ApiProperty({
        description: 'List of matching geographic entities',
        type: [SearchGeoDataItemDto],
    })
    results: SearchGeoDataItemDto[];

    @ApiProperty({
        description: 'Number of results returned',
        example: 15,
    })
    count: number;
}
