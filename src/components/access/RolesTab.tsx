import { useCallback, useEffect, useState } from 'react';
import {
  assignAccessRole,
  createAccessRole,
  deleteAccessRole,
  getAccessRoles,
  getPeopleAccess,
  updateAccessRole,
  type AccessRoleView,
  type PersonAccess,
} from '../../api/accessApi';
import { Button } from '../ui/Button';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import { useAccess } from '../../context/AccessContext';
import RoleBuilder from './RoleBuilder';

const BASES = [
  { value: 'ROLE_VIEWER', label: 'Viewer sign-in' },
  { value: 'ROLE_OPERATOR', label: 'Operator sign-in' },
  { value: 'ROLE_ITSM_TECHNICIAN', label: 'ITSM technician sign-in' },
];

/** Roles and people: named roles you create, the visual builder, and who has which role (with exceptions). */
export default function RolesTab() {
  const { refresh: refreshMine } = useAccess();
  const [roles, setRoles] = useState<AccessRoleView[] | null>(null);
  const [people, setPeople] = useState<PersonAccess[]>([]);
  const [view, setView] = useState<'roles' | 'people'>('roles');
  const [openRole, setOpenRole] = useState<number | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', base: 'ROLE_VIEWER', copy: '' });

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([getAccessRoles(), getPeopleAccess()]);
      setRoles(r);
      setPeople(p);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      const r = await createAccessRole(form.name, form.base, form.description, form.copy ? Number(form.copy) : null);
      setCreating(false);
      setForm({ name: '', description: '', base: 'ROLE_VIEWER', copy: '' });
      await load();
      setOpenRole(r.id);
      toast(`"${r.name}" created. Now build it.`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const afterSave = () => {
    void load();
    void refreshMine();
  };

  const role = roles?.find((r) => r.id === openRole);
  const person = people.find((p) => p.username === openPerson);

  if (role && view === 'roles')
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpenRole(null)} className="text-[12px] text-slate-500 hover:text-slate-800">
          ← All roles
        </button>
        {role.baseRole === 'ROLE_ADMIN' ? (
          <p className="rounded-xl border border-line bg-panel p-5 text-sm text-slate-600">Administrators always have everything; this role cannot be changed.</p>
        ) : (
          <RoleBuilder key={role.id} mode={{ kind: 'role', role }} onSaved={afterSave} />
        )}
      </div>
    );

  if (person && view === 'people')
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpenPerson(null)} className="text-[12px] text-slate-500 hover:text-slate-800">
          ← All people
        </button>
        {person.signInRole === 'ROLE_ADMIN' ? (
          <p className="rounded-xl border border-line bg-panel p-5 text-sm text-slate-600">Administrators always have everything.</p>
        ) : (
          <RoleBuilder key={person.username} mode={{ kind: 'person', person, role: roles?.find((r) => r.id === person.roleId) }} onSaved={afterSave} />
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['roles', 'people'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${view === v ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 ring-1 ring-line'}`}>
            {v === 'roles' ? 'Roles' : 'People'}
          </button>
        ))}
      </div>

      {view === 'roles' && (
        <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Roles</h3>
              <p className="text-[12px] text-slate-500">What each role sees and may use in the console. ITSM and the administrators' area are not part of roles.</p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              New role
            </Button>
          </div>
          {creating && (
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-[12px] sm:grid-cols-2">
              <label>
                Name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Help desk L1" maxLength={80} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2" />
              </label>
              <label>
                Built on
                <select value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} className="mt-0.5 block h-8 w-full rounded border border-slate-300 bg-white px-2">
                  {BASES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start from
                <select value={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.value })} className="mt-0.5 block h-8 w-full rounded border border-slate-300 bg-white px-2">
                  <option value="">Nothing (add what it needs)</option>
                  {roles?.filter((r) => r.baseRole !== 'ROLE_ADMIN').map((r) => (
                    <option key={r.id} value={r.id}>
                      A copy of {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} className="mt-0.5 block h-8 w-full rounded border border-slate-300 px-2" />
              </label>
              <p className="text-[11px] text-slate-500 sm:col-span-2">"Built on" decides how the person signs in and what they get in ITSM; everything else comes from this role.</p>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!form.name.trim()} onClick={() => void create()}>
                  Create and build
                </Button>
              </div>
            </div>
          )}
          <ul className="divide-y divide-line text-[13px]">
            {roles?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  {r.builtIn && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">built-in</span>}
                  <span className="ml-2 text-[11px] text-slate-400">
                    {r.people} {r.people === 1 ? 'person' : 'people'}
                    {r.description ? ` · ${r.description}` : ''}
                  </span>
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setOpenRole(r.id)} className="text-[12px] font-medium text-primary-600 hover:text-primary-700">
                    {r.baseRole === 'ROLE_ADMIN' ? 'View' : 'Open builder'}
                  </button>
                  {!r.builtIn && (
                    <>
                      <button
                        type="button"
                        className="text-[12px] text-slate-500 hover:text-slate-800"
                        onClick={() => {
                          const name = window.prompt('New name', r.name);
                          if (name) void updateAccessRole(r.id, name, r.description ?? '').then(load).catch((err) => toast(getErrorMessage(err), 'error'));
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="text-[12px] text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`Remove "${r.name}"? Its ${r.people} people go back to the built-in role of their sign-in.`))
                            void deleteAccessRole(r.id).then(load).catch((err) => toast(getErrorMessage(err), 'error'));
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === 'people' && (
        <section className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800">People</h3>
          <p className="text-[12px] text-slate-500">Give each person a role. "Exceptions" opens the builder for just that person.</p>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Person</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.username} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <span className="font-medium text-slate-800">{p.username}</span>
                    {p.fullName && <span className="ml-2 text-[11px] text-slate-400">{p.fullName}</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={p.roleId ?? ''}
                      onChange={(e) => void assignAccessRole(p.username, Number(e.target.value)).then(load).then(() => toast('Role changed', 'success')).catch((err) => toast(getErrorMessage(err), 'error'))}
                      className="rounded border border-line bg-white px-2 py-1 text-[12px]"
                    >
                      {roles?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => setOpenPerson(p.username)} className="text-[12px] text-primary-600 hover:text-primary-700">
                      Exceptions{p.exceptions > 0 ? ` (${p.exceptions})` : ''}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
