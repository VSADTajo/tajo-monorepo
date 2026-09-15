import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCaudalFlagsToStations1771567000000 implements MigrationInterface {
    name = 'AddCaudalFlagsToStations1771567000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "hasCaudalNam" boolean NOT NULL DEFAULT false');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "hasCaudalMike" boolean NOT NULL DEFAULT false');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "hasCaudalMike"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "hasCaudalNam"');
    }
}
