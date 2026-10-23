import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket, getTicketById, updateTicketStatus } from '../../api/itsmApi';
import ErrorMessage from '../../components/common/ErrorMessage';
import { GROUPS, Inp, Row, Sel, control } from './IncidentFormPage';
import {
  Banner,
  CATALOG_ITEMS,
  FORM_WRAP,
  NO_TASK,
  ReadOnly,
  RequesterDetails,
  STAGES,
  STATES,
  STATE_LABEL,
  actionBtn,
  iconBtn,
  loadRitm,
  readJson,
  requestNumber,
  ritmKey,
  ritmTasksKey,
  stamp,
  taskKey,
  toLocalInput,
  writeJson,
  type RitmFields,
} from './serviceRequestShared';
import type { ItsmTicket, TicketStatus } from '../../types';

const BASE = '/tickets/service-requests';
const BACK = `${BASE}/requests`;

export default function RequestedItemPage() {
  const { id } = useParams();
  const ticketId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tickets: all } = useAppSelector((s) => s.itsm);

  const [ticket, setTicket] = useState<ItsmTicket | null>(null);
  const [state, setState] = useState<TicketStatus>('OPEN');
  const [fields, setFields] = useState<RitmFields>(() => loadRitm(ticketId));
  const [saved, setSaved] = useState<RitmFields>(() => loadRitm(ticketId));
  const [taskIds, setTaskIds] = useState<number[]>(() => readJson<number[]>(ritmTasksKey(ticketId), []));
  const [newTask, setNewTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof RitmFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (all.length === 0) dispatch(fetchTickets());
  }, [all.length, dispatch]);

  useEffect(() => {
    const f = loadRitm(ticketId);
    setFields(f);
    setSaved(f);
    setTaskIds(readJson<number[]>(ritmTasksKey(ticketId), []));
    setNewTask(null);
    setMessage(null);
  }, [ticketId]);

  useEffect(() => {
    let live = true;
    getTicketById(ticketId)
      .then((t) => {
        if (!live) return;
        setTicket(t);
        setState(t.status);
        setError(null);
        // Fill what the backend knows when this browser has nothing saved for the record.
        const fill = (f: RitmFields): RitmFields => ({ ...f, assignedTo: f.assignedTo || t.assignedTo || '' });
        setFields(fill);
        setSaved(fill);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load the requested item'));
    return () => {
      live = false;
    };
  }, [ticketId]);

  const apply = async (goBack: boolean) => {
    if (!ticket) return;
    setSaving(true);
    setMessage(null);
    try {
      let current = ticket;
      if (state !== ticket.status) current = await updateTicketStatus(ticket.id, state);
      writeJson(ritmKey(ticket.id), fields);
      setSaved(fields);
      setTicket(current);
      setState(current.status);
      dispatch(fetchTickets());
      if (goBack) navigate(BACK);
      else setMessage('Saved. Fields other than the state are kept in this browser only.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save the requested item');
    } finally {
      setSaving(false);
    }
  };

  const addTask = async () => {
    if (!ticket || !newTask?.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const task = await createTicket({
        title: newTask.trim(),
        description: '',
        priority: ticket.priority,
        category: 'Catalog Task',
        assignedTo: fields.assignedTo || undefined,
      });
      writeJson(taskKey(task.id), { ...NO_TASK, requestItem: ticket.id });
      const next = [task.id, ...taskIds];
      setTaskIds(next);
      writeJson(ritmTasksKey(ticket.id), next);
      setNewTask(null);
      dispatch(fetchTickets());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create the catalog task');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  if (!ticket) return <p className="py-12 text-center text-sm text-slate-400">Loading…</p>;

  const dirty = state !== ticket.status || JSON.stringify(fields) !== JSON.stringify(saved);
  const tasks = taskIds.map((tid) => all.find((t) => t.id === tid)).filter((t): t is ItsmTicket => !!t);
  const th = 'whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900';
  const td = 'px-2.5 py-1.5 text-[11px] text-slate-800';

  return (
    <div className={FORM_WRAP}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate(BACK)} aria-label="Back to service requests" className={iconBtn}>
          ‹
        </button>
        <p className="text-[13px] font-semibold text-slate-900">Requested Item - {ticket.ticketCode}</p>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={!dirty || saving} onClick={() => void apply(true)} className={actionBtn}>
            Update
          </button>
          <button disabled={!dirty || saving} onClick={() => void apply(false)} className={actionBtn}>
            Save
          </button>
        </div>
      </div>
      {message && <Banner text={message} />}

      <div className="grid gap-x-10 gap-y-3 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Number">
            <ReadOnly value={ticket.ticketCode} />
          </Row>
          <Row label="Item">
            <Sel value={fields.item} onChange={set('item')} options={CATALOG_ITEMS} />
          </Row>
          <Row label="Requested for">
            <Inp value={fields.requestedFor} onChange={set('requestedFor')} />
          </Row>
          <Row label="Assignment group">
            <Sel value={fields.assignmentGroup} onChange={set('assignmentGroup')} options={GROUPS} />
          </Row>
          <Row label="Due date">
            <input
              type="datetime-local"
              value={toLocalInput(fields.dueDate)}
              onChange={(e) => set('dueDate')(e.target.value)}
              className={control}
            />
          </Row>
          <Row label="Configuration item">
            <Inp value={fields.ci} onChange={set('ci')} />
          </Row>
          <Row label="Parent">
            <Inp value={fields.parent} onChange={set('parent')} />
          </Row>
          <Row label="Watch list">
            <Inp value={fields.watchList} onChange={set('watchList')} placeholder="Comma-separated users" />
          </Row>
        </div>

        <div className="space-y-3">
          <Row label="Opened">
            <ReadOnly value={stamp(ticket.createdAt)} />
          </Row>
          <Row label="Opened by">
            <ReadOnly value={fields.openedBy || fields.requestedBy} />
          </Row>
          <Row label="Stage">
            <Sel value={fields.stage} onChange={set('stage')} options={STAGES} blank="-- None --" />
          </Row>
          <Row label="State">
            <select value={state} onChange={(e) => setState(e.target.value as TicketStatus)} className={control}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Request">
            <ReadOnly value={requestNumber(ticket.id)} />
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
              value={toLocalInput(fields.estimatedDelivery)}
              onChange={(e) => set('estimatedDelivery')(e.target.value)}
              className={control}
            />
          </Row>
          <Row label="Backordered">
            <input
              type="checkbox"
              checked={fields.backordered}
              onChange={(e) => setFields((f) => ({ ...f, backordered: e.target.checked }))}
              className="h-4 w-4 justify-self-start"
            />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Short description" required>
            <ReadOnly value={ticket.title} />
          </Row>
          {ticket.description && (
            <Row label="Description">
              <textarea disabled readOnly rows={3} value={ticket.description} className={control} />
            </Row>
          )}
        </div>
      </div>

      <RequesterDetails values={fields} onChange={set} />

      <div className="flex gap-2 px-4 pb-4">
        <button disabled={!dirty || saving} onClick={() => void apply(true)} className={actionBtn}>
          Update
        </button>
        <button disabled={!dirty || saving} onClick={() => void apply(false)} className={actionBtn}>
          Save
        </button>
      </div>

      {/* Related list: catalog tasks that fulfil this item */}
      <div className="px-4 pb-6">
        <h2 className="mb-2 text-[14px] font-semibold text-slate-900">Catalog Tasks</h2>
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            {newTask === null ? (
              <button onClick={() => setNewTask('')} className={actionBtn}>
                New
              </button>
            ) : (
              <>
                <input
                  autoFocus
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void addTask()}
                  placeholder="Short description of the task"
                  className={`${control} max-w-sm`}
                />
                <button disabled={!newTask.trim() || saving} onClick={() => void addTask()} className={actionBtn}>
                  Create
                </button>
                <button onClick={() => setNewTask(null)} className={actionBtn}>
                  Cancel
                </button>
              </>
            )}
            <p className="ml-auto text-[12px] text-slate-600">Request item = {ticket.ticketCode}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-300">
                {['Number', 'Short description', 'State', 'Assigned to', 'Opened'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link to={`${BASE}/tasks/${t.id}`} className="font-medium text-primary-700 hover:underline">
                      {t.ticketCode}
                    </Link>
                  </td>
                  <td className={td}>{t.title}</td>
                  <td className={`${td} whitespace-nowrap`}>{STATE_LABEL[t.status]}</td>
                  <td className={td}>{t.assignedTo || '(empty)'}</td>
                  <td className={`${td} whitespace-nowrap`}>{stamp(t.createdAt)}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-400">
                    No records to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          The link between a request item and its tasks is kept in this browser only.
        </p>
      </div>
    </div>
  );
}
