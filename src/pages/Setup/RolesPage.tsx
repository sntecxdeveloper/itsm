import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assignAccessRole,
  createAccessRole,
  deleteAccessRole,
  getAccessCatalog,
  getAccessPeople,
  getAccessRoles,
  getRoleGrants,
  setRoleGrants,
  type AccessEntry,
  type AccessPerson,
  type AccessRole,
  type CatalogItem,
} from '../../api/accessApi';

const field =
  'rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const primary = 'rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50';

type Choice = 'HIDDEN' | 'VIEW' | 'EDIT';
const CHOICES: { value: Choice; label: string }[] = [
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'VIEW', label: 'View only' },
  { value: 'EDIT', label: 'Can edit' },
];
const LEVELS = [
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'VIEW', label: 'View only' },
  { value: 'FULL', label: 'Full' },
];

/** The kind of account a role signs in as: what a person with it is, whatever the role is called. */
const LEVEL_LABEL: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_ITSM_TECHNICIAN: 'ITSM Technician',
  ROLE_OPERATOR: 'Operator',
  ROLE_VIEWER: 'Viewer',
};
const levelLabel = (role?: string | null) => (role ? LEVEL_LABEL[role] ?? role.replace('ROLE_', '') : '');

const message = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e instanceof Error ? e.message : 'Something went wrong');

