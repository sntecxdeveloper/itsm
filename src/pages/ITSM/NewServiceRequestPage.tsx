import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { nextTicketNumber } from '../../utils/ticketNumber';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import { GROUPS, Inp, Row, Sel, control } from './IncidentFormPage';
import {
  CATALOG_ITEMS,
  FORM_WRAP,
  NO_RITM,
  RequesterDetails,
  actionBtn,
  primaryBtn,
  ritmKey,
  writeJson,
  type RitmFields,
} from './serviceRequestShared';

const BACK = '/tickets/service-requests';

/** Blank requested-item form: same fields as the requested item page, empty. */
export default function NewServiceRequestPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const username = useAppSelector((s) => s.auth.user?.username) ?? '';
  // Coming from the catalog, the chosen item is already filled in.
  const [params] = useSearchParams();
  const preset = CATALOG_ITEMS.find((i) => i === params.get('item')) ?? '';
  const [fields, setFields] = useState<RitmFields>({ ...NO_RITM, item: preset, requestedBy: username, openedBy: username });
  const { tickets } = useAppSelector((s) => s.itsm);
  const number = nextTicketNumber(tickets, 'RITM');
  const [shortDescription, setShortDescription] = useState(preset ? `Request for ${preset}` : '');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh the list so the next number is based on every existing request item.
  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const set = (k: keyof RitmFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  const pickItem = (item: string) => {
    setFields((f) => ({ ...f, item }));
    if (item && !shortDescription.trim()) setShortDescription(`Request for ${item}`);
  };

  const submit = async () => {
    if (!shortDescription.trim()) return setError('Short description is required.');
    if (!fields.item) return setError('Choose the catalog item being requested.');
    setBusy(true);
    setError(null);
    try {
      const ticket = await createTicket({
        title: shortDescription.trim(),
        description,
        priority: 'MEDIUM',
        category: 'Service Request',
        assignedTo: fields.assignedTo || undefined,
        ticketCode: number,
      });
      writeJson(ritmKey(ticket.id), fields);
      dispatch(fetchTickets());
      navigate(`${BACK}/items/${ticket.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the request');
      setBusy(false);
    }
  };

  return (
    <div className={FORM_WRAP}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate(BACK)} aria-label="Back to service requests" className={actionBtn}>
          ← Back
        </button>
        <h1 className="text-[15px] font-semibold text-slate-800">New Requested Item</h1>
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

      <div className="grid gap-x-10 gap-y-3 bg-white p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Number">
            <input disabled readOnly value={number} className={control} />
          </Row>
          <Row label="Item" required>
            <Sel value={fields.item} onChange={pickItem} options={CATALOG_ITEMS} />
          </Row>
          <Row label="Requested for">
            <Inp value={fields.requestedFor} onChange={set('requestedFor')} />
          </Row>
          <Row label="Assignment group">
            <Sel value={fields.assignmentGroup} onChange={set('assignmentGroup')} options={GROUPS} />
          </Row>
          <Row label="Assigned to">
            <Inp value={fields.assignedTo} onChange={set('assignedTo')} />
          </Row>
          <Row label="Due date">
            <input
              type="datetime-local"
              value={fields.dueDate}
              onChange={(e) => set('dueDate')(e.target.value)}
              className={control}
            />
          </Row>
          <Row label="Configuration item">
            <Inp value={fields.ci} onChange={set('ci')} />
          </Row>
        </div>

        <div className="space-y-3">
          <Row label="Opened by">
            <input disabled value={fields.openedBy} className={control} />
          </Row>
          <Row label="Stage">
            <input disabled value={fields.stage} className={control} />
          </Row>
          <Row label="State">
            <input disabled value="Open" className={control} />
          </Row>
          <Row label="Quantity">
            <input
              type="number"
              min={1}
              value={fields.quantity}
              onChange={(e) => set('quantity')(e.target.value)}
              className={`${control} text-right`}
            />
          </Row>
          <Row label="Estimated delivery">
            <input
              type="datetime-local"
              value={fields.estimatedDelivery}
              onChange={(e) => set('estimatedDelivery')(e.target.value)}
              className={control}
            />
          </Row>
          <Row label="Parent">
            <Inp value={fields.parent} onChange={set('parent')} />
          </Row>
          <Row label="Watch list">
            <Inp value={fields.watchList} onChange={set('watchList')} placeholder="Comma-separated users" />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Short description" required>
            <Inp value={shortDescription} onChange={setShortDescription} />
          </Row>
          <Row label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={control} />
          </Row>
        </div>
      </div>

      <RequesterDetails values={fields} onChange={set} />
    </div>
  );
}
