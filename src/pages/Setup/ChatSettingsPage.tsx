import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MAX_HISTORY_TURNS,
  MIN_HISTORY_TURNS,
  chatSettingsProblem,
  defaultChatSettings,
  loadChatSettings,
  saveChatSettings,
  type ChatSettings,
} from '../../utils/chatSettings';

const field =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const btn = 'rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';
const darkBtn = 'rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <p className="text-xs font-semibold text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-primary-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function ChatSettingsPage() {
  const [saved, setSaved] = useState<ChatSettings>(loadChatSettings);
  const [draft, setDraft] = useState<ChatSettings>(saved);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const patch = (p: Partial<ChatSettings>) => {
    setNotice(null);
    setProblem(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const save = () => {
    const p = chatSettingsProblem(draft);
    if (p) return setProblem(p);
    if (saveChatSettings(draft)) {
      setSaved(draft);
      setNotice('Chat settings saved.');
    } else setProblem('The browser would not save the change (storage is full or blocked).');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/setup" className="text-xs text-primary-600 hover:underline">
          ‹ Setup
        </Link>
        <h1 className="text-base font-semibold text-slate-900">Chat Settings</h1>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">DEX AI chat</h2>
        <div className="divide-y divide-slate-100">
          <Row label="Enable chat" hint="Off hides the Chat icon in the header and turns the chat page off.">
            <div className="flex items-center gap-2">
              <Toggle on={draft.enabled} onChange={(v) => patch({ enabled: v })} label="Enable chat" />
              <span className="text-xs text-slate-600">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </Row>
          <Row label="Assistant name" hint="Shown at the top of the chat.">
            <input value={draft.assistantName} onChange={(e) => patch({ assistantName: e.target.value })} className={field} maxLength={60} />
          </Row>
          <Row label="Welcome message" hint="The first message people see in a new chat.">
            <textarea value={draft.welcomeMessage} onChange={(e) => patch({ welcomeMessage: e.target.value })} rows={4} className={field} />
          </Row>
          <Row label="Input placeholder">
            <input value={draft.inputPlaceholder} onChange={(e) => patch({ inputPlaceholder: e.target.value })} className={field} maxLength={80} />
          </Row>
          <Row label="Device selection" hint="Lets people pick a device so answers use its live metrics.">
            <div className="flex items-center gap-2">
              <Toggle on={draft.allowDeviceSelection} onChange={(v) => patch({ allowDeviceSelection: v })} label="Device selection" />
              <span className="text-xs text-slate-600">{draft.allowDeviceSelection ? 'Allowed' : 'Hidden'}</span>
            </div>
          </Row>
          <Row label="Conversation memory" hint={`How many earlier messages are sent with each question (${MIN_HISTORY_TURNS}–${MAX_HISTORY_TURNS}).`}>
            <input
              type="number"
              min={MIN_HISTORY_TURNS}
              max={MAX_HISTORY_TURNS}
              value={draft.historyTurns}
              onChange={(e) => patch({ historyTurns: e.target.value === '' ? NaN : Number(e.target.value) })}
              className={`${field} w-24`}
            />
          </Row>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className={darkBtn} onClick={save} disabled={!dirty}>
            Save
          </button>
          <button
            className={btn}
            onClick={() => {
              setDraft(saved);
              setProblem(null);
              setNotice(null);
            }}
            disabled={!dirty}
          >
            Discard changes
          </button>
          <button className={btn} onClick={() => patch(defaultChatSettings())}>
            Reset to default
          </button>
          {problem && <span className="text-xs text-red-600">{problem}</span>}
          {notice && <span className="text-xs text-slate-600">{notice}</span>}
        </div>
      </section>
    </div>
  );
}
