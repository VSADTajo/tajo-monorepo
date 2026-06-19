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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceMiddleware = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const nestjs_cls_1 = require("nestjs-cls");
const trace_context_1 = require("./trace-context");
const types_1 = require("./types");
let TraceMiddleware = class TraceMiddleware {
    constructor(traceContext, cls, options) {
        this.traceContext = traceContext;
        this.cls = cls;
        this.options = options;
    }
    use(req, res, next) {
        this.cls.run(() => {
            const incomingTraceId = req.headers[types_1.X_TRACE_ID_HEADER];
            const traceId = incomingTraceId && (0, uuid_1.validate)(incomingTraceId)
                ? incomingTraceId
                : (0, uuid_1.v4)();
            const incomingUserId = req.headers[types_1.X_USER_ID_HEADER];
            this.traceContext.traceId = traceId;
            this.traceContext.userId = incomingUserId ?? null;
            this.traceContext.serviceName = this.options.serviceName;
            this.traceContext.startTime = Date.now();
            this.traceContext.logsApiUrl = this.options.logsApiUrl;
            // Re-inject the resolved trace-id into the request headers so any downstream
            // reader (e.g. pino-http's genReqId) uses the SAME id as the CLS context.
            req.headers[types_1.X_TRACE_ID_HEADER] = traceId;
            res.setHeader(types_1.X_TRACE_ID_HEADER, traceId);
            if (this.options.logRequests) {
                res.on('finish', () => {
                    this.shipLog(req, res);
                });
            }
            next();
        });
    }
    shipLog(req, res) {
        const path = req.originalUrl || req.url;
        if (path === '/health' || path === '/api/health') {
            return;
        }
        const duration = Date.now() - this.traceContext.startTime;
        const statusCode = res.statusCode;
        const userId = req.user?.userId ?? this.traceContext.userId ?? null;
        const payload = {
            level: 'info',
            entity: this.traceContext.serviceName,
            message: `[${req.method} ${path}] ${statusCode} ${duration}ms`,
            source: this.traceContext.serviceName,
            correlationId: this.traceContext.traceId,
            meta: {
                method: req.method,
                path,
                statusCode,
                duration,
                userId,
            },
        };
        const logsApiUrl = this.traceContext.logsApiUrl;
        if (logsApiUrl) {
            const headers = {};
            if (this.options.apiKey) {
                headers['x-api-key'] = this.options.apiKey;
            }
            axios_1.default.post(`${logsApiUrl}/api/logs`, payload, { headers }).catch(() => { });
        }
    }
};
exports.TraceMiddleware = TraceMiddleware;
exports.TraceMiddleware = TraceMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(types_1.TRACE_MODULE_OPTIONS)),
    __metadata("design:paramtypes", [trace_context_1.TraceContext,
        nestjs_cls_1.ClsService, Object])
], TraceMiddleware);
//# sourceMappingURL=trace.middleware.js.map