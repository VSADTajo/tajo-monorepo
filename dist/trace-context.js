"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceContext = void 0;
const common_1 = require("@nestjs/common");
const nestjs_cls_1 = require("nestjs-cls");
let TraceContext = class TraceContext {
    constructor(cls) {
        this.cls = cls;
    }
    get traceId() {
        return this.cls.isActive() ? (this.cls.get('traceId') ?? null) : null;
    }
    set traceId(value) {
        if (this.cls.isActive())
            this.cls.set('traceId', value);
    }
    get userId() {
        return this.cls.isActive() ? (this.cls.get('userId') ?? null) : null;
    }
    set userId(value) {
        if (this.cls.isActive())
            this.cls.set('userId', value ?? null);
    }
    get serviceName() {
        return this.cls.isActive() ? (this.cls.get('serviceName') ?? '') : '';
    }
    set serviceName(value) {
        if (this.cls.isActive())
            this.cls.set('serviceName', value);
    }
    get startTime() {
        return this.cls.isActive() ? (this.cls.get('startTime') ?? Date.now()) : Date.now();
    }
    set startTime(value) {
        if (this.cls.isActive())
            this.cls.set('startTime', value);
    }
    get logsApiUrl() {
        return this.cls.isActive() ? (this.cls.get('logsApiUrl') ?? '') : '';
    }
    set logsApiUrl(value) {
        if (this.cls.isActive())
            this.cls.set('logsApiUrl', value);
    }
    async runInContext(traceId, fn) {
        return this.cls.run(async () => {
            this.traceId = traceId;
            return fn();
        });
    }
};
exports.TraceContext = TraceContext;
exports.TraceContext = TraceContext = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_cls_1.ClsService])
], TraceContext);
//# sourceMappingURL=trace-context.js.map