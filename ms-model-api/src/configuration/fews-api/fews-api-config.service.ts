import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '@config/configuration.type';

@Injectable()
export class FewsApiConfigService {
    constructor(private configService: ConfigService<AllConfig>) {}

    public get baseUrl(): string {
        return this.configService.getOrThrow('fews-api.baseUrl', { infer: true });
    }

    public get servicePath(): string {
        return this.configService.getOrThrow('fews-api.servicePath', { infer: true });
    }

    public get workflowId(): string {
        return this.configService.getOrThrow('fews-api.workflowId', { infer: true });
    }

    public get filterId(): string {
        return this.configService.getOrThrow('fews-api.filterId', { infer: true });
    }

    public get username(): string {
        return this.configService.getOrThrow('fews-api.username', { infer: true });
    }

    public get password(): string {
        return this.configService.getOrThrow('fews-api.password', { infer: true });
    }

    public get runUserId(): string {
        return this.configService.getOrThrow('fews-api.runUserId', { infer: true });
    }

    public get runOption(): string {
        return this.configService.getOrThrow('fews-api.runOption', { infer: true });
    }

    public get runStartOffsetMinutes(): number {
        return this.configService.getOrThrow('fews-api.runStartOffsetMinutes', { infer: true });
    }

    public get runHorizonDays(): number {
        return this.configService.getOrThrow('fews-api.runHorizonDays', { infer: true });
    }

    public get taskTimeoutMs(): number {
        return this.configService.getOrThrow('fews-api.taskTimeoutMs', { infer: true });
    }

    public get taskPollIntervalMs(): number {
        return this.configService.getOrThrow('fews-api.taskPollIntervalMs', { infer: true });
    }

    public get requestTimeoutMs(): number {
        return this.configService.getOrThrow('fews-api.requestTimeoutMs', { infer: true });
    }

    public get mockBaseUrl(): string {
        return this.configService.getOrThrow('fews-api.mockBaseUrl', { infer: true });
    }

    public get mockRunningMs(): number {
        return this.configService.getOrThrow('fews-api.mockRunningMs', { infer: true });
    }
}
