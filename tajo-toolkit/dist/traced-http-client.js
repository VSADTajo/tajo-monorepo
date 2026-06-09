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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TracedHttpClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const trace_context_1 = require("./trace-context");
const types_1 = require("./types");
let TracedHttpClient = class TracedHttpClient {
    constructor(traceContext) {
        this.traceContext = traceContext;
    }
    async get(url, config) {
        return axios_1.default.get(url, this.mergeHeaders(config));
    }
    async post(url, data, config) {
        return axios_1.default.post(url, data, this.mergeHeaders(config));
    }
    async put(url, data, config) {
        return axios_1.default.put(url, data, this.mergeHeaders(config));
    }
    async patch(url, data, config) {
        return axios_1.default.patch(url, data, this.mergeHeaders(config));
    }
    async delete(url, config) {
        return axios_1.default.delete(url, this.mergeHeaders(config));
    }
    async request(config) {
        return axios_1.default.request(this.mergeHeaders(config));
    }
    mergeHeaders(config) {
        const traceHeaders = {};
        try {
            const traceId = this.traceContext.traceId;
            if (traceId) {
                traceHeaders[types_1.X_TRACE_ID_HEADER] = traceId;
            }
            const userId = this.traceContext.userId;
            if (userId) {
                traceHeaders[types_1.X_USER_ID_HEADER] = userId;
            }
        }
        catch {
            // Outside of request scope (no CLS context) — skip header injection
        }
        return {
            ...config,
            headers: {
                ...traceHeaders,
                ...config?.headers,
            },
        };
    }
};
exports.TracedHttpClient = TracedHttpClient;
exports.TracedHttpClient = TracedHttpClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trace_context_1.TraceContext])
], TracedHttpClient);
//# sourceMappingURL=traced-http-client.js.map