/** Setup → Roles: who may open and change which Setup section. Roles are made here and given to people; nothing is fixed in code. */
export default function RolesPage() {
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [people, setPeople] = useState<AccessPerson[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [tab, setTab] = useState<'roles' | 'people'>('roles');
  const [openId, setOpenId] = useState<number | null>(null);
  const [grants, setGrants] = useState<AccessEntry[]>([]);
  // The value of every page (HIDDEN / VIEW / FULL) and action (ALLOW / DENY) of the open role.
  const [values, setValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startFrom, setStartFrom] = useState<number | ''>('');
  // A role starting from Administrator copies every feature; it still needs a sign-in level of its own.
  const [level, setLevel] = useState('ROLE_ITSM_TECHNICIAN');

  const sections = catalog.filter((c) => c.kind === 'PAGE' && c.key.startsWith('setup-'));
  const consolePages = catalog.filter((c) => c.kind === 'PAGE' && !c.key.startsWith('setup-'));
  const actionsOf = (page: string) => catalog.filter((c) => c.kind === 'ACTION' && c.page === page);
  const starters = roles.filter((r) => r.builtIn);
  const fromAdmin = starters.find((r) => r.id === startFrom)?.baseRole === 'ROLE_ADMIN';
  const open = roles.find((r) => r.id === openId) ?? null;

  const reload = useCallback(async () => {
    try {
      const [r, p, c] = await Promise.all([getAccessRoles(), getAccessPeople(), getAccessCatalog()]);
      setRoles(r);
      setPeople(p);
      setCatalog(c);
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A Setup section is shown as Hidden / View only / Can edit: "edit" is the page at Full plus its edit action.
  const choiceOf = (page: string): Choice => {
    const level = values[page];
    if (level === 'FULL' && values[`${page}.edit`] === 'ALLOW') return 'EDIT';
    return level === 'HIDDEN' || !level ? 'HIDDEN' : 'VIEW';
  };
  const setChoice = (page: string, choice: Choice) =>
    setValues((v) => ({
      ...v,
      [page]: choice === 'EDIT' ? 'FULL' : choice,
      [`${page}.edit`]: choice === 'EDIT' ? 'ALLOW' : 'DENY',
    }));

  const openRole = async (role: AccessRole) => {
    setOpenId(role.id);
    setNotice(null);
    try {
      const entries = await getRoleGrants(role.id);
      setGrants(entries);
      setValues(Object.fromEntries(entries.map((e) => [e.key, e.value])));
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    }
  };

  const create = async () => {
    const starter = starters.find((r) => r.id === startFrom);
    if (!name.trim()) return setNotice({ tone: 'bad', text: 'Give the role a name.' });
    if (!starter) return setNotice({ tone: 'bad', text: 'Choose what the role starts from.' });
    setBusy(true);
    try {
      const made = await createAccessRole({
        name: name.trim(),
        description: description.trim() || undefined,
        baseRole: starter.baseRole === 'ROLE_ADMIN' ? level : starter.baseRole,
        copyFrom: starter.id,
      });
      setName('');
      setDescription('');
      await reload();
      setNotice({ tone: 'ok', text: `Role "${made.name}" created. Choose what it can do in Setup below.` });
      await openRole(made);
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!open) return;
    setBusy(true);
    try {
      // The whole role is sent back with the values shown on screen.
      const next = grants.map((g) => {
        const level = values[g.key] ?? g.value;
        return { key: g.key, level, required: g.required && level !== 'HIDDEN' };
      });
      const saved = await setRoleGrants(open.id, next);
      setGrants(saved);
      setValues(Object.fromEntries(saved.map((e) => [e.key, e.value])));
      setNotice({ tone: 'ok', text: `Saved. People with "${open.name}" get this the next time they sign in or refresh.` });
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!open || !window.confirm(`Delete the role "${open.name}"? Its ${open.people} people go back to their normal role.`)) return;
    try {
      await deleteAccessRole(open.id);
      setOpenId(null);
      await reload();
      setNotice({ tone: 'ok', text: 'Role deleted.' });
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    }
  };

  const assign = async (person: AccessPerson, roleId: number) => {
    try {
      await assignAccessRole(person.username, roleId);
      await reload();
      setNotice({ tone: 'ok', text: `${person.username} updated. It applies the next time they sign in.` });
    } catch (e) {
      setNotice({ tone: 'bad', text: message(e) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <Link to="/setup" className="text-primary-700 hover:underline">
          Setup
        </Link>
        <span className="text-slate-300">›</span>
        <span className="font-medium text-slate-800">Roles</span>
      </div>
      <p className="max-w-3xl text-xs text-slate-500">
        Make a role such as "Company B admin", choose which Setup sections it may see or change, then give it to a person. An administrator
        always has everything; other roles only get what you tick here.
      </p>
      {notice && <p className={`rounded px-3 py-1.5 text-xs ${notice.tone === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{notice.text}</p>}

      <div className="flex gap-2 border-b border-slate-200">
        {(['roles', 'people'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium ${tab === t ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t === 'roles' ? 'Roles' : 'People'}
          </button>
        ))}
      </div>

      {tab === 'roles' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-[13px] font-semibold text-slate-900">New role</h2>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name, e.g. Company B admin" aria-label="Role name" className={`${field} w-full`} />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it is for (optional)" aria-label="Description" className={`${field} w-full`} />
              <label className="block text-[11px] font-medium text-slate-600">
                Starts from
                <select value={startFrom} onChange={(e) => setStartFrom(e.target.value ? Number(e.target.value) : '')} className={`${field} mt-1 w-full`}>
                  <option value="">-- Choose --</option>
                  {starters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {fromAdmin && (
                <label className="block text-[11px] font-medium text-slate-600">
                  Sign-in level
                  <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${field} mt-1 w-full`}>
                    <option value="ROLE_ITSM_TECHNICIAN">ITSM Technician (works on incidents)</option>
                    <option value="ROLE_OPERATOR">Operator (runs the fleet)</option>
                    <option value="ROLE_VIEWER">Viewer (looks only)</option>
                  </select>
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">Starts with every feature; untick what this person must not have.</span>
                </label>
              )}
              <button onClick={() => void create()} disabled={busy} className={primary}>
                Create role
              </button>
            </section>
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => void openRole(r)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${
                      openId === r.id ? 'border-primary-400 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{r.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {r.builtIn ? 'Built-in' : `${levelLabel(r.baseRole)} · ${r.description || 'custom role'}`}
                      </span>
                    </span>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-400">{r.people} people</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            {!open ? (
              <p className="py-10 text-center text-xs text-slate-400">Choose a role on the left, or create one.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[13px] font-semibold text-slate-900">{open.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{levelLabel(open.baseRole)}</span>
                  {!open.builtIn && (
                    <button onClick={() => void remove()} className="ml-auto text-xs text-red-600 hover:underline">
                      Delete role
                    </button>
                  )}
                </div>
                {open.baseRole === 'ROLE_ADMIN' ? (
                  <p className="text-xs text-slate-500">Administrators always have everything. To give someone fewer features, create a role starting from Administrator.</p>
                ) : (
                  <>
                    {open.builtIn && (
                      <p className="rounded bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                        This is a built-in role: a change applies to all {open.people} people who have it.
                      </p>
                    )}
                    <p className="text-[11px] font-medium text-slate-600">Setup</p>
                    <ul className="divide-y divide-slate-100">
                      {sections.map((s) => (
                        <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="text-xs text-slate-800">{s.label.replace(/^Setup:\s*/, '')}</span>
                          <select value={choiceOf(s.key)} onChange={(e) => setChoice(s.key, e.target.value as Choice)} aria-label={s.label} className={field}>
                            {CHOICES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-2 text-[11px] font-medium text-slate-600">Console pages</p>
                    <ul className="divide-y divide-slate-100">
                      {consolePages.map((pg) => (
                        <li key={pg.key} className="py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-slate-800">{pg.label}</span>
                            <select
                              value={values[pg.key] ?? 'HIDDEN'}
                              onChange={(e) => setValues((v) => ({ ...v, [pg.key]: e.target.value }))}
                              aria-label={pg.label}
                              className={field}
                            >
                              {LEVELS.map((l) => (
                                <option key={l.value} value={l.value}>
                                  {l.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {(values[pg.key] ?? 'HIDDEN') !== 'HIDDEN' && actionsOf(pg.key).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-3">
                              {actionsOf(pg.key).map((a) => (
                                <label key={a.key} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={values[a.key] === 'ALLOW'}
                                    onChange={(e) => setValues((v) => ({ ...v, [a.key]: e.target.checked ? 'ALLOW' : 'DENY' }))}
                                  />
                                  {a.label}
                                </label>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-400">ITSM, Mail settings, Users and Roles stay with full administrators.</p>
                    <button onClick={() => void save()} disabled={busy} className={primary}>
                      Save role
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                {['Person', 'Name', 'Current role', 'Type', 'Give role'].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.username} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-900">{p.username}</td>
                  <td className="px-3 py-2 text-slate-600">{p.fullName || ''}</td>
                  <td className="px-3 py-2">{p.roleName || levelLabel(p.signInRole)}</td>
                  <td className="px-3 py-2 text-slate-600">{levelLabel(p.signInRole)}</td>
                  <td className="px-3 py-2">
                    <select
                      value={p.roleId ?? ''}
                      onChange={(e) => e.target.value && void assign(p, Number(e.target.value))}
                      aria-label={`Role of ${p.username}`}
                      className={field}
                    >
                      <option value="">-- Choose --</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.builtIn ? r.name : `${r.name} (${levelLabel(r.baseRole)})`}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No people yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
