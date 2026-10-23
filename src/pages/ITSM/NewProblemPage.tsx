import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchTickets } from '../../features/itsm/itsmSlice';
import { createTicket } from '../../api/itsmApi';
import { getArticles } from '../../api/knowledgeApi';
import type { KnowledgeArticle } from '../../types/knowledge';
import AddIncidentsModal from '../../components/itsm/AddIncidentsModal';
import NewTicketModal from '../../components/itsm/NewTicketModal';
import AddDevicesModal from '../../components/itsm/AddDevicesModal';
import type { Device, ItsmTicket } from '../../types';
import { GROUPS, Inp, Row, Sel, control } from './IncidentFormPage';
import { getCategoryMap } from '../../utils/categoryStore';

const STAGES = ['New', 'Assess', 'Root Cause Analysis', 'Fix in Progress', 'Resolved', 'Closed'];
const LEVELS = ['1 - High', '2 - Medium', '3 - Low'];

// Impact x urgency decides the priority (1 - Critical ... 5 - Planning).
const PRIORITIES = ['1 - Critical', '2 - High', '3 - Moderate', '4 - Low', '5 - Planning'];
const BACKEND_PRIORITY = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'LOW'];
function priorityIndex(impact: string, urgency: string) {
  const i = parseInt(impact, 10);
  const u = parseInt(urgency, 10);
  return Math.min(Math.max(i + u - 2, 0), 4);
}

interface Extra {
  reportedBy: string;
  category: string;
  subcategory: string;
  service: string;
  serviceOffering: string;
  ci: string;
  impact: string;
  urgency: string;
  assignmentGroup: string;
}
const NO_EXTRA: Extra = {
  reportedBy: '',
  category: '',
  subcategory: '',
  service: '',
  serviceOffering: '',
  ci: '',
  impact: '3 - Low',
  urgency: '3 - Low',
  assignmentGroup: '',
};

const TABS = ['Notes', 'Analysis Information', 'Resolution Information', 'Other Information'] as const;
type Tab = (typeof TABS)[number];
const RELATED_TABS = ['Incidents', 'Affected CIs', 'Problem Tasks', 'Change Requests', 'Outages', 'Attached Knowledge'] as const;
const RELATED: Record<
  (typeof RELATED_TABS)[number],
  { searchFields: string[]; columns: string[]; filterLabel: string; buttons: ('Add' | 'New' | 'Edit...')[] }
> = {
  Incidents: {
    searchFields: ['Number', 'Short description'],
    columns: ['Number', 'Opened', 'Short description', 'Caller', 'Priority', 'State', 'Category', 'Assignment group', 'Assigned to', 'Updated', 'Updated by', ''],
    filterLabel: 'Problem',
    buttons: ['Add', 'New'],
  },
  'Affected CIs': {
    searchFields: ['Configuration Item'],
    columns: ['Configuration Item', 'Class', 'Support group', 'Owned by', 'Applied', 'Applied date', 'Manual proposed change', 'Updated', ''],
    filterLabel: 'Task',
    buttons: ['Add'],
  },
  'Problem Tasks': {
    searchFields: ['Number'],
    columns: ['Number', 'Short description', 'Type', 'Priority', 'State', 'Close code', 'Assignment group', 'Assigned to', 'Order'],
    filterLabel: 'Problem',
    buttons: ['New'],
  },
  'Change Requests': {
    searchFields: ['Number'],
    columns: ['Number', 'Short description', 'Type', 'State', 'Planned start date', 'Planned end date', 'Requested by', 'Assigned to', ''],
    filterLabel: 'Parent',
    buttons: ['Add', 'New'],
  },
  Outages: { searchFields: ['Outage Number'], columns: ['Number', 'Outage', 'Begin', 'End', 'Duration'], filterLabel: 'Task', buttons: ['Edit...'] },
  'Attached Knowledge': { searchFields: ['Knowledge article'], columns: ['Knowledge article'], filterLabel: 'Task', buttons: [] },
};
const SEARCH_SCOPES = ['Knowledge (All)', 'Knowledge (Published)'];

const actionBtn = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50';

