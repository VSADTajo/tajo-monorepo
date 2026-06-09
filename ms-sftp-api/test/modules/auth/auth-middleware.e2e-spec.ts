import {
    INestApplication,
    HttpStatus,
    Controller,
    Get,
    Logger,
    MiddlewareConsumer,
    Module,
    NestModule,
    RequestMethod,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LoggerModule } from 'nestjs-pino';

import { IAuthValidationService } from '../../../src/app/domain/ports/auth-validation.port';
import { ProviderError } from '../../../src/app/domain/errors/provider.error';
import { AuthMiddleware } from '../../../src/app/infrastructure/middleware/auth.middleware';
import { HttpExceptionFilter } from '../../../src/common/exceptions/http.exception';

@Controller()
class TestController {
    @Get('test')
    test() {
        return { ok: true };
    }

    @Get('health')
    health() {
        return { status: 'ok' };
    }
}

const mockAuthValidationService = {
    validate: jest.fn(),
};

@Module({
    imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
    controllers: [TestController],
    providers: [
        Logger,
        { provide: IAuthValidationService, useValue: mockAuthValidationService },
        AuthMiddleware,
        HttpExceptionFilter,
    ],
})
class TestAppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthMiddleware).exclude({ path: 'health', method: RequestMethod.GET }).forRoutes('*');
    }
}

describe('AuthMiddleware (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [TestAppModule],
        }).compile();

        app = module.createNestApplication();
        app.useGlobalFilters(app.get(HttpExceptionFilter));
        await app.init();
    }, 30_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('(1) should return 401 when Authorization header is missing', async () => {
        await request(app.getHttpServer()).get('/test').expect(HttpStatus.UNAUTHORIZED);
    });

    it('(2) should return 401 when validate() returns { valid: false }', async () => {
        mockAuthValidationService.validate.mockResolvedValue({ valid: false });

        await request(app.getHttpServer())
            .get('/test')
            .set('Authorization', 'Bearer invalid-token')
            .expect(HttpStatus.UNAUTHORIZED);
    });

    it('(3) should allow request and set req.user when validate() returns { valid: true }', async () => {
        mockAuthValidationService.validate.mockResolvedValue({
            valid: true,
            userId: 'user-123',
            roles: ['admin'],
        });

        await request(app.getHttpServer())
            .get('/test')
            .set('Authorization', 'Bearer valid-token')
            .expect(HttpStatus.OK)
            .expect({ ok: true });

        expect(mockAuthValidationService.validate).toHaveBeenCalledWith('valid-token');
    });

    it('(4) should return 503 when validate() throws ProviderError', async () => {
        mockAuthValidationService.validate.mockRejectedValue(new ProviderError('Auth service down'));

        await request(app.getHttpServer())
            .get('/test')
            .set('Authorization', 'Bearer some-token')
            .expect(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('(5) GET /health without token should return 200 (excluded from middleware)', async () => {
        await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);

        expect(mockAuthValidationService.validate).not.toHaveBeenCalled();
    });
});
