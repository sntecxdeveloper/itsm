export interface Category {
  name: string;
  subcategories: string[];
}

const c = (name: string, ...subcategories: string[]): Category => ({ name, subcategories });

/** The starting list; Setup → Category & Subcategory edits a copy kept in this browser. */
export const DEFAULT_CATEGORIES: Category[] = [
  c('Software', 'Application Not Working', 'Application Installation', 'Application Crash', 'Application Update', 'License Issue', 'Software Configuration', 'Microsoft Office', 'Outlook', 'Teams', 'Browser'),
  c('Hardware', 'Laptop/Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Scanner', 'Hard Disk', 'RAM', 'Power/Battery'),
  c('Network', 'Internet Connectivity', 'Wi-Fi', 'LAN', 'VPN', 'DNS', 'DHCP', 'Network Slow', 'Proxy'),
  c('Email', 'Outlook', 'Mailbox', 'Shared Mailbox', 'Email Not Sending', 'Email Not Receiving', 'Spam/Junk Mail', 'Email Configuration'),
  c('Security', 'Antivirus', 'Malware', 'Password', 'Account Lockout', 'MFA', 'Phishing', 'Security Policy'),
  c('Access Management', 'User Account', 'Application Access', 'Folder Access', 'Shared Drive', 'VPN Access', 'Admin Access'),
  c('Operating System', 'Windows', 'Windows Update', 'Login Issue', 'Blue Screen', 'System Slow', 'System Crash', 'Driver Issue'),
  c('Printer', 'Printer Offline', 'Print Queue', 'Driver', 'Network Printer', 'Printing Quality', 'Printer Installation'),
  c('Performance', 'High CPU', 'High Memory', 'High Disk Usage', 'System Slow', 'Application Slow', 'Boot Slow'),
  c('IT Services', 'Service Request', 'Incident', 'Change Request', 'Problem', 'New User Setup', 'Employee Onboarding', 'Employee Offboarding'),
];

// The backend has no category table yet: the list lives in this browser.
const KEY = 'dex.setup.categories';

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Category[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* unreadable or storage blocked: fall back to the defaults */
  }
  return DEFAULT_CATEGORIES;
}

/** Returns false when the browser refused the write. */
export function saveCategories(list: Category[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function resetCategories() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored to remove */
  }
}

/** Category name → its subcategories, for the incident and problem forms. */
export function getCategoryMap(): Record<string, string[]> {
  return Object.fromEntries(loadCategories().map((x) => [x.name, x.subcategories]));
}
