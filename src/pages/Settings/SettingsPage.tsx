import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { getUsers, updateUser, changePassword } from '../../api/userApi';
import { getErrorMessage } from '../../utils/errorHandler';
import { toast } from '../../components/common/Toast';
import { Button } from '../../components/ui/Button';

const inputClass =
  'h-9 w-full rounded-lg border border-line bg-panel px-3 text-[13px] text-slate-800 placeholder:text-slate-400 transition-all hover:border-line-strong focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface SettingsPrefs {
  toastOnNewIssue: boolean;
  toastOnDeviceStatus: boolean;
  soundEnabled: boolean;
}

const PREFS_KEY = 'dex_settings';
const defaultPrefs: SettingsPrefs = {
  toastOnNewIssue: true,
  toastOnDeviceStatus: true,
  soundEnabled: false,
};

function loadPrefs(): SettingsPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <h2 className="font-display text-[15px] font-semibold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const user = useAppSelector((state) => state.auth.user);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [prefs, setPrefs] = useState<SettingsPrefs>(loadPrefs);
  const [resolvedId, setResolvedId] = useState<number | undefined>(user?.id);

  // Older sessions (stored before login responses included the user id) have
  // no id on the auth user. Resolve it from the users list by username so the
  // page still works without forcing a re-login.
  useEffect(() => {
    if (user?.id) {
      setResolvedId(user.id);
      return;
    }
    if (!user?.username) return;
    let cancelled = false;
    getUsers()
      .then((list) => {
        const self = list.find((u) => u.username === user.username);
        if (self && !cancelled) setResolvedId(self.id);
      })
      .catch(() => { /* leave unresolved; backend reachable on next load */ });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username]);

  const userId = resolvedId;

  // While the account id is unresolved show a brief placeholder instead of a
  // blank content area (the old behaviour when a stale session had no id).
  if (!userId) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
            Administration
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
            Settings
          </h1>
        </div>
        <div className="rounded-xl border border-line bg-panel p-10 text-center">
          <p className="text-sm text-slate-500">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const saveProfile = async () => {
    if (!userId) return;
    if (!email.trim()) {
      toast('Email is required', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateUser(userId, { fullName: fullName.trim() || undefined, email: email.trim() });
      toast('Profile updated', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!userId) return;
    if (newPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(userId, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast('Password changed — use it on your next sign-in', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const updatePref = (key: keyof SettingsPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary-600">
          Administration
        </p>
        <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em] text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">Your profile, credentials and notification preferences.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <SectionCard title="Profile" subtitle="How you appear across the platform.">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Username</label>
              <input type="text" value={user?.username ?? ''} disabled className={`${inputClass} cursor-not-allowed opacity-50`} />
              <p className="mt-1 text-[11px] text-slate-600">Usernames can’t be changed.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" loading={savingProfile} onClick={() => void saveProfile()}>
                Save Profile
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          {/* Password */}
          <SectionCard title="Change Password" subtitle="Update the password for your account.">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Repeat the password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  loading={savingPassword}
                  disabled={!newPassword || !confirmPassword}
                  onClick={() => void savePassword()}
                >
                  Update Password
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* Groups */}
          <SectionCard
            title="Groups"
            subtitle="Departments, sites and teams, with their devices, technicians and users inside."
          >
            <div className="flex flex-wrap gap-2">
              <Link to="/groups" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                All groups
              </Link>
              <Link to="/groups?view=DEPARTMENT" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Departments
              </Link>
              <Link to="/groups?view=SITE" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Sites
              </Link>
              <Link to="/groups?view=TEAM" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Teams
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Per group: how long logs are kept, which fixes are allowed, and whether new issues go to its own technicians.
            </p>
          </SectionCard>

          {/* Notifications */}
          <SectionCard
            title="Notifications"
            subtitle="What surfaces as a toast in the app. Saved on this device."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">New issue alerts</p>
                  <p className="text-[11px] text-slate-600">Toast when a new issue is detected.</p>
                </div>
                <Toggle checked={prefs.toastOnNewIssue} onChange={(v) => updatePref('toastOnNewIssue', v)} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">Device status changes</p>
                  <p className="text-[11px] text-slate-600">Toast when a device goes offline or errors.</p>
                </div>
                <Toggle checked={prefs.toastOnDeviceStatus} onChange={(v) => updatePref('toastOnDeviceStatus', v)} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">Sounds</p>
                  <p className="text-[11px] text-slate-600">Play a sound with toast notifications.</p>
                </div>
                <Toggle checked={prefs.soundEnabled} onChange={(v) => updatePref('soundEnabled', v)} />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}