import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubBasinsTable1771554000000 implements MigrationInterface {
    name = 'CreateSubBasinsTable1771554000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "sub_basins" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "code" character varying(20) NOT NULL,
                "basinId" uuid NOT NULL,
                "description" character varying(255),
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_sub_basins_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_sub_basins_code" UNIQUE ("code"),
                CONSTRAINT "UQ_sub_basins_name_basinId" UNIQUE ("name", "basinId"),
                CONSTRAINT "FK_sub_basins_basinId" FOREIGN KEY ("basinId") REFERENCES "basins"("id") ON DELETE RESTRICT
            )
        `);

        await queryRunner.query('CREATE INDEX "IDX_sub_basins_basinId" ON "sub_basins" ("basinId")');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_sub_basins_basinId"');
        await queryRunner.query('DROP TABLE "sub_basins"');
    }
}
