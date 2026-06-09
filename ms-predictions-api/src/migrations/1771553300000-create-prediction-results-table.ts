import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePredictionResultsTable1771553300000 implements MigrationInterface {
    name = 'CreatePredictionResultsTable1771553300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "prediction_results" (
                "id" BIGSERIAL NOT NULL,
                "predictionId" uuid NOT NULL,
                "date" TIMESTAMP NOT NULL,
                "value" double precision NOT NULL,
                "flag" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "FK_prediction_results_predictionId" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE,
                CONSTRAINT "PK_prediction_results_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_prediction_results_prediction_date" ON "prediction_results" ("predictionId", "date")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_prediction_results_date_created" ON "prediction_results" ("date", "createdAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "prediction_results"');
    }
}
