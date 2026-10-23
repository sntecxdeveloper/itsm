import type { ScriptParameter } from '../../types/knowledge';

export const TRIGGER_LABEL: Record<string, string> = {
  MANUAL: 'Technician',
  AUTO: 'Auto-run policy',
  AGENT_LOCAL: 'User on the device',
};

/* ── Parameters ── */

export function parseParams(schema?: string | null): ScriptParameter[] {
  if (!schema?.trim()) return [];
  try {
    const parsed = JSON.parse(schema);
    return Array.isArray(parsed) ? (parsed as ScriptParameter[]) : [];
  } catch {
    return [];
  }
}

export type ParamValues = Record<string, string | number | boolean>;

/** Defaults for a schema, as the inputs start. */
export function defaultParamValues(params: ScriptParameter[]): Record<string, string> {
  return Object.fromEntries(params.map((p) => [p.name, p.default === undefined ? '' : String(p.default)]));
}

/**
 * Turns typed-in text into typed values, mirroring the backend's checks so the
 * user sees mistakes before sending. Returns an error message or the values.
 */
export function coerceParams(params: ScriptParameter[], raw: Record<string, string>): { values: ParamValues } | { error: string } {
  const values: ParamValues = {};
  for (const p of params) {
    const name = p.label || p.name;
    const text = (raw[p.name] ?? '').trim();
    if (!text) {
      if (p.required && p.default === undefined) return { error: `${name} is required` };
      continue;
    }
    if (p.type === 'int') {
      if (!/^-?\d+$/.test(text)) return { error: `${name} must be a whole number` };
      const n = Number(text);
      if (p.min != null && n < p.min) return { error: `${name} must be at least ${p.min}` };
      if (p.max != null && n > p.max) return { error: `${name} must be at most ${p.max}` };
      values[p.name] = n;
    } else if (p.type === 'bool') {
      values[p.name] = text === 'true';
    } else if (p.type === 'choice') {
      if (!p.options?.includes(text)) return { error: `${name} must be one of ${p.options?.join(', ')}` };
      values[p.name] = text;
    } else {
      if (text.length > (p.maxLength ?? 256)) return { error: `${name} is too long` };
      if (p.pattern) {
        try {
          if (!new RegExp(`^(?:${p.pattern})$`).test(text)) return { error: `${name} has an invalid format` };
        } catch {
          /* backend re-checks */
        }
      }
      values[p.name] = text;
    }
  }
  return { values };
}
