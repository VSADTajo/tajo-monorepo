import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePredictionsTable1771553200000 implements MigrationInterface {
    name = 'CreatePredictionsTable1771553200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "predictions" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "stationId" uuid NOT NULL,
                "stationName" character varying(200),
                "predictionTypeId" uuid NOT NULL,
                "simulationId" uuid NOT NULL,
                "predictionDate" TIMESTAMP,
                "predictionStartDate" TIMESTAMP,
                "predictionEndDate" TIMESTAMP,
                "ensemble" character varying(5),
                "percentile" decimal(5,1),
                "predictionProvider" character varying(20),
                "predictedBy" character varying(30),
                CONSTRAINT "UQ_predictions_sim_station_type_ens_pct" UNIQUE ("simulationId", "stationId", "predictionTypeId", "ensemble", "percentile"),
                CONSTRAINT "FK_predictions_predictionTypeId" FOREIGN KEY ("predictionTypeId") REFERENCES "prediction_types"("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_predictions_simulationId" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE,
                CONSTRAINT "PK_predictions_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_predictions_stationId_created" ON "predictions" ("stationId", "createdAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_predictions_typeId_created" ON "predictions" ("predictionTypeId", "createdAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_predictions_simulationId" ON "predictions" ("simulationId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_predictions_station_type" ON "predictions" ("stationId", "predictionTypeId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_predictions_provider_created" ON "predictions" ("predictionProvider", "createdAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "predictions"');
    }
}
