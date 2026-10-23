// The backend has no services table yet: the list managed in Setup lives in this browser.
const KEY = 'dex.catalog.services';

const DEFAULTS = ['Email', 'VPN', 'Active Directory', 'Printing', 'File Share'];

export function loadServices(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveServices(services: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(services));
  } catch {
    /* storage unavailable: the list stays for this visit only */
  }
}
