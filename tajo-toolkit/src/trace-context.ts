import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TraceContext {
  constructor(private readonly cls: ClsService) {}

  get traceId(): string | null {
    return this.cls.isActive() ? (this.cls.get('traceId') ?? null) : null;
  }

  set traceId(value: string) {
    if (this.cls.isActive()) this.cls.set('traceId', value);
  }

  get userId(): string | null {
    return this.cls.isActive() ? (this.cls.get('userId') ?? null) : null;
  }

  set userId(value: string | null) {
    if (this.cls.isActive()) this.cls.set('userId', value ?? null);
  }

  get serviceName(): string {
    return this.cls.isActive() ? (this.cls.get('serviceName') ?? '') : '';
  }

  set serviceName(value: string) {
    if (this.cls.isActive()) this.cls.set('serviceName', value);
  }

  get startTime(): number {
    return this.cls.isActive() ? (this.cls.get('startTime') ?? Date.now()) : Date.now();
  }

  set startTime(value: number) {
    if (this.cls.isActive()) this.cls.set('startTime', value);
  }

  get logsApiUrl(): string {
    return this.cls.isActive() ? (this.cls.get('logsApiUrl') ?? '') : '';
  }

  set logsApiUrl(value: string) {
    if (this.cls.isActive()) this.cls.set('logsApiUrl', value);
  }

  async runInContext<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.traceId = traceId;
      return fn();
    });
  }
}
