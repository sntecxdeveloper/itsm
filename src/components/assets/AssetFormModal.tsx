import { useState, type ReactNode } from 'react';
import { ASSET_STATUSES, ASSET_TYPES, type Asset, type AssetStatus, type AssetType, type NewAsset } from '../../utils/assets';

const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 block">{text}</span>
      {children}
    </label>
  );
}

export default function AssetFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Asset;
  onClose: () => void;
  onSave: (asset: NewAsset) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AssetType>(initial?.type ?? 'Laptop');
  const [status, setStatus] = useState<AssetStatus>(initial?.status ?? 'Active');
  const [brand, setBrand] = useState(initial?.brand && initial.brand !== '—' ? initial.brand : '');
  const [model, setModel] = useState(initial?.model && initial.model !== '—' ? initial.model : '');
  const [serial, setSerial] = useState(initial?.serial ?? '');
  const [user, setUser] = useState(initial?.user && initial.user !== '—' ? initial.user : '');
  const [department, setDepartment] = useState(initial?.department && initial.department !== '—' ? initial.department : '');
  const [location, setLocation] = useState(initial?.location && initial.location !== '—' ? initial.location : '');
  const [warranty, setWarranty] = useState(initial?.warranty ?? '');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return setErr('Asset name is required');
    onSave({
      name: name.trim(),
      type,
      status,
      brand: brand.trim() || '—',
      model: model.trim() || '—',
      serial: serial.trim() || undefined,
      user: user.trim() || '—',
      department: department.trim() || '—',
      location: location.trim() || '—',
      warranty: warranty || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900">{initial ? 'Edit Asset' : 'Add Asset'}</h3>
        <p className="mb-4 text-xs text-slate-500">
          Devices with the DEX agent are listed automatically. Use this for equipment without an agent.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Label text="Asset name *">
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="LAPTOP-023" autoFocus />
          </Label>
          <Label text="Type">
            <select className={field} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
              {ASSET_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Label>
          <Label text="Brand">
            <input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Dell" />
          </Label>
          <Label text="Model">
            <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Latitude 5520" />
          </Label>
          <Label text="Serial number">
            <input className={field} value={serial} onChange={(e) => setSerial(e.target.value)} />
          </Label>
          <Label text="Status">
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
              {ASSET_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Label>
          <Label text="Assigned user">
            <input className={field} value={user} onChange={(e) => setUser(e.target.value)} />
          </Label>
          <Label text="Department">
            <input className={field} value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Label>
          <Label text="Location">
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} />
          </Label>
          <Label text="Warranty valid till">
            <input type="date" className={field} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
          </Label>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-5">
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:underline">
            Cancel
          </button>
          <button onClick={submit} className="text-sm font-medium text-primary-600 hover:underline">
            {initial ? 'Save' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
