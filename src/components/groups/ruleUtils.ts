import type { GroupRule, RuleFieldInfo } from '../../types/group';

export const EMPTY_RULE: GroupRule = { match: 'ALL', conditions: [{ field: '', op: '', value: '' }] };

/** True when every condition is filled in enough to send to the server. */
export function ruleIsComplete(rule: GroupRule, fields: RuleFieldInfo[]): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => {
    const f = fields.find((x) => x.key === c.field);
    if (!f || !c.op) return false;
    return f.kind === 'BOOLEAN' || c.value.trim() !== '';
  });
}
