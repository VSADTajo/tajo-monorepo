import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePredictionTypesTable1771553000000 implements MigrationInterface {
    name = 'CreatePredictionTypesTable1771553000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "prediction_types" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "unit" character varying(20) NOT NULL,
                CONSTRAINT "UQ_prediction_types_name" UNIQUE ("name"),
                CONSTRAINT "PK_prediction_types_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            INSERT INTO "prediction_types" ("name", "unit") VALUES
                ('Precipitation_forecast', 'mm'),
                ('Discharge_forecast', 'm3/s'),
                ('Precipitation', 'mm'),
                ('Discharge', 'm3/s')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "prediction_types"');
    }
}
