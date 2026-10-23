// Setup → Incident Form: the lists and hints on the New Incident / incident forms that used to be fixed in code.
// The backend has no table for them yet, so they live in this browser, like the category list.
const KEY = 'dex.setup.incidentForm';

export const DEFAULT_CHANNELS = ['Self-service', 'Phone', 'Email', 'Chat', 'Walk-in'];
export const DEFAULT_SHORT_DESCRIPTION_EXAMPLE = 'MS Office not opening';

export interface IncidentFormSettings {
  channels: string[];
  /** Shown as "e.g. <example> on my laptop since this morning" when no Item is chosen. */
  shortDescriptionExample: string;
}

export const DEFAULT_FORM_SETTINGS: IncidentFormSettings = {
  channels: DEFAULT_CHANNELS,
  shortDescriptionExample: DEFAULT_SHORT_DESCRIPTION_EXAMPLE,
};

export function loadFormSettings(): IncidentFormSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<IncidentFormSettings> | null;
    if (parsed) {
      return {
        channels: Array.isArray(parsed.channels) ? parsed.channels : DEFAULT_CHANNELS,
        shortDescriptionExample: parsed.shortDescriptionExample?.trim() || DEFAULT_SHORT_DESCRIPTION_EXAMPLE,
      };
    }
  } catch {
    /* unreadable or storage blocked: the defaults */
  }
  return DEFAULT_FORM_SETTINGS;
}

/** Returns false when the browser refused the write. */
export function saveFormSettings(settings: IncidentFormSettings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function resetFormSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored to remove */
  }
}
