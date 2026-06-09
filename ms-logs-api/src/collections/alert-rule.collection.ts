import { Schema, model } from 'mongoose';
import { ConditionOperator, DataSource, NotificationSeverity } from '../types/alert.types';

const conditionSchema = new Schema(
    {
        operator: { type: String, enum: Object.values(ConditionOperator), required: true },
        value: { type: Number, required: true },
        field: { type: String, default: 'count' },
    },
    { _id: false }
);

const notificationConfigSchema = new Schema(
    {
        severity: { type: String, enum: Object.values(NotificationSeverity), required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
    },
    { _id: false }
);

const alertRuleSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        enabled: { type: Boolean, default: true },
        dataSource: {
            type: String,
            enum: Object.values(DataSource),
            required: true,
        },
        query: { type: String, required: true, maxlength: 4096 },
        condition: { type: conditionSchema, required: true },
        intervalMinutes: { type: Number, required: true, min: 1, max: 1440 },
        notification: { type: notificationConfigSchema, required: true },
        cooldownMinutes: { type: Number, default: 30, min: 1 },
        emails: { type: [String], default: [] },
        lastCheckedAt: { type: Date, default: null },
        lastResult: { type: Schema.Types.Mixed, default: null },
        lastTriggeredAt: { type: Date, default: null },
        consecutiveFailures: { type: Number, default: 0 },
        lastError: { type: String, default: null },
        templateId: { type: String, default: null },
    },
    { timestamps: true }
);

alertRuleSchema.index({ enabled: 1 });
alertRuleSchema.index({ name: 1 }, { unique: true });
alertRuleSchema.index({ dataSource: 1 });

const AlertRule = model('AlertRule', alertRuleSchema);

export default AlertRule;
