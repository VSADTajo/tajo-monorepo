import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStationResguardosTable1771562000000 implements MigrationInterface {
    name = 'CreateStationResguardosTable1771562000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "organismo_enum" AS ENUM (
                'EXPLOTACION',
                'PROYECTOS_Y_OBRAS',
                'CYII',
                'UNION_FENOSA',
                'IBERDROLA',
                'OTROS'
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "station_resguardos" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "stationId" uuid NOT NULL,
                "date" date NOT NULL,
                "organismo" "organismo_enum" NOT NULL DEFAULT 'EXPLOTACION',
                "volumenResguardoOriginal" double precision,
                "cotaResguardoOriginal" double precision,
                "volumenMinimoOriginal" double precision,
                "volumenResguardo" double precision,
                "cotaResguardo" double precision,
                "volumenMinimo" double precision,
                CONSTRAINT "PK_station_resguardos_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_station_resguardos_station_date" UNIQUE ("stationId", "date"),
                CONSTRAINT "FK_station_resguardos_stationId" FOREIGN KEY ("stationId")
                    REFERENCES "stations"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_station_resguardos_stationId" ON "station_resguardos" ("stationId")',
        );
        await queryRunner.query('CREATE INDEX "IDX_station_resguardos_date" ON "station_resguardos" ("date")');
        await queryRunner.query(
            'CREATE INDEX "IDX_station_resguardos_organismo" ON "station_resguardos" ("organismo")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_station_resguardos_organismo"');
        await queryRunner.query('DROP INDEX "IDX_station_resguardos_date"');
        await queryRunner.query('DROP INDEX "IDX_station_resguardos_stationId"');
        await queryRunner.query('DROP TABLE "station_resguardos"');
        await queryRunner.query('DROP TYPE "organismo_enum"');
    }
}
