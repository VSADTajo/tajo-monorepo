import AlertRule from '../collections/alert-rule.collection';
import AlertExecution from '../collections/alert-execution.collection';
import { AlertRuleData } from '../types/alert.types';

export class AlertService {
    static async create(data: AlertRuleData) {
        const rule = await AlertRule.create(data);
        return rule;
    }

    static async findAll() {
        const rules = await AlertRule.find().sort({ createdAt: -1 });
        return rules;
    }

    static async findById(id: string) {
        const rule = await AlertRule.findById(id);
        return rule;
    }

    static async update(id: string, data: Partial<AlertRuleData>) {
        const rule = await AlertRule.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        return rule;
    }

    static async delete(id: string) {
        await AlertRule.findByIdAndDelete(id);
        // Also delete execution history
        await AlertExecution.deleteMany({ ruleId: id });
    }

    static async toggle(id: string, enabled: boolean) {
        const rule = await AlertRule.findByIdAndUpdate(id, { enabled }, { new: true });
        return rule;
    }

    static async updateExecutionState(id: string, updates: Partial<AlertRuleData>) {
        await AlertRule.findByIdAndUpdate(id, updates);
    }

    static async getHistory(ruleId: string, limit: number = 50, offset: number = 0) {
        const [executions, total] = await Promise.all([
            AlertExecution.find({ ruleId }).sort({ executedAt: -1 }).skip(offset).limit(limit),
            AlertExecution.countDocuments({ ruleId }),
        ]);
        return { executions, total };
    }

    static async findAllEnabled() {
        const rules = await AlertRule.find({ enabled: true });
        return rules;
    }
}
