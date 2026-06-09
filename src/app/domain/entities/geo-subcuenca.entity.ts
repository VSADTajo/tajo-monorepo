import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('cht_subcuencas')
export class GeoSubcuenca {
    @PrimaryColumn({ name: 'ogc_fid' })
    ogcFid: number;

    @Column('varchar', { nullable: true })
    code: string;

    @Column('varchar', { nullable: true })
    name: string;

    @Column('double precision', { nullable: true })
    area: number;

    @Column('double precision', { nullable: true })
    perimetro: number;

    @Column('double precision', { name: 'centroid_x', nullable: true })
    centroidX: number;

    @Column('double precision', { name: 'centroid_y', nullable: true })
    centroidY: number;
}
