import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScenariosTable1771565000000 implements MigrationInterface {
    name = 'CreateScenariosTable1771565000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "scenarios" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "description" text,
                "payload" jsonb NOT NULL,
                "itemsCount" integer NOT NULL DEFAULT 0,
                "sizeBytes" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_scenarios_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_scenarios_createdAt" ON "scenarios" ("createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_scenarios_createdAt"`);
        await queryRunner.query(`DROP TABLE "scenarios"`);
    }
}
