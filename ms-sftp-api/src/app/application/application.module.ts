import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthMiddleware } from '@infrastructure/middleware/auth.middleware';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Handlers
import { UploadFileHandler, MoveFileHandler, DeleteFileHandler } from '@application/commands/file.commands';
import {
    SftpDownloadToLocalHandler,
    SftpMoveFileHandler,
    SftpDeleteFileHandler,
} from '@application/commands/sftp.commands';
import {
    CreateMappingSchemaHandler,
    UpdateMappingSchemaHandler,
    DeleteMappingSchemaHandler,
    ToggleMappingSchemaHandler,
} from '@application/commands/mapping-schema.commands';
import {
    CreateSftpUserHandler,
    UpdateSftpUserHandler,
    DeleteSftpUserHandler,
    ToggleSftpUserHandler,
} from '@application/commands/sftp-user.commands';
import {
    CreateCleanupJobHandler,
    UpdateCleanupJobHandler,
    ToggleCleanupJobHandler,
    DeleteCleanupJobHandler,
} from '@application/commands/cleanup-job.commands';

// Query Handlers
import {
    ListFilesHandler,
    DownloadFileHandler,
    ReadFileTextHandler,
    ListPathsOverviewHandler,
} from '@application/queries/file.queries';
import { SftpListFilesHandler, SftpDownloadFileHandler } from '@application/queries/sftp.queries';
import {
    ListMappingSchemasHandler,
    GetMappingSchemaByIdHandler,
    GetActiveMappingSchemaByPathHandler,
} from '@application/queries/mapping-schema.queries';
import { ListSftpUsersHandler, GetSftpUserByIdHandler } from '@application/queries/sftp-user.queries';
import {
    GetCleanupJobByIdHandler,
    GetCleanupJobByPathHandler,
    ListCleanupJobsHandler,
} from '@application/queries/cleanup-job.queries';

// Controllers
import { FileController } from '@api/controllers/file.controller';
import { SftpController } from '@api/controllers/sftp.controller';
import { MappingSchemaController } from '@api/controllers/mapping-schema.controller';
import { SftpUserController } from '@api/controllers/sftp-user.controller';
import { CleanupJobController } from '@api/controllers/cleanup-job.controller';

// Consumers
import { ExampleConsumer } from '@application/consumers/example.consumer';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [
        FileController,
        SftpController,
        MappingSchemaController,
        SftpUserController,
        CleanupJobController,
        ExampleConsumer,
    ],
    providers: [
        // File Storage (Local)
        UploadFileHandler,
        MoveFileHandler,
        DeleteFileHandler,
        ListFilesHandler,
        DownloadFileHandler,
        ReadFileTextHandler,
        ListPathsOverviewHandler,
        // SFTP Client
        SftpListFilesHandler,
        SftpDownloadFileHandler,
        SftpDownloadToLocalHandler,
        SftpMoveFileHandler,
        SftpDeleteFileHandler,
        // Mapping Schema
        CreateMappingSchemaHandler,
        UpdateMappingSchemaHandler,
        DeleteMappingSchemaHandler,
        ToggleMappingSchemaHandler,
        ListMappingSchemasHandler,
        GetMappingSchemaByIdHandler,
        GetActiveMappingSchemaByPathHandler,
        // SFTP Users
        CreateSftpUserHandler,
        UpdateSftpUserHandler,
        DeleteSftpUserHandler,
        ToggleSftpUserHandler,
        ListSftpUsersHandler,
        GetSftpUserByIdHandler,
        // Cleanup Jobs
        CreateCleanupJobHandler,
        UpdateCleanupJobHandler,
        ToggleCleanupJobHandler,
        DeleteCleanupJobHandler,
        GetCleanupJobByIdHandler,
        GetCleanupJobByPathHandler,
        ListCleanupJobsHandler,
    ],
})
export class ApplicationModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthMiddleware).exclude({ path: 'health', method: RequestMethod.GET }).forRoutes('*');
    }
}
