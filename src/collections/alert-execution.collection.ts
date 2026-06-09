import { Schema, model } from 'mongoose';

const alertExecutionSchema = new Schema(
    {
        ruleId: { type: Schema.Types.ObjectId, ref: 'AlertRule', required: true },
        ruleName: { type: String, required: true },
        executedAt: { type: Date, required: true },
        queryResult: { type: Schema.Types.Mixed, default: null },
        conditionMet: { type: Boolean, required: true },
        notificationDispatched: { type: Boolean, default: false },
        skippedReason: { type: String, default: null },
        error: { type: String, default: null },
        durationMs: { type: Number, default: null },
    },
    { timestamps: true }
);

// History lookup per rule, newest first
alertExecutionSchema.index({ ruleId: 1, executedAt: -1 });

// TTL: auto-delete after 30 days
alertExecutionSchema.index({ executedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const AlertExecution = model('AlertExecution', alertExecutionSchema);

export default AlertExecution;
