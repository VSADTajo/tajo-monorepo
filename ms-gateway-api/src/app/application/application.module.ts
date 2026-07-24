import { Module } from '@nestjs/common';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Proxy Controllers
import { AuthProxyController } from '@api/controllers/auth-proxy.controller';
import { UserProxyController } from '@api/controllers/user-proxy.controller';
import { RoleProxyController } from '@api/controllers/role-proxy.controller';
import { PredictionsProxyController } from '@api/controllers/predictions-proxy.controller';
import { HydroProxyController } from '@api/controllers/hydro-proxy.controller';
import { NotificationsProxyController } from '@api/controllers/notifications-proxy.controller';
import { MeteoProxyController } from '@api/controllers/meteo-proxy.controller';
import { PermissionProxyController } from '@api/controllers/permission-proxy.controller';
import { GroupProxyController } from '@api/controllers/group-proxy.controller';
import { AerialPrecipitationProxyController } from '@api/controllers/aerial-precipitation-proxy.controller';

@Module({
    imports: [InfrastructureModule],
    controllers: [
        AuthProxyController,
        UserProxyController,
        RoleProxyController,
        PermissionProxyController,
        GroupProxyController,
        PredictionsProxyController,
        HydroProxyController,
        NotificationsProxyController,
        MeteoProxyController,
        AerialPrecipitationProxyController,
    ],
    providers: [],
})
export class ApplicationModule {}
