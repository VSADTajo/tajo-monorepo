import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1710936000000 implements MigrationInterface {
    name = 'CreateNotificationsTable1710936000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        /* eslint-disable @typescript-eslint/quotes, prettier/prettier, quotes */
        await queryRunner.query(`CREATE TYPE "notification_severity_enum" AS ENUM ('INFO', 'WARNING', 'CRITICAL')`);
        await queryRunner.query(`CREATE TYPE "notification_status_enum" AS ENUM ('UNREAD', 'READ', 'ARCHIVED')`);
        /* eslint-enable @typescript-eslint/quotes, prettier/prettier, quotes */

        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" character varying(100) NOT NULL,
                "source" character varying(100) NOT NULL,
                "title" character varying(255) NOT NULL,
                "message" text NOT NULL,
                "metadata" jsonb DEFAULT '{}',
                "severity" "notification_severity_enum" NOT NULL,
                "status" "notification_status_enum" NOT NULL DEFAULT 'UNREAD',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_notifications_status_created" ON "notifications" ("status", "createdAt" DESC)',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_notifications_source_created" ON "notifications" ("source", "createdAt" DESC)',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_notifications_severity_created" ON "notifications" ("severity", "createdAt" DESC)',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_notifications_type_created" ON "notifications" ("type", "createdAt" DESC)',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_notifications_type_created"');
        await queryRunner.query('DROP INDEX "IDX_notifications_severity_created"');
        await queryRunner.query('DROP INDEX "IDX_notifications_source_created"');
        await queryRunner.query('DROP INDEX "IDX_notifications_status_created"');
        await queryRunner.query('DROP TABLE "notifications"');
        await queryRunner.query('DROP TYPE "notification_status_enum"');
        await queryRunner.query('DROP TYPE "notification_severity_enum"');
    }
}
