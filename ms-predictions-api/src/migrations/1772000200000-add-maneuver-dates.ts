import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManeuverDates1772000200000 implements MigrationInterface {
    name = 'AddManeuverDates1772000200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "maneuvers"
            ADD COLUMN "startDate" TIMESTAMP,
            ADD COLUMN "endDate" TIMESTAMP
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "maneuvers"
            DROP COLUMN "endDate",
            DROP COLUMN "startDate"
        `);
    }
}
