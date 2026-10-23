import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { getTicketById, updateTicketStatus } from '../../api/itsmApi';
import ErrorMessage from '../../components/common/ErrorMessage';
import { Inp, Row, control } from './IncidentFormPage';
import {
  Banner,
  FORM_WRAP,
  NO_RITM,
  ReadOnly,
  RequesterDetails,
  STATES,
  STATE_LABEL,
  actionBtn,
  iconBtn,
  loadRitm,
  loadTask,
  readJson,
  stamp,
  taskKey,
  taskNotesKey,
  writeJson,
  type TaskFields,
  type TaskNote,
} from './serviceRequestShared';
import type { ItsmTicket, TicketStatus } from '../../types';

const BACK = '/tickets/service-requests/requests';
const TABS = ['Affected CIs', 'Approvers', 'Group approvals', 'Time Worked'] as const;
type Tab = (typeof TABS)[number];

const PRIORITY_LABEL = { CRITICAL: '1 - Critical', HIGH: '2 - High', MEDIUM: '3 - Moderate', LOW: '4 - Low' } as const;

export default function CatalogTaskPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { tickets: all } = useAppSelector((s) => s.itsm);
  const username = useAppSelector((s) => s.auth.user?.username) ?? 'unknown';

  const [ticket, setTicket] = useState<ItsmTicket | null>(null);
  const [state, setState] = useState<TicketStatus>('OPEN');
  const [fields, setFields] = useState<TaskFields>(() => loadTask(taskId));
  const [saved, setSaved] = useState<TaskFields>(() => loadTask(taskId));
  const [notes, setNotes] = useState<TaskNote[]>(() => readJson<TaskNote[]>(taskNotesKey(taskId), []));
  const [comment, setComment] = useState('');
  const [isWorkNote, setIsWorkNote] = useState(false);
  const [tab, setTab] = useState<Tab>('Affected CIs');
  const [ciDraft, setCiDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setF = <K extends keyof TaskFields>(k: K) => (v: TaskFields[K]) => setFields((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (all.length === 0) dispatch(fetchTickets());
  }, [all.length, dispatch]);

  useEffect(() => {
    const f = loadTask(taskId);
    setFields(f);
    setSaved(f);
    setNotes(readJson<TaskNote[]>(taskNotesKey(taskId), []));
    setComment('');
    setMessage(null);
  }, [taskId]);

  useEffect(() => {
    let live = true;
    getTicketById(taskId)
      .then((t) => {
        if (!live) return;
        setTicket(t);
        setState(t.status);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load the catalog task'));
    return () => {
      live = false;
    };
  }, [taskId]);

  const persistNotes = (next: TaskNote[]) => {
    setNotes(next);
    writeJson(taskNotesKey(taskId), next);
  };

  const apply = async (next: TicketStatus, goBack: boolean) => {
    if (!ticket) return;
    setSaving(true);
    setMessage(null);
    try {
      const at = new Date().toISOString();
      const fresh: TaskNote[] = [];
      let current = ticket;
      if (next !== ticket.status) {
        current = await updateTicketStatus(ticket.id, next);
        fresh.push({ kind: 'Field changes', at, by: username, changes: [['State', STATE_LABEL[next]]] });
      }
      const changes: [string, string][] = [];
      if (fields.affectedCi !== saved.affectedCi) changes.push(['Affected CI', fields.affectedCi || '(empty)']);
      if (fields.watchList !== saved.watchList) changes.push(['Watch list', fields.watchList || '(empty)']);
      if (fields.workInstructions !== saved.workInstructions) changes.push(['Work instructions', 'updated']);
      if (changes.length) fresh.push({ kind: 'Field changes', at, by: username, changes });
      writeJson(taskKey(ticket.id), fields);
      setSaved(fields);
      if (fresh.length) persistNotes([...fresh, ...notes]);
      setTicket(current);
      setState(current.status);
      dispatch(fetchTickets());
      if (goBack) navigate(-1);
      else setMessage('Saved. Fields other than the state are kept in this browser only.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save the catalog task');
    } finally {
      setSaving(false);
    }
  };

  const post = () => {
    if (!comment.trim()) return;
    persistNotes([
      {
        kind: isWorkNote ? 'Work notes' : 'Additional comments',
        at: new Date().toISOString(),
        by: username,
        text: comment.trim(),
      },
      ...notes,
    ]);
    setComment('');
  };

  const addCi = () => {
    const v = ciDraft?.trim();
    if (!v) return;
    setFields((f) => ({ ...f, affectedCis: [...f.affectedCis, v] }));
    setCiDraft(null);
  };

  if (error) return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  if (!ticket) return <p className="py-12 text-center text-sm text-slate-400">Loading…</p>;

  const parent = fields.requestItem != null ? all.find((t) => t.id === fields.requestItem) : undefined;
  const parentFields = fields.requestItem != null ? loadRitm(fields.requestItem) : NO_RITM;
  const dirty = state !== ticket.status || JSON.stringify(fields) !== JSON.stringify(saved);
  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const activities: TaskNote[] = [
    ...notes,
    {
      kind: 'Field changes',
      at: ticket.createdAt,
      by: 'System',
      changes: [
        ['Priority', PRIORITY_LABEL[ticket.priority]],
        ['State', 'Open'],
      ],
    },
  ];
  const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-900';

  return (
    <div className={FORM_WRAP}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate(BACK)} aria-label="Back to service requests" className={iconBtn}>
          ‹
        </button>
        <p className="text-[13px] font-semibold text-slate-900">Catalog Task - {ticket.ticketCode}</p>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={!dirty || saving} onClick={() => void apply(state, true)} className={actionBtn}>
            Update
          </button>
          <button disabled={!dirty || saving} onClick={() => void apply(state, false)} className={actionBtn}>
            Save
          </button>
          <button disabled={closed || saving} onClick={() => void apply('RESOLVED', false)} className={actionBtn}>
            Close Task
          </button>
          <button onClick={() => navigate(BACK)} aria-label="Up to service requests" className={iconBtn}>
            ↑
          </button>
        </div>
      </div>
      {message && <Banner text={message} />}

      <div className="grid gap-x-10 gap-y-3 px-4 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Affected CI">
            <Inp value={fields.affectedCi} onChange={setF('affectedCi')} />
          </Row>
          <Row label="Watch list">
            <Inp value={fields.watchList} onChange={setF('watchList')} placeholder="Comma-separated users" />
          </Row>
        </div>
        <div className="space-y-3">
          <Row label="State">
            <select value={state} onChange={(e) => setState(e.target.value as TicketStatus)} className={control}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Request item">
            {parent ? (
              <Link
                to={`/tickets/service-requests/items/${parent.id}`}
                className={`${control} block !bg-slate-100 font-medium text-primary-700 hover:underline`}
              >
                {parent.ticketCode}
              </Link>
            ) : (
              <ReadOnly value={fields.requestItem != null ? `#${fields.requestItem}` : ''} />
            )}
          </Row>
          <Row label="Requested for">
            <ReadOnly value={parentFields.requestedFor} />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Short description" required>
            <ReadOnly value={ticket.title} />
          </Row>
          <Row label="Description">
            <textarea disabled readOnly rows={3} value={ticket.description ?? ''} className={control} />
          </Row>
          <Row label="Work Instructions">
            <textarea
              rows={3}
              value={fields.workInstructions}
              onChange={(e) => setF('workInstructions')(e.target.value)}
              className={control}
            />
          </Row>
        </div>
      </div>

      <RequesterDetails values={parentFields} />

      {/* Comments */}
      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-[150px_1fr_auto] items-start gap-3">
          <label className="pt-1.5 text-right text-[13px] leading-tight text-slate-600">Additional comments (Customer visible)</label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${control} ${isWorkNote ? 'border-l-4 border-l-yellow-400' : ''}`}
          />
          <span />
        </div>
        <div className="flex items-center justify-end gap-3">
          <label className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <input type="checkbox" checked={isWorkNote} onChange={(e) => setIsWorkNote(e.target.checked)} /> Work notes
          </label>
          <button disabled={!comment.trim()} onClick={post} className={actionBtn}>
            Post
          </button>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <label className="pt-2 text-right text-[13px] text-slate-600">Activity</label>
          <ul className="space-y-2">
            {activities.map((n, i) => (
              <li
                key={`${n.at}-${i}`}
                className={`rounded border border-slate-200 bg-white px-3 py-2 text-[13px] ${
                  n.kind === 'Work notes' ? 'border-l-4 border-l-yellow-400' : n.kind === 'Additional comments' ? 'border-l-4 border-l-primary-400' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-800">
                  <span className="font-medium">{n.by}</span>
                  <span className="text-[12px] text-slate-600">
                    {n.kind} <span className="mx-1">•</span> {stamp(n.at)}
                  </span>
                </div>
                {n.text && <p className="mt-1 whitespace-pre-wrap text-slate-700">{n.text}</p>}
                {n.changes && (
                  <dl className="mt-1.5 grid grid-cols-[130px_1fr] gap-y-0.5 text-[12.5px]">
                    {n.changes.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-right text-slate-500">{k}</dt>
                        <dd className="pl-3 text-slate-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button disabled={!dirty || saving} onClick={() => void apply(state, true)} className={actionBtn}>
          Update
        </button>
        <button disabled={!dirty || saving} onClick={() => void apply(state, false)} className={actionBtn}>
          Save
        </button>
        <button disabled={closed || saving} onClick={() => void apply('RESOLVED', false)} className={actionBtn}>
          Close Task
        </button>
      </div>

      {/* Related lists */}
      <div className="px-4 pb-8">
        <div className="flex gap-0.5 border-b border-slate-300">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px rounded-t border border-b-0 px-3.5 py-2 text-[13px] ${
                tab === t
                  ? 'border-slate-300 border-t-2 border-t-primary-600 bg-white font-medium text-slate-900'
                  : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="border-x border-b border-slate-200">
          {tab === 'Affected CIs' && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[13px] font-medium text-slate-800">Affected CIs</span>
              {ciDraft === null ? (
                <button onClick={() => setCiDraft('')} className="rounded bg-primary-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-primary-700">
                  Edit...
                </button>
              ) : (
                <>
                  <input
                    autoFocus
                    value={ciDraft}
                    onChange={(e) => setCiDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCi()}
                    placeholder="Configuration item"
                    className={`${control} max-w-xs`}
                  />
                  <button disabled={!ciDraft.trim()} onClick={addCi} className={actionBtn}>
                    Add
                  </button>
                  <button onClick={() => setCiDraft(null)} className={actionBtn}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
          <p className="px-3 py-2 text-[13px] text-slate-700">Task = {ticket.ticketCode}</p>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-y border-slate-200">
                {(tab === 'Affected CIs'
                  ? ['Applied', 'Applied date', 'Configuration Item']
                  : tab === 'Approvers'
                    ? ['State', 'Approver', 'Comments', 'Created']
                    : tab === 'Group approvals'
                      ? ['Approval group', 'Approval', 'Created']
                      : ['User', 'Time worked', 'Created']
                ).map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab === 'Affected CIs' && fields.affectedCis.length > 0 ? (
                fields.affectedCis.map((ci, i) => (
                  <tr key={`${ci}-${i}`} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-800">false</td>
                    <td className="px-3 py-1.5 text-slate-700" />
                    <td className="px-3 py-1.5 text-slate-800">{ci}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[13px] font-medium text-slate-500">
                    No records to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
