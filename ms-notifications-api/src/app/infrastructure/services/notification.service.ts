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

    async sendWelcomeEmail(_to: string, _userName: string): Promise<SendEmailResult> {
        this.logger.log({ msg: 'Sending welcome email', entity: 'Notifications' });

        // Mock: simulate external email provider latency
        await new Promise((resolve) => setTimeout(resolve, 100));

        const emailId = uuidv4();

        this.logger.log({ msg: 'Welcome email sent', entity: 'Notifications', emailId });

        return {
            emailId,
            sentAt: new Date(),
        };
    }
}
