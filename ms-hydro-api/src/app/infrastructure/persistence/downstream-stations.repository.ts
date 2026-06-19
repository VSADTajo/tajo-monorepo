import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IDownstreamStationsRepository } from '@domain/ports/downstream-stations-repository.port';
import { MvEstacionesAguasAbajo } from '@domain/entities/mv-estaciones-aguas-abajo.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class DownstreamStationsRepository extends IDownstreamStationsRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(MvEstacionesAguasAbajo, 'geoserver')
        private readonly mvEstacionesAguasAbajoRepository: Repository<MvEstacionesAguasAbajo>,
    ) {
        super();
    }

    async findDownstream(
        codes: string[],
    ): Promise<{ codigoDestino: string; nombreDestino: string; tipoDestino: string }[]> {
        if (codes.length === 0) {
            return [];
        }

        try {
            this.logger.log(`Finding downstream stations for codes: ${codes.join(', ')}`);

            const rows: Array<{
                codigo_destino: string;
                nombre_destino: string;
                tipo_destino: string;
            }> = await this.mvEstacionesAguasAbajoRepository.manager.query(
                `
                SELECT DISTINCT codigo_destino, nombre_destino, tipo_destino
                FROM mv_estaciones_aguas_abajo
                WHERE codigo_origen = ANY($1)
                `,
                [codes],
            );

            return rows.map((r) => ({
                codigoDestino: r.codigo_destino,
                nombreDestino: r.nombre_destino,
                tipoDestino: r.tipo_destino,
            }));
        } catch (error) {
            this.logger.error({ msg: 'Error finding downstream stations', error: String(error) });
            throw new RepositoryError('Failed to find downstream stations', error);
        }
    }
}
