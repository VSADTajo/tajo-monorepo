import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSftpUsersTable1741300000001 implements MigrationInterface {
    name = 'AddSftpUsersTable1741300000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "sftp_users" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "username" character varying(100) NOT NULL,
                "password" character varying(255) NOT NULL,
                "rootDirectory" character varying(500) NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_sftp_user_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_sftp_user_username" UNIQUE ("username")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "sftp_users"');
    }
}