export default function NewProblemPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [number, setNumber] = useState('');
  const categories = getCategoryMap();
  const [f, setF] = useState<Extra>(NO_EXTRA);
  const [assignedTo, setAssignedTo] = useState('');
  const [statement, setStatement] = useState('');
  const [description, setDescription] = useState('');
  const username = useAppSelector((st) => st.auth.user?.username) ?? 'unknown';
  const [tab, setTab] = useState<Tab>('Notes');
  const [workNote, setWorkNote] = useState('');
  const [searchOpen, setSearchOpen] = useState(true);
  const [scope, setScope] = useState(SEARCH_SCOPES[0]);
  const [analysis, setAnalysis] = useState({ cause: '', workaround: '' });
  const [resolution, setResolution] = useState({ fixNotes: '', code: '' });
  const [linked, setLinked] = useState<ItsmTicket[]>([]);
  const [adding, setAdding] = useState(false);
  const [cis, setCis] = useState<Device[]>([]);
  const [addingCis, setAddingCis] = useState(false);
  const [changes, setChanges] = useState<ItsmTicket[]>([]);
  const [addingChanges, setAddingChanges] = useState(false);
  const [creatingChange, setCreatingChange] = useState(false);
  const [relatedSearch, setRelatedSearch] = useState('');
  const [related, setRelated] = useState<(typeof RELATED_TABS)[number]>('Incidents');
  // Shown as the "Opened" time; the real value is set by the backend on create.
  const [opened] = useState(() => new Date().toISOString().replace('T', ' ').slice(0, 19));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<KnowledgeArticle[] | null>(null);
  const [searching, setSearching] = useState(false);
  const set = (k: keyof Extra) => (v: string) =>
    setF((p) => (k === 'category' ? { ...p, category: v, subcategory: '' } : { ...p, [k]: v }));

  const p = priorityIndex(f.impact, f.urgency);
  const cfg = RELATED[related];
  const q = relatedSearch.trim().toLowerCase();
  const rowCount =
    related === 'Incidents'
      ? linked.filter((t) => !q || `${t.ticketCode} ${t.title}`.toLowerCase().includes(q)).length
      : related === 'Affected CIs'
        ? cis.filter((d) => !q || d.hostname.toLowerCase().includes(q)).length
        : related === 'Change Requests'
          ? changes.filter((t) => !q || `${t.ticketCode} ${t.title}`.toLowerCase().includes(q)).length
          : 0;

  const runSearch = async () => {
    if (!search.trim()) return setResults(null);
    setSearching(true);
    try {
      setResults(await getArticles({ search: search.trim() }));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!statement.trim()) return setError('Problem statement is required.');
    setBusy(true);
    setError(null);
    try {
      // The backend stores title, description, priority, category and assignee;
      // the other fields, except work notes (kept in this browser), are not persisted yet.
      const ticket = await createTicket({
        title: statement.trim(),
        description,
        priority: BACKEND_PRIORITY[p],
        category: 'Problem',
        assignedTo: assignedTo || undefined,
        ticketCode: number.trim() || undefined,
      });
      // Work notes use the same browser-side store as the incident page.
      if (workNote.trim()) {
        try {
          localStorage.setItem(
            `dex.incident.notes.${ticket.id}`,
            JSON.stringify([{ kind: 'Work notes', at: new Date().toISOString(), by: username, text: workNote.trim() }]),
          );
        } catch {
          /* storage unavailable: the note is lost, the problem is still created */
        }
      }
      if (linked.length) {
        try {
          localStorage.setItem(`dex.problem.incidents.${ticket.id}`, JSON.stringify(linked.map((t) => t.id)));
        } catch {
          /* storage unavailable: the links are lost, the problem is still created */
        }
      }
      if (cis.length) {
        try {
          localStorage.setItem(`dex.problem.cis.${ticket.id}`, JSON.stringify(cis.map((d) => d.id)));
        } catch {
          /* storage unavailable: the links are lost, the problem is still created */
        }
      }
      dispatch(fetchTickets());
      navigate('/tickets/problems/open');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the problem');
      setBusy(false);
    }
  };

  return (
    <div className="-mx-1 bg-white [&_input]:!py-1 [&_select]:!py-1 [&_textarea]:!py-1 [&_input]:!text-[11px] [&_select]:!text-[11px] [&_textarea]:!text-[11px] [&_label]:!text-[11px]">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <button onClick={() => navigate('/tickets/problems/open')} aria-label="Back to problems" className={actionBtn}>
          ←
        </button>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Problem</p>
          <p className="text-xs text-slate-600">New record</p>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="ml-auto rounded border border-primary-600 bg-white px-4 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      {/* State bar */}
      <div className="flex overflow-x-auto px-3 pt-3" aria-label="Problem state">
        {STAGES.map((s, i) => (
          <div
            key={s}
            className={`min-w-[110px] flex-1 px-4 py-2.5 text-center text-xs ${i === 0 ? 'bg-teal-600 font-semibold text-white' : 'bg-teal-100 text-slate-800'}`}
            style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)', marginLeft: i === 0 ? 0 : -8 }}
          >
            {s}
          </div>
        ))}
      </div>

      {error && <p className="mx-3 mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="grid gap-x-10 gap-y-3 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Row label="Number">
            <Inp value={number} onChange={setNumber} placeholder="Auto-generated if left blank" />
          </Row>
          <Row label="First reported by">
            <Inp value={f.reportedBy} onChange={set('reportedBy')} />
          </Row>
          <Row label="Category">
            <Sel value={f.category} onChange={set('category')} options={Object.keys(categories)} />
          </Row>
          <Row label="Subcategory">
            <Sel value={f.subcategory} onChange={set('subcategory')} options={categories[f.category] ?? []} />
          </Row>
          <Row label="Configuration item">
            <Inp value={f.ci} onChange={set('ci')} />
          </Row>
        </div>
        <div className="space-y-3">
          <Row label="State">
            <input disabled value="New" className={control} />
          </Row>
          <Row label="Impact">
            <Sel value={f.impact} onChange={set('impact')} options={LEVELS} blank="-- Select --" />
          </Row>
          <Row label="Urgency">
            <Sel value={f.urgency} onChange={set('urgency')} options={LEVELS} blank="-- Select --" />
          </Row>
          <Row label="Priority">
            <input disabled value={PRIORITIES[p]} className={control} />
          </Row>
          <Row label="Assignment group">
            <Sel value={f.assignmentGroup} onChange={set('assignmentGroup')} options={GROUPS} />
          </Row>
          <Row label="Assigned to">
            <Inp value={assignedTo} onChange={setAssignedTo} />
          </Row>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Row label="Problem statement" required>
            <Inp value={statement} onChange={setStatement} />
          </Row>
          <Row label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={control} />
          </Row>
        </div>
      </div>

      {/* Related search */}
      <div className="border-t border-slate-200 bg-slate-50 px-5 pb-5 pt-3">
        <div className="flex justify-center">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            className="rounded border border-primary-500 bg-white px-4 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50"
          >
            Related Search Results {searchOpen ? '^' : 'v'}
          </button>
        </div>
        {searchOpen && (
          <>
            <div className="mx-auto mt-4 grid max-w-5xl grid-cols-[110px_1fr_220px] items-center gap-3">
              <label className="text-right text-xs text-slate-600" title="Search the knowledge base for articles related to this problem">
                Related Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                placeholder="Search knowledge articles"
                aria-label="Related search"
                className={control}
              />
              <select value={scope} onChange={(e) => setScope(e.target.value)} className={control} aria-label="Search scope">
                {SEARCH_SCOPES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="mx-auto mt-4 max-w-5xl text-center text-xs text-slate-600">
              {searching ? (
                'Searching…'
              ) : results === null || results.length === 0 ? (
                <span className="font-semibold text-slate-800">No results to display</span>
              ) : (
                <ul className="space-y-1.5 text-left">
                  {results
                    .filter((a) => scope === SEARCH_SCOPES[0] || a.status === 'PUBLISHED')
                    .slice(0, 8)
                    .map((a) => (
                      <li key={a.id}>
                        <a href={`/knowledge/${a.id}`} target="_blank" rel="noreferrer" className="font-medium text-primary-700 hover:underline">
                          {a.title}
                        </a>
                        {a.category && <span className="ml-2 text-slate-500">{a.category}</span>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="px-3 pt-4">
        <div className="flex gap-px border-b border-slate-200" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border border-b-0 px-4 py-2 text-xs ${
                tab === t
                  ? 'border-slate-200 border-t-2 border-t-teal-600 bg-white font-semibold text-teal-700'
                  : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-3 border border-t-0 border-slate-200 p-5 shadow-sm">
          {tab === 'Notes' && (
            <>
              <Row label="Work notes list">
                <p className="text-xs text-slate-500">Work notes appear here once the problem is created.</p>
              </Row>
              <Row label="Work notes">
                <textarea value={workNote} onChange={(e) => setWorkNote(e.target.value)} rows={4} className={`${control} bg-yellow-50`} />
              </Row>
            </>
          )}
          {tab === 'Analysis Information' && (
            <>
              <Row label="Cause notes">
                <textarea value={analysis.cause} onChange={(e) => setAnalysis({ ...analysis, cause: e.target.value })} rows={4} className={control} />
              </Row>
              <Row label="Workaround">
                <textarea value={analysis.workaround} onChange={(e) => setAnalysis({ ...analysis, workaround: e.target.value })} rows={4} className={control} />
              </Row>
            </>
          )}
          {tab === 'Resolution Information' && (
            <>
              <Row label="Resolution code">
                <Sel
                  value={resolution.code}
                  onChange={(v) => setResolution({ ...resolution, code: v })}
                  options={['Fix applied', 'Risk accepted', 'Duplicate', 'Cannot reproduce']}
                />
              </Row>
              <Row label="Fix notes">
                <textarea value={resolution.fixNotes} onChange={(e) => setResolution({ ...resolution, fixNotes: e.target.value })} rows={4} className={control} />
              </Row>
            </>
          )}
          {tab === 'Other Information' && (
            <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
              <Row label="Opened by">
                <input disabled value={username} className={control} />
              </Row>
              <Row label="Opened">
                <input disabled value={opened} className={control} />
              </Row>
              <Row label="Confirmed by">
                <input disabled value="" className={control} />
              </Row>
              <Row label="Confirmed">
                <input disabled value="" className={control} />
              </Row>
            </div>
          )}
        </div>
      </div>

      {tab === 'Other Information' && (
        <div className="px-3 pt-4">
          <div className="flex flex-wrap gap-px border-b border-slate-200" role="tablist" aria-label="Related records">
            {RELATED_TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={related === t}
                onClick={() => setRelated(t)}
                className={`-mb-px border border-b-0 px-4 py-2 text-xs ${
                  related === t
                    ? 'border-slate-200 border-t-2 border-t-teal-600 bg-white font-semibold text-teal-700'
                    : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                {t}
                {t === 'Incidents' && linked.length > 0 && ` (${linked.length})`}
                {t === 'Affected CIs' && cis.length > 0 && ` (${cis.length})`}
                {t === 'Change Requests' && changes.length > 0 && ` (${changes.length})`}
              </button>
            ))}
          </div>
          <div className="border border-t-0 border-slate-200">
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 px-3 py-2">
              <select className={`${control} w-44`} aria-label="Search field" key={related}>
                {cfg.searchFields.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <input
                value={relatedSearch}
                onChange={(e) => setRelatedSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search related records"
                className={`${control} w-48`}
              />
              <div className="ml-auto flex gap-2">
                {cfg.buttons.map((label) => {
                  const handlers: Record<string, () => void> = {
                    'Incidents/Add': () => setAdding(true),
                    'Incidents/New': () => navigate('/tickets/incidents/new'),
                    'Affected CIs/Add': () => setAddingCis(true),
                    'Change Requests/Add': () => setAddingChanges(true),
                    'Change Requests/New': () => setCreatingChange(true),
                  };
                  const handler = handlers[`${related}/${label}`] as (() => void) | undefined;
                  return (
                    <button
                      key={label}
                      onClick={handler}
                      disabled={!handler}
                      title={handler ? undefined : 'Not available yet'}
                      className="rounded bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="px-3 py-2 text-xs text-slate-600">
              {cfg.filterLabel} = {number.trim() || '(auto-generated)'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-slate-200">
                    {cfg.columns.map((c, i) => (
                      <th key={`${c}${i}`} className="whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold text-slate-900">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {related === 'Incidents' &&
                    linked
                      .filter((t) => !q || `${t.ticketCode} ${t.title}`.toLowerCase().includes(q))
                      .map((t, i) => (
                        <tr key={t.id} className={`border-b border-slate-100 text-[11px] text-slate-800 ${i % 2 ? 'bg-slate-50' : ''}`}>
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-primary-700">{t.ticketCode}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{t.createdAt?.replace('T', ' ').slice(0, 19)}</td>
                          <td className="px-2.5 py-1.5">{t.title}</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{t.priority}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{t.status}</td>
                          <td className="px-2.5 py-1.5">{t.category ?? '(empty)'}</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5">{t.assignedTo || '(empty)'}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{(t.updatedAt ?? t.createdAt)?.replace('T', ' ').slice(0, 19)}</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5">
                            <button onClick={() => setLinked(linked.filter((x) => x.id !== t.id))} className="text-red-600 hover:underline">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                  {related === 'Affected CIs' &&
                    cis
                      .filter((d) => !q || d.hostname.toLowerCase().includes(q))
                      .map((d, i) => (
                        <tr key={d.id} className={`border-b border-slate-100 text-[11px] text-slate-800 ${i % 2 ? 'bg-slate-50' : ''}`}>
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-primary-700">{d.hostname}</td>
                          <td className="px-2.5 py-1.5">{d.os ?? 'Computer'}</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5">false</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{d.lastHeartbeat?.replace('T', ' ').slice(0, 19) ?? '(empty)'}</td>
                          <td className="px-2.5 py-1.5">
                            <button onClick={() => setCis(cis.filter((x) => x.id !== d.id))} className="text-red-600 hover:underline">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                  {related === 'Change Requests' &&
                    changes
                      .filter((t) => !q || `${t.ticketCode} ${t.title}`.toLowerCase().includes(q))
                      .map((t, i) => (
                        <tr key={t.id} className={`border-b border-slate-100 text-[11px] text-slate-800 ${i % 2 ? 'bg-slate-50' : ''}`}>
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-primary-700">{t.ticketCode}</td>
                          <td className="px-2.5 py-1.5">{t.title}</td>
                          <td className="px-2.5 py-1.5">{t.category ?? '(empty)'}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{t.status}</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5 text-slate-500">(empty)</td>
                          <td className="px-2.5 py-1.5">{t.assignedTo || '(empty)'}</td>
                          <td className="px-2.5 py-1.5">
                            <button onClick={() => setChanges(changes.filter((x) => x.id !== t.id))} className="text-red-600 hover:underline">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {rowCount === 0 && <p className="py-8 text-center text-xs font-semibold text-slate-700">No records to display</p>}
          </div>
        </div>
      )}

      {addingChanges && (
        <AddIncidentsModal
          section="change-requests"
          title="Add change requests"
          alreadyLinked={changes.map((t) => t.id)}
          onClose={() => setAddingChanges(false)}
          onAdd={(picked) => {
            setChanges((c) => [...c, ...picked]);
            setAddingChanges(false);
          }}
        />
      )}

      {creatingChange && (
        <NewTicketModal
          section="change-requests"
          onClose={() => setCreatingChange(false)}
          onCreated={() => {
            setCreatingChange(false);
            dispatch(fetchTickets());
          }}
        />
      )}

      {addingCis && (
        <AddDevicesModal
          alreadyLinked={cis.map((d) => d.id)}
          onClose={() => setAddingCis(false)}
          onAdd={(picked) => {
            setCis((c) => [...c, ...picked]);
            setAddingCis(false);
          }}
        />
      )}

      {adding && (
        <AddIncidentsModal
          alreadyLinked={linked.map((t) => t.id)}
          onClose={() => setAdding(false)}
          onAdd={(picked) => {
            setLinked((l) => [...l, ...picked]);
            setAdding(false);
          }}
        />
      )}

      <div className="px-3 py-4">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded border border-primary-600 bg-white px-4 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
