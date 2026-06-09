import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStationsTable1771555000000 implements MigrationInterface {
    name = 'CreateStationsTable1771555000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "station_type_enum" AS ENUM ('HYDROLOGICAL', 'METEOROLOGICAL', 'PLUVIOMETRIC')
        `);

        await queryRunner.query(`
            CREATE TABLE "stations" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "subBasinName" character varying(100) NOT NULL,
                "stationCode" character varying(50) NOT NULL,
                "umbral" double precision,
                "stationType" "station_type_enum" NOT NULL,
                "subBasinId" uuid NOT NULL,
                "latitude" double precision,
                "longitude" double precision,
                "altitude" double precision,
                "description" character varying(255),
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_stations_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_stations_subBasinName" UNIQUE ("subBasinName"),
                CONSTRAINT "UQ_stations_stationCode" UNIQUE ("stationCode"),
                CONSTRAINT "FK_stations_subBasinId" FOREIGN KEY ("subBasinId") REFERENCES "sub_basins"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query('CREATE INDEX "IDX_stations_subBasinId" ON "stations" ("subBasinId")');
        await queryRunner.query('CREATE INDEX "IDX_stations_stationType" ON "stations" ("stationType")');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_stations_stationType"');
        await queryRunner.query('DROP INDEX "IDX_stations_subBasinId"');
        await queryRunner.query('DROP TABLE "stations"');
        await queryRunner.query('DROP TYPE "station_type_enum"');
    }
}
