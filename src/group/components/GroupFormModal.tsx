import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { createGroup, getGroupOrganizations, updateGroup } from '../../api/groupApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { GROUP_COLORS, GROUP_TYPES, KINDS, KIND_INFO, TYPE_INFO } from './groupMeta';
import type { GroupDetail, GroupKind, GroupStatus, GroupType } from '../../types/group';

const field =
  'h-7 w-full rounded-lg border border-line bg-panel px-2 text-[11px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface Props {
  /** Present when editing an existing group. */
  existing?: GroupDetail;
  onClose: () => void;
  onSaved: (group: GroupDetail) => void;
  /** The Groups section: a group of devices, always typed DEVICE, inside one organization (no type choice). */
  deviceMode?: boolean;
}

/**
 * Create or edit a group. A group is just a named unit with an optional kind. What is inside it (devices, technicians,
 * users) is added afterwards, from the group itself.
 */
export default function GroupFormModal({ existing, onClose, onSaved, deviceMode = false }: Props) {
  const editing = !!existing;
  const [name, setName] = useState(existing?.summary.name ?? '');
  // an older group with no type stays general until someone picks one
  const [type, setType] = useState<GroupType | ''>(deviceMode ? 'DEVICE' : editing ? (existing.summary.type ?? '') : 'TECHNICIAN');
  const [organizationId, setOrganizationId] = useState<number>(existing?.summary.organizationId ?? 1);
  const [organizations, setOrganizations] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (deviceMode) getGroupOrganizations().then(setOrganizations).catch(() => setOrganizations([]));
  }, [deviceMode]);
  const [status, setStatus] = useState<GroupStatus>(existing?.summary.status ?? 'ACTIVE');
  const [description, setDescription] = useState(existing?.summary.description ?? '');
  const [kind, setKind] = useState<GroupKind>(existing?.summary.kind ?? 'DEPARTMENT');
  const [location, setLocation] = useState(existing?.summary.location ?? '');
  const [region, setRegion] = useState(existing?.summary.region ?? '');
  const [color, setColor] = useState(existing?.summary.color ?? GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        type: deviceMode ? 'DEVICE' : type,
        status,
        ...(deviceMode ? { organizationId } : {}),
        kind,
        location: location.trim(),
        region: region.trim(),
        color,
        // keep how devices are chosen exactly as it was
        membershipMode: existing?.summary.membershipMode ?? 'STATIC',
        rule: existing?.rule ?? null,
      } as const;
      const saved = editing ? await updateGroup(existing.summary.id, body) : await createGroup(body);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const btn = 'px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit group' : 'New group'}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl"
      >
        <div className="space-y-2.5 p-4">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary-500">{editing ? 'Edit group' : 'New group'}</p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-900">{editing ? existing.summary.name : 'Create a group'}</h2>
            {!editing && <p className="mt-0.5 text-[10px] text-slate-500">Name it first. You add its devices, technicians and users from inside the group.</p>}
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="For example: Finance department" className={field} autoFocus />
          </label>

          {deviceMode && (
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Organization</span>
              <select value={organizationId} onChange={(e) => setOrganizationId(Number(e.target.value))} className={field}>
                {organizations.length === 0 && <option value={organizationId}>Default</option>}
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-[10px] text-slate-500">Only this organization's computers can be added to the group.</span>
            </label>
          )}

          {!deviceMode && <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Group type</span>
            <select value={type} onChange={(e) => setType(e.target.value as GroupType | '')} className={field}>
              {editing && !existing.summary.type && <option value="">General (devices, technicians and users)</option>}
              {GROUP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_INFO[t].label}
                </option>
              ))}
            </select>
            {type && <span className="mt-0.5 block text-[10px] text-slate-500">{TYPE_INFO[type].blurb}</span>}
          </label>}

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as GroupKind)} className={field}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_INFO[k].label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Location (optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="For example: Chennai plant" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Region (optional)</span>
              <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={100} placeholder="For example: South" className={field} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Description (optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="What is this group for?" className={field} />
          </label>

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Colour</span>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={color === c}
                  className={`h-5 w-5 rounded-full ring-offset-2 transition-all ${color === c ? 'ring-2 ring-slate-700' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as GroupStatus)} className={field}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            {status === 'INACTIVE' && <span className="mt-0.5 block text-[10px] text-slate-500">An inactive group can no longer be picked as a ticket&apos;s assignment group.</span>}
          </label>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-2.5">
            <button type="button" onClick={onClose} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              Cancel
            </button>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void save()} className={`${btn} bg-primary-600 text-white hover:bg-primary-700`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
