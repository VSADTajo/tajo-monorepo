import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCaudalColumnsToVarchar1771564000000 implements MigrationInterface {
    name = 'ChangeCaudalColumnsToVarchar1771564000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "station_thresholds"
                ALTER COLUMN "caudalEntrada" TYPE character varying(20) USING "caudalEntrada"::text,
                ALTER COLUMN "caudalSalida"  TYPE character varying(20) USING "caudalSalida"::text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "station_thresholds"
                ALTER COLUMN "caudalEntrada" TYPE double precision USING "caudalEntrada"::double precision,
                ALTER COLUMN "caudalSalida"  TYPE double precision USING "caudalSalida"::double precision
        `);
    }
}
