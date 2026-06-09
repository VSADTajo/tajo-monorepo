import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Config
import { JwtConfigModule } from '@config/jwt/jwt-config.module';
import { JwtConfigService } from '@config/jwt/jwt-config.service';

// Command Handlers
import {
    ChangePasswordHandler,
    LoginUserHandler,
    LogoutHandler,
    RefreshTokenHandler,
    RegisterUserHandler,
    ValidateTokenHandler,
} from '@application/commands/auth.commands';

// Controllers
import { AuthController } from '@api/controllers/auth.controller';

@Module({
    imports: [
        CqrsModule,
        InfrastructureModule,
        JwtConfigModule,
        JwtModule.registerAsync({
            imports: [JwtConfigModule],
            inject: [JwtConfigService],
            useFactory: (jwtConfig: JwtConfigService) => ({
                secret: jwtConfig.secret,
                signOptions: {},
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        ChangePasswordHandler,
        LoginUserHandler,
        LogoutHandler,
        RefreshTokenHandler,
        RegisterUserHandler,
        ValidateTokenHandler,
    ],
})
export class ApplicationModule {}
