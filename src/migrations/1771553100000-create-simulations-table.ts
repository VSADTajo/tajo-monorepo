import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSimulationsTable1771553100000 implements MigrationInterface {
    name = 'CreateSimulationsTable1771553100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "simulation_status_enum" AS ENUM ('CREATED', 'MODEL_PROCESSING', 'IN_PROGRESS', 'FINALIZED', 'MODEL_FAILED')
        `);

        await queryRunner.query(`
            CREATE TYPE "simulation_type_enum" AS ENUM ('AUTOMATIC', 'MANUAL', 'FORECAST')
        `);

        await queryRunner.query(`
            CREATE TABLE "simulations" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "simulationDate" character varying(14) NOT NULL,
                "jobType" character varying(20),
                "method" character varying(10),
                "modmeteo" character varying(20),
                "modmeteots" character varying(10),
                "ensemble" character varying(5),
                "status" "simulation_status_enum" NOT NULL DEFAULT 'CREATED',
                "type" "simulation_type_enum" NOT NULL DEFAULT 'AUTOMATIC',
                "environment" character varying(30),
                "state" character varying(1),
                "basin" character varying(100),
                "description" text,
                "createdBy" character varying(100),
                CONSTRAINT "UQ_simulations_date_env_modmeteo" UNIQUE ("simulationDate", "environment", "modmeteo"),
                CONSTRAINT "PK_simulations_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_simulations_date" ON "simulations" ("simulationDate")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_simulations_status_created" ON "simulations" ("status", "createdAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "simulations"');

        await queryRunner.query('DROP TYPE "simulation_type_enum"');

        await queryRunner.query('DROP TYPE "simulation_status_enum"');
    }
}
