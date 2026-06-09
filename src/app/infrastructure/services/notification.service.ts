import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

import { INotificationService, SendEmailResult } from '@domain/ports/notification-service.port';

@Injectable()
export class NotificationService implements INotificationService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
    ) {}

    async sendWelcomeEmail(to: string, userName: string): Promise<SendEmailResult> {
        this.logger.log(`Sending welcome email to ${to} for user ${userName}`);

        // Mock: simulate external email provider latency
        await new Promise((resolve) => setTimeout(resolve, 100));

        const emailId = uuidv4();

        this.logger.log({ msg: 'Welcome email sent', entity: 'Users', to, emailId });

        return {
            emailId,
            sentAt: new Date(),
        };
    }
}
