import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('cht_puntos_saih')
export class GeoPuntoSaih {
    @PrimaryColumn({ name: 'ogc_fid' })
    ogcFid: number;

    @Column('varchar', { nullable: true })
    codigo: string;

    @Column('varchar', { nullable: true })
    nombre: string;

    @Column('varchar', { name: 'tipo_cod', nullable: true })
    tipoCod: string;

    @Column('varchar', { nullable: true })
    tipo: string;

    @Column('varchar', { nullable: true })
    zona: string;

    @Column('varchar', { nullable: true })
    municipio: string;

    @Column('varchar', { nullable: true })
    provincia: string;

    @Column('varchar', { nullable: true })
    ccaa: string;
}
