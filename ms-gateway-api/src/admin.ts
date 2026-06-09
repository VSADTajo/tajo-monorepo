import { INestApplication } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setupAdminPanel(_app: INestApplication): Promise<void> {
    // Admin panel disabled — ms-gateway-api is a pure proxy with no database
}
