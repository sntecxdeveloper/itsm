import { useState } from 'react';
import { motion } from 'framer-motion';
import { updateDevicePlacement } from '../../api/deviceApi';
import { getErrorMessage } from '../../utils/errorHandler';

interface Props {
  deviceId: number;
  hostname: string;
  location?: string | null;
  region?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const field =
  'h-10 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

/** Where a device is: a free-text location and region. Leave a box empty to clear it. */
export default function PlacementModal({ deviceId, hostname, location, region, onClose, onSaved }: Props) {
  const [loc, setLoc] = useState(location ?? '');
  const [reg, setReg] = useState(region ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDevicePlacement(deviceId, { location: loc, region: reg });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Where is this device"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Where is {hostname}?</h2>
            <p className="mt-1 text-xs text-slate-500">Shown in the devices list and usable in group rules.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Location</span>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={100} placeholder="For example: Chennai plant" className={field} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Region</span>
            <input value={reg} onChange={(e) => setReg(e.target.value)} maxLength={100} placeholder="For example: South" className={field} />
          </label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
