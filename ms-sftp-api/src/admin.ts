/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable quotes */
import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { Router } from 'express';

import { AppConfigService } from '@config/app/app-config.service';
import { connectionSource } from '@config/postgres/db-config';

export async function setupAdminPanel(app: INestApplication): Promise<void> {
    const configService = app.get(AppConfigService);
    // Disable admin panel in production
    if (configService.nodeEnv === 'production') {
        return;
    }

    const adminJS = await import('adminjs');
    const AdminJS = adminJS.default || adminJS;

    const { ComponentLoader } = adminJS;

    const AdminJSExpress = await import('@adminjs/express');
    const AdminJSTypeorm = await import('@adminjs/typeorm');

    AdminJS.registerAdapter({
        Resource: AdminJSTypeorm.Resource,
        Database: AdminJSTypeorm.Database,
    });

    const componentLoader = new ComponentLoader();

    const adminJs = new AdminJS({
        databases: [connectionSource],
        rootPath: '/admin',
        componentLoader,
        resources: [],
        branding: {
            companyName: 'NestJS Boilerplate Admin',
        },
    });

    const adminRouter = Router();
    adminRouter.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "'blob:'"],
                    imgSrc: ["'self'", 'data:', 'blob:'],
                    connectSrc: ["'self'", 'https://api.adminjs.co'],
                    fontSrc: ["'self'", 'data:'],
                },
            },
        }),
    );

    const adminAuthenticatedJSRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate: async (email, password) => {
            try {
                // this is for easy login in dev mode
                if (configService.nodeEnv === 'development') {
                    return { email, password };
                }
                const adminEmail = 'admin@admin.com';
                const adminPassword = 'admin';
                if (email === adminEmail && password === adminPassword) {
                    return { email };
                }
                return null;
            } catch (err) {
                return null;
            }
        },
        cookieName: 'adminjs',
        cookiePassword: 'admin',
    });

    adminRouter.use('/', adminAuthenticatedJSRouter);
    app.use(adminJs.options.rootPath, adminRouter);

    void adminJs.watch();
}
