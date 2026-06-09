import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBasinsTable1771553000000 implements MigrationInterface {
    name = 'CreateBasinsTable1771553000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "basins" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "code" character varying(20) NOT NULL,
                "description" character varying(255),
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_basins_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_basins_name" UNIQUE ("name"),
                CONSTRAINT "UQ_basins_code" UNIQUE ("code")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "basins"');
    }
}
