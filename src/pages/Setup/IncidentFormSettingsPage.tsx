import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_FORM_SETTINGS,
  loadFormSettings,
  resetFormSettings,
  saveFormSettings,
  type IncidentFormSettings,
} from '../../utils/incidentFormStore';

const field =
  'rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

/** Setup → Incident Form: the Channel list and the example shown in the Short description box. */
export default function IncidentFormSettingsPage() {
  const [settings, setSettings] = useState<IncidentFormSettings>(loadFormSettings);
  const [channel, setChannel] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (next: IncidentFormSettings) => {
    setSettings(next);
    setNotice(saveFormSettings(next) ? null : 'The browser would not save the change (storage is full or blocked).');
  };
  const addChannel = () => {
    const n = channel.trim();
    if (!n || settings.channels.some((c) => c.toLowerCase() === n.toLowerCase())) return;
    commit({ ...settings, channels: [...settings.channels, n] });
    setChannel('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">
          Setup
        </Link>
        <span className="text-slate-300">›</span>
        <span className="font-medium text-slate-800">Incident Form</span>
        <button
          onClick={() => {
            if (!window.confirm('Restore the default channels and example?')) return;
            resetFormSettings();
            setSettings(DEFAULT_FORM_SETTINGS);
            setNotice(null);
          }}
          className="ml-auto rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset to defaults
        </button>
      </div>
      {notice && <p className="rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">{notice}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">Channels</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">Options for the Channel field on incidents.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addChannel()}
            placeholder="New channel"
            aria-label="New channel"
            className={`${field} w-64`}
          />
          <button type="button" onClick={addChannel} disabled={!channel.trim()} className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            Add
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {settings.channels.map((c) => (
            <li key={c} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
              {c}
              <button type="button" aria-label={`Remove ${c}`} onClick={() => commit({ ...settings, channels: settings.channels.filter((x) => x !== c) })} className="text-slate-400 hover:text-red-600">
                ×
              </button>
            </li>
          ))}
          {settings.channels.length === 0 && <li className="text-[11px] text-slate-400">No channels yet.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-slate-900">Short description example</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">Shown in grey inside the Short description box until an Item is chosen.</p>
        <input
          value={settings.shortDescriptionExample}
          onChange={(e) => commit({ ...settings, shortDescriptionExample: e.target.value })}
          aria-label="Short description example"
          className={`${field} mt-3 w-full max-w-md`}
        />
        <p className="mt-2 text-[11px] text-slate-400">Preview: e.g. {settings.shortDescriptionExample.trim() || DEFAULT_FORM_SETTINGS.shortDescriptionExample} on my laptop since this morning</p>
      </section>

      <p className="text-[11px] text-slate-400">Saved on the server, so everyone sees it. Impact and Urgency stay fixed because they decide the priority.</p>
    </div>
  );
}
