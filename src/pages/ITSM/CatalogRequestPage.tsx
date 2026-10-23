import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import { loadServices } from '../../utils/serviceStore';
import { loadManualAssets } from '../../utils/assets';
import { Inp, Row, Sel, control } from './IncidentFormPage';
import { CATALOG, FORM_WRAP, actionBtn, primaryBtn } from './serviceRequestShared';

const BACK = '/tickets/service-requests';

/** Common applications always offered on the Software form. */
const DEFAULT_SOFTWARE = ['Adobe Acrobat', 'Adobe Creative Cloud', 'AutoCAD', 'Java (JDK/JRE)', '.NET Framework', 'Microsoft Office', 'Visual Studio', 'Zoom'];

/** Software assets added on the Assets page, then the defaults, without duplicates. */
function softwareOptions(): string[] {
  const fromAssets = loadManualAssets().filter((a) => a.type === 'Software').map((a) => a.name);
  return [...new Set([...fromAssets, ...DEFAULT_SOFTWARE])].sort((a, b) => a.localeCompare(b));
}

/** Opened from a Service Catalog card: one request form with the sections stacked vertically. */
export default function CatalogRequestPage() {
  const { key } = useParams();
  const category = CATALOG.find((c) => c.key === key);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  const options = useMemo(() => (category?.key === 'software' ? softwareOptions() : category?.items.map((i) => i.name) ?? []), [category]);
  const services = useMemo(loadServices, []);
  const [software, setSoftware] = useState('');
  const [user, setUser] = useState(username);
  const [subject, setSubject] = useState('');
  const [service, setService] = useState('');
  const [additional, setAdditional] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOn = category?.key === 'iam' && software === 'Onboarding';
  const isOff = category?.key === 'iam' && software === 'Offboarding';

  if (!category) return <Navigate to={BACK} replace />;

  const submit = async () => {
    if (!software) return setError(`Choose a category.`);
    if (!user.trim()) return setError('User is required.');
    if (!subject.trim()) return setError('Subject is required.');
    if ((isOn || isOff) && !date) return setError(`${isOn ? 'Start' : 'End'} date is required.`);
    setBusy(true);
    setError(null);
    try {
      await createTicket({
        title: subject.trim(),
        description: `${category.title}: ${software}\nUser: ${user.trim()}\nService: ${service.trim()}${isOn || isOff ? `\n${isOn ? 'Start' : 'End'} date: ${date}\nAdditional fields: ${additional}` : ''}\n\n${description}`.trim(),
        priority: 'MEDIUM',
        category: 'Service Request',
      });
      dispatch(fetchTickets());
      navigate(`${BACK}/requests`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the request');
      setBusy(false);
    }
  };

  return (
    <div className={FORM_WRAP}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate(BACK)} aria-label="Back to service catalog" className={actionBtn}>
          ← Back
        </button>
        <h1 className="text-[15px] font-semibold text-slate-800">{category.title} Request</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(BACK)} className={actionBtn}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className={primaryBtn}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      {error && <p className="bg-red-50 px-4 py-2 text-[13px] text-red-600">{error}</p>}

      <div className="max-w-2xl space-y-3 bg-white p-5">
        <Row label={category.title}>
          <input disabled readOnly value={category.title} className={control} />
        </Row>
        <Row label="User" required>
          <Inp value={user} onChange={setUser} />
        </Row>
        <Row label="Subject" required>
          <Inp value={subject} onChange={setSubject} />
        </Row>
        <Row label="Service">
          <Sel value={service} onChange={setService} options={services} />
        </Row>
        <Row label="Category" required>
          <Sel value={software} onChange={setSoftware} options={options} />
        </Row>
        {(isOn || isOff) && (
          <>
            <Row label={isOn ? 'Start date' : 'End date'} required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={control} />
            </Row>
            <Row label="Additional fields">
              <textarea value={additional} onChange={(e) => setAdditional(e.target.value)} rows={3} className={control} />
            </Row>
          </>
        )}
        <Row label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={control} />
        </Row>
      </div>
    </div>
  );
}
