/**
 * Settings for the DEX AI chat. The backend has no chat-settings table yet, so they live in this browser
 * (like SLAs, business rules and life cycles).
 */

export const CHAT_SETTINGS_KEY = 'dex.chatSettings.v1';

export interface ChatSettings {
  /** When off, the header Chat icon is hidden and the chat page says chat is turned off. */
  enabled: boolean;
  assistantName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  /** Let people pick a device so answers are grounded in its live metrics. */
  allowDeviceSelection: boolean;
  /** How many earlier messages are sent along with each question. */
  historyTurns: number;
}

export const MIN_HISTORY_TURNS = 0;
export const MAX_HISTORY_TURNS = 30;

export const defaultChatSettings = (): ChatSettings => ({
  enabled: true,
  assistantName: 'DEX AI Assistant',
  welcomeMessage:
    "Hello! I'm DEX AI. Ask me anything - I can diagnose device issues (pick a device below to ground my answers in its live metrics), explain alerts, walk through remediation steps, or just answer general questions.",
  inputPlaceholder: 'Ask DEX AI anything...',
  allowDeviceSelection: true,
  historyTurns: 12,
});

export function loadChatSettings(): ChatSettings {
  const base = defaultChatSettings();
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ChatSettings>;
      return {
        enabled: typeof p.enabled === 'boolean' ? p.enabled : base.enabled,
        assistantName: typeof p.assistantName === 'string' && p.assistantName.trim() ? p.assistantName : base.assistantName,
        welcomeMessage: typeof p.welcomeMessage === 'string' && p.welcomeMessage.trim() ? p.welcomeMessage : base.welcomeMessage,
        inputPlaceholder: typeof p.inputPlaceholder === 'string' && p.inputPlaceholder.trim() ? p.inputPlaceholder : base.inputPlaceholder,
        allowDeviceSelection: typeof p.allowDeviceSelection === 'boolean' ? p.allowDeviceSelection : base.allowDeviceSelection,
        historyTurns:
          typeof p.historyTurns === 'number' && Number.isFinite(p.historyTurns)
            ? Math.min(MAX_HISTORY_TURNS, Math.max(MIN_HISTORY_TURNS, Math.round(p.historyTurns)))
            : base.historyTurns,
      };
    }
  } catch {
    /* unreadable or storage blocked: defaults */
  }
  return base;
}

/** Returns false when the browser refused the write. */
export function saveChatSettings(s: ChatSettings): boolean {
  try {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function chatSettingsProblem(s: ChatSettings): string | null {
  if (!s.assistantName.trim()) return 'Give the assistant a name.';
  if (!s.welcomeMessage.trim()) return 'The welcome message cannot be empty.';
  if (!s.inputPlaceholder.trim()) return 'The input placeholder cannot be empty.';
  if (!Number.isInteger(s.historyTurns) || s.historyTurns < MIN_HISTORY_TURNS || s.historyTurns > MAX_HISTORY_TURNS)
    return `History must be a whole number from ${MIN_HISTORY_TURNS} to ${MAX_HISTORY_TURNS}.`;
  return null;
}
