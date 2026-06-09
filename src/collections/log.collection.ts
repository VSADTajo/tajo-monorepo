import { Schema, model } from "mongoose";

const logSchema = new Schema(
    {
        level: { type: String, enum: ["info", "warning", "error"], default: "info" },
        entity: { type: String, required: true },
        message: { type: String, required: true },
        source: { type: String, required: false },
        meta: { type: Object, required: false },
        filePath: { type: String, required: false, default: null },
        correlationId: { type: String, required: false, default: null },
    },
    { timestamps: true }
);

// Indexes for efficient queries by time and entity
logSchema.index({ createdAt: -1 });
logSchema.index({ entity: 1, createdAt: -1 });
logSchema.index({ correlationId: 1, createdAt: -1 });

const Log = model("Log", logSchema);

export default Log;