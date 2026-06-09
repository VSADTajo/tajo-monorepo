import { ConditionOperator } from '../types/alert.types';

export function evaluateCondition(result: number, operator: ConditionOperator | string, value: number): boolean {
    switch (operator) {
        case ConditionOperator.EQ:
        case 'eq':
            return result === value;
        case ConditionOperator.NEQ:
        case 'neq':
            return result !== value;
        case ConditionOperator.GT:
        case 'gt':
            return result > value;
        case ConditionOperator.LT:
        case 'lt':
            return result < value;
        case ConditionOperator.GTE:
        case 'gte':
            return result >= value;
        case ConditionOperator.LTE:
        case 'lte':
            return result <= value;
        default:
            return false;
    }
}

export function isCooldownElapsed(lastTriggeredAt: Date | null, cooldownMinutes: number): boolean {
    if (!lastTriggeredAt) return true;
    const elapsed = Date.now() - new Date(lastTriggeredAt).getTime();
    return elapsed >= cooldownMinutes * 60 * 1000;
}
