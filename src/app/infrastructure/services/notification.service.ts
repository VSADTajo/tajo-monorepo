import { Injectable } from '@nestjs/common';

import { INotificationService } from '@domain/ports/notification-service.port';

@Injectable()
export class NotificationService implements INotificationService {}
