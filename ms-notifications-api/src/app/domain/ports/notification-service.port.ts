export interface SendEmailResult {
    emailId: string;
    sentAt: Date;
}

export abstract class INotificationService {
    abstract sendWelcomeEmail(to: string, userName: string): Promise<SendEmailResult>;
}
