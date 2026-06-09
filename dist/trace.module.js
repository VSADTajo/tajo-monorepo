"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TraceModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_cls_1 = require("nestjs-cls");
const trace_middleware_1 = require("./trace.middleware");
const traced_http_client_1 = require("./traced-http-client");
const trace_context_1 = require("./trace-context");
const types_1 = require("./types");
let TraceModule = TraceModule_1 = class TraceModule {
    static forRoot(options) {
        return {
            module: TraceModule_1,
            imports: [
                nestjs_cls_1.ClsModule.forRoot({
                    middleware: { mount: true },
                }),
            ],
            providers: [
                {
                    provide: types_1.TRACE_MODULE_OPTIONS,
                    useValue: options,
                },
                trace_context_1.TraceContext,
                traced_http_client_1.TracedHttpClient,
                trace_middleware_1.TraceMiddleware,
            ],
            exports: [traced_http_client_1.TracedHttpClient, trace_context_1.TraceContext],
            global: true,
        };
    }
    configure(consumer) {
        consumer.apply(trace_middleware_1.TraceMiddleware).forRoutes('*');
    }
};
exports.TraceModule = TraceModule;
exports.TraceModule = TraceModule = TraceModule_1 = __decorate([
    (0, common_1.Module)({})
], TraceModule);
//# sourceMappingURL=trace.module.js.map