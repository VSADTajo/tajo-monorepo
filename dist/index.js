"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X_USER_ID_HEADER = exports.X_TRACE_ID_HEADER = exports.TraceContext = exports.TracedHttpClient = exports.TraceModule = void 0;
var trace_module_1 = require("./trace.module");
Object.defineProperty(exports, "TraceModule", { enumerable: true, get: function () { return trace_module_1.TraceModule; } });
var traced_http_client_1 = require("./traced-http-client");
Object.defineProperty(exports, "TracedHttpClient", { enumerable: true, get: function () { return traced_http_client_1.TracedHttpClient; } });
var trace_context_1 = require("./trace-context");
Object.defineProperty(exports, "TraceContext", { enumerable: true, get: function () { return trace_context_1.TraceContext; } });
var types_1 = require("./types");
Object.defineProperty(exports, "X_TRACE_ID_HEADER", { enumerable: true, get: function () { return types_1.X_TRACE_ID_HEADER; } });
Object.defineProperty(exports, "X_USER_ID_HEADER", { enumerable: true, get: function () { return types_1.X_USER_ID_HEADER; } });
//# sourceMappingURL=index.js.map