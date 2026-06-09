import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IGeoDataRepository } from '@domain/ports/geo-data-repository.port';
import { SearchGeoDataResult } from '@domain/results/search-geo-data.result';
import { MvChtUnificada } from '@domain/entities/mv-cht-unificada.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class GeoDataRepository extends IGeoDataRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(MvChtUnificada, 'geoserver')
        private readonly mvChtUnificadaRepository: Repository<MvChtUnificada>,
    ) {
        super();
    }

    async search(query: string): Promise<SearchGeoDataResult[]> {
        try {
            this.logger.log(`Searching geo data with query: ${query}`);

            // Normalize: lowercase + collapse separators to spaces
            const normalized = query
                .toLowerCase()
                .replace(/[_\-\.]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            // Compact: remove all separators (E_03 = E 03 = E3)
            const compact = normalized.replace(/\s+/g, '');

            const rows: Array<{
                origen: string;
                codigo: string;
                nombre: string;
                tipo_cod: string;
                x: number;
                y: number;
                search_text: string;
            }> = await this.mvChtUnificadaRepository.manager.query(
                `
                SELECT origen, codigo, nombre, tipo_cod, x, y, search_text,
                    GREATEST(
                        CASE WHEN lower(search_text) LIKE $2 THEN 1.0 ELSE 0.0 END,
                        CASE WHEN regexp_replace(lower(search_text), '[_\\-.\\s]+', '', 'g') LIKE $3 THEN 0.9 ELSE 0.0 END,
                        word_similarity($1, lower(search_text))
                    ) AS score
                FROM mv_cht_unificada
                WHERE
                    lower(search_text) LIKE $2
                    OR regexp_replace(lower(search_text), '[_\\-.\\s]+', '', 'g') LIKE $3
                    OR word_similarity($1, lower(search_text)) > 0.25
                ORDER BY score DESC, nombre ASC
                LIMIT 20
                `,
                [normalized, `%${normalized}%`, `%${compact}%`],
            );

            return rows.map(
                (r) =>
                    new SearchGeoDataResult({
                        origen: r.origen,
                        codigo: r.codigo,
                        nombre: r.nombre,
                        tipoCod: r.tipo_cod,
                        x: r.x,
                        y: r.y,
                        searchText: r.search_text,
                    }),
            );
        } catch (error) {
            this.logger.error({ msg: 'Error searching geo data', entity: 'GeoData', error: String(error) });
            throw new RepositoryError('Failed to search geo data', error);
        }
    }
}
