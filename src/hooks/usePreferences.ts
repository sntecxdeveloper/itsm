import { usePersistedState } from './usePersistedState';

interface Preferences {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  tablePageSize: number;
  defaultView: 'grid' | 'list';
  notifications: boolean;
  emailDigest: boolean;
}

const defaultPreferences: Preferences = {
  theme: 'light',
  sidebarCollapsed: false,
  tablePageSize: 20,
  defaultView: 'grid',
  notifications: true,
  emailDigest: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = usePersistedState<Preferences>(
    'preferences',
    defaultPreferences
  );

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return {
    preferences,
    updatePreference,
    resetPreferences,
  };
}
