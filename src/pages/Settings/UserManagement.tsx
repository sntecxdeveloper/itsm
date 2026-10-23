import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppSelector } from '../../hooks/useAppSelector';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  type ManagedUser,
} from '../../api/userApi';
import { assignAccessRole, getAccessRoles, type AccessRole } from '../../api/accessApi';
import { formatDateTime } from '../../utils/formatDate';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';

const ROLES = ['ROLE_VIEWER', 'ROLE_OPERATOR', 'ROLE_ITSM_TECHNICIAN', 'ROLE_ADMIN'] as const;

const ROLE_TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  ROLE_ADMIN: 'danger',
  ROLE_OPERATOR: 'info',
  ROLE_ITSM_TECHNICIAN: 'success',
  ROLE_VIEWER: 'neutral',
};

const inputClass =
  'h-9 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const selectClass = `${inputClass} [color-scheme:light]`;

export default function UserManagement() {
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null);
  const [actingOn, setActingOn] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleToggle = async (user: ManagedUser) => {
    if (user.id === currentUser?.id || user.username === currentUser?.username) {
      toast('You cannot disable your own account', 'error');
      return;
    }
    setActingOn(user.id);
    try {
      const updated = await updateUser(user.id, { enabled: !user.enabled });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast(`${user.username} ${updated.enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setActingOn(null);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (user.id === currentUser?.id || user.username === currentUser?.username) {
      toast('You cannot delete your own account', 'error');
      return;
    }
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setActingOn(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast(`User "${user.username}" deleted`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setActingOn(null);
    }
  };

  const handleSave = async (data: {
    username: string;
    email: string;
    password?: string;
    fullName: string;
    role: string;
    accessRoleId?: number;
  }) => {
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          fullName: data.fullName || undefined,
          email: data.email,
          role: data.role,
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast('User updated', 'success');
      } else {
        const { accessRoleId, ...account } = data;
        const created = await createUser(account);
        setUsers((prev) => [...prev, created]);
        if (accessRoleId !== undefined) {
          // The role decides what the person sees (Setup → Roles). The account already exists if this step fails.
          try {
            await assignAccessRole(created.username, accessRoleId);
            void fetchUsers();
          } catch (err) {
            toast(`Account created, but the role could not be given: ${getErrorMessage(err)}`, 'error');
          }
        }
        toast(`User "${created.username}" created`, 'success');
      }
      setShowForm(false);
      setEditingUser(null);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const handleResetPassword = async (user: ManagedUser, newPassword: string) => {
    try {
      await changePassword(user.id, newPassword);
      setResettingUser(null);
      toast(`Password reset for "${user.username}"`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
            Administration
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create accounts, assign roles and control access to the platform.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
          onClick={() => {
            setEditingUser(null);
            setShowForm(true);
          }}
        >
          New User
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-red-500/25 bg-red-500/[0.06] px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-200">Couldn’t load users</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
          <Button size="sm" className="mt-5" variant="danger" onClick={() => void fetchUsers()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-line bg-panel">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line/60 px-5 py-4 last:border-b-0">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="hidden h-5 w-24 sm:block" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          {/* column headers */}
          <div className="hidden items-center gap-3 border-b border-line bg-white/[0.015] px-5 py-2.5 md:flex">
            <p className="flex-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              User
            </p>
            <p className="w-48 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Email
            </p>
            <p className="w-24 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Role
            </p>
            <p className="w-20 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status
            </p>
            <p className="hidden w-36 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 xl:block">
              Joined
            </p>
            <p className="w-44 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Actions
            </p>
          </div>

          {users.map((user) => {
            const isSelf =
              user.id === currentUser?.id ||
              (!!currentUser?.username && user.username === currentUser.username);
            const busy = actingOn === user.id;
            return (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-slate-50 md:flex-nowrap"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-800 font-display text-sm font-semibold text-white">
                    {(user.fullName || user.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {user.fullName || user.username}
                      {isSelf && <span className="ml-2 text-[10px] text-primary-600">(you)</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-slate-600">@{user.username}</p>
                  </div>
                </div>

                <span className="w-48 truncate font-mono text-[11px] text-slate-500">{user.email}</span>

                <span className="w-24 shrink-0">
                  <Badge tone={ROLE_TONE[user.role] ?? 'neutral'} dot>
                    {user.role.replace('ROLE_', '')}
                  </Badge>
                </span>

                <span className="w-20 shrink-0">
                  <button
                    onClick={() => void handleToggle(user)}
                    disabled={busy || isSelf}
                    title={isSelf ? 'You cannot disable your own account' : `Toggle ${user.username}`}
                    className={`relative h-5 w-10 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      user.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        user.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </span>

                <span className="hidden w-36 font-mono text-[11px] text-slate-600 xl:block">
                  {user.createdAt ? formatDateTime(user.createdAt) : '—'}
                </span>

                <span className="flex w-44 shrink-0 items-center justify-end gap-1.5">
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingUser(user);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setResettingUser(user)}>
                        Reset pass
                      </Button>
                      {user.role !== 'ROLE_ADMIN' && (
                        <button
                          title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                          disabled={isSelf}
                          onClick={() => void handleDelete(user)}
                          className="rounded-md border border-line p-1.5 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <UserForm
          user={editingUser}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Reset password modal */}
      {resettingUser && (
        <ResetPasswordForm
          user={resettingUser}
          onSave={(pw) => void handleResetPassword(resettingUser, pw)}
          onCancel={() => setResettingUser(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UserForm({
  user,
  onSave,
  onCancel,
}: {
  user: ManagedUser | null;
  onSave: (data: { username: string; email: string; password?: string; fullName: string; role: string; accessRoleId?: number }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    fullName: user?.fullName || '',
    role: user?.role || 'ROLE_VIEWER',
  });
  const [saving, setSaving] = useState(false);
  // Roles made in Setup → Roles: a new person can be given one straight away.
  const [accessRoles, setAccessRoles] = useState<AccessRole[]>([]);
  const [accessRoleId, setAccessRoleId] = useState<number | ''>('');
  useEffect(() => {
    if (user) return;
    getAccessRoles()
      .then((r) => setAccessRoles(r.filter((x) => !x.builtIn)))
      .catch(() => setAccessRoles([]));
  }, [user]);

  const submit = async () => {
    if (!form.username.trim() || !form.email.trim()) return;
    if (!user && form.password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password || undefined,
        fullName: form.fullName.trim(),
        role: form.role,
        accessRoleId: accessRoleId === '' ? undefined : accessRoleId,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
      >
        <h2 className="font-display text-lg font-semibold text-slate-900">{user ? 'Edit User' : 'New User'}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {user ? `Update ${user.username}'s account details.` : 'Create a new platform account.'}
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={!!user}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              placeholder="jdoe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={inputClass}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              placeholder="jane@company.com"
            />
          </div>
          {!user && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
                placeholder="Min 6 characters"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={selectClass}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace('ROLE_', '')}
                </option>
              ))}
            </select>
          </div>
          {!user && accessRoles.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Access role (optional)</label>
              <select value={accessRoleId} onChange={(e) => setAccessRoleId(e.target.value ? Number(e.target.value) : '')} className={selectClass}>
                <option value="">-- None: use the Role above --</option>
                {accessRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">A role made in Setup → Roles decides which features this person sees.</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!form.username.trim() || !form.email.trim() || (!user && !form.password)}
            onClick={() => void submit()}
          >
            {user ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ResetPasswordForm({
  user,
  onSave,
  onCancel,
}: {
  user: ManagedUser;
  onSave: (newPassword: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    if (password !== confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(password);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
      >
        <h2 className="font-display text-lg font-semibold text-slate-900">Reset Password</h2>
        <p className="mt-1 text-xs text-slate-500">
          Set a new password for <span className="font-mono text-slate-600">@{user.username}</span>. They will need to use
          it on their next sign-in.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              placeholder="Repeat the password"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} disabled={!password || !confirm} onClick={() => void submit()}>
            Reset Password
          </Button>
        </div>
      </motion.div>
    </div>
  );
}