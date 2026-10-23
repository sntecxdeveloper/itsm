// Common issues per subcategory, offered in the Item field of a new incident once a subcategory is chosen.
// The backend has no issue table yet; subcategories added in Setup fall back to the generic list.
const ISSUES: Record<string, string[]> = {
  // Software
  'Application Not Working': ['Application not opening', 'Application freezes', 'Application shows an error message', 'Application not responding'],
  'Application Installation': ['Installation fails', 'Installer not available', 'Admin rights required', 'Installation stuck'],
  'Application Crash': ['Crashes on startup', 'Crashes while working', 'Crashes when saving or exporting'],
  'Application Update': ['Update fails', 'Update stuck', 'Application broken after update', 'Rollback to previous version'],
  'License Issue': ['License expired', 'License not activated', 'No license seat available', 'Wrong license assigned'],
  'Software Configuration': ['Settings not saving', 'Profile or settings reset', 'Plugin or add-in not loading'],
  'Microsoft Office': ['MS Office not opening', 'MS Office activation or license error', 'Word not responding', 'Excel not responding', 'PowerPoint not responding', 'Office files not saving', 'Office repair or reinstall needed'],
  Outlook: ['Outlook not opening', 'Outlook not syncing', 'Outlook asks for password repeatedly', 'Outlook profile corrupted', 'Outlook search not working', 'Calendar not updating'],
  Teams: ['Teams not opening', 'Cannot sign in to Teams', 'No audio or video in meetings', 'Screen sharing not working', 'Teams notifications missing'],
  Browser: ['Browser not opening', 'Pages not loading', 'Browser slow or freezing', 'Certificate error', 'Extension or pop-up problem'],
  // Hardware
  'Laptop/Desktop': ['Not powering on', 'Overheating or loud fan', 'Screen flickering', 'Physical damage', 'Slow hardware performance'],
  Monitor: ['No display', 'Flickering screen', 'Wrong resolution', 'Dead pixels or lines'],
  Keyboard: ['Keys not working', 'Wireless keyboard not connecting', 'Keyboard replacement'],
  Mouse: ['Pointer not moving', 'Wireless mouse not connecting', 'Mouse replacement'],
  Printer: ['Printer not printing', 'Paper jam', 'Toner or ink empty', 'Printer not detected'],
  Scanner: ['Scanner not detected', 'Scan fails', 'Poor scan quality'],
  'Hard Disk': ['Disk full', 'Disk failure warning', 'Clicking noise', 'Data not accessible'],
  RAM: ['Memory upgrade needed', 'Memory errors or crashes', 'Not enough memory'],
  'Power/Battery': ['Battery not charging', 'Battery drains fast', 'Charger not working', 'Unexpected shutdowns'],
  // Network
  'Internet Connectivity': ['No internet access', 'Intermittent connection', 'Specific websites not reachable'],
  'Wi-Fi': ['Cannot connect to Wi-Fi', 'Wi-Fi keeps disconnecting', 'Wi-Fi password not accepted', 'Weak Wi-Fi signal'],
  LAN: ['Network cable not detected', 'Network port not working', 'Limited connectivity'],
  VPN: ['VPN not connecting', 'VPN disconnects frequently', 'VPN authentication fails', 'VPN client not installed'],
  DNS: ['Name resolution fails', 'Wrong address returned', 'Internal sites not resolving'],
  DHCP: ['No IP address assigned', 'IP address conflict', 'Wrong IP range'],
  'Network Slow': ['Slow internet', 'Slow file transfers', 'Slow access to internal apps'],
  Proxy: ['Proxy blocking a site', 'Proxy authentication prompt', 'Proxy settings incorrect'],
  // Email
  Mailbox: ['Mailbox full', 'Mailbox not loading', 'Mailbox size increase request', 'Deleted mail recovery'],
  'Shared Mailbox': ['Cannot open shared mailbox', 'Cannot send as shared mailbox', 'Shared mailbox access request'],
  'Email Not Sending': ['Mail stuck in outbox', 'Bounce-back message received', 'Attachment too large'],
  'Email Not Receiving': ['Not receiving external mail', 'Not receiving internal mail', 'Mail delayed'],
  'Spam/Junk Mail': ['Too much spam', 'Valid mail going to junk', 'Block a sender'],
  'Email Configuration': ['Set up mail on a phone', 'Set up mail on a new computer', 'Signature or auto-reply setup', 'Mail rules problem'],
  // Security
  Antivirus: ['Antivirus not updating', 'Antivirus disabled', 'Antivirus blocking an application', 'Scan taking too long'],
  Malware: ['Virus or malware detected', 'Suspicious pop-ups', 'Files encrypted or missing', 'Computer behaving strangely'],
  Password: ['Forgot password', 'Password expired', 'Password reset not working', 'Password policy question'],
  'Account Lockout': ['Account locked out', 'Repeated lockouts', 'Locked out after password change'],
  MFA: ['MFA code not received', 'New phone for MFA', 'MFA app not working', 'MFA reset request'],
  Phishing: ['Suspicious email received', 'Clicked a suspicious link', 'Shared credentials by mistake'],
  'Security Policy': ['Policy exception request', 'Blocked by security policy', 'USB or device restriction'],
  // Access Management
  'User Account': ['New account request', 'Account disabled', 'Account details need changing', 'Account deletion request'],
  'Application Access': ['Access to application denied', 'Application access request', 'Role or permission change'],
  'Folder Access': ['Cannot open folder', 'Folder access request', 'Folder permission change'],
  'Shared Drive': ['Shared drive not mapped', 'Cannot save to shared drive', 'Shared drive access request'],
  'VPN Access': ['VPN access request', 'VPN access removed', 'VPN profile missing'],
  'Admin Access': ['Admin rights request', 'Temporary admin access', 'Admin rights removal'],
  // Operating System
  Windows: ['Windows not starting', 'Windows settings not opening', 'Windows license or activation error', 'Windows reinstall request'],
  'Windows Update': ['Update fails to install', 'Update stuck', 'Restart loop after update', 'Update paused or blocked'],
  'Login Issue': ['Cannot log in to Windows', 'Profile not loading', 'Domain trust error', 'Black screen after login'],
  'Blue Screen': ['Blue screen on startup', 'Random blue screens', 'Blue screen with error code'],
  'System Slow': ['Slow startup', 'Slow while working', 'Computer freezes'],
  'System Crash': ['Unexpected restarts', 'Computer hangs', 'Crash with no error'],
  'Driver Issue': ['Driver missing', 'Driver update fails', 'Device not recognized', 'Driver causing crashes'],
  // Printer
  'Printer Offline': ['Printer shows offline', 'Printer not found on the network', 'Printer goes offline after a while'],
  'Print Queue': ['Print job stuck', 'Cannot clear the queue', 'Jobs print twice'],
  Driver: ['Printer driver missing', 'Driver installation fails', 'Wrong driver installed'],
  'Network Printer': ['Cannot add network printer', 'Network printer not printing', 'Printer address changed'],
  'Printing Quality': ['Faded or blurred print', 'Lines or smudges', 'Wrong colours'],
  'Printer Installation': ['Install a new printer', 'Install a printer on a new computer', 'Printer needs moving'],
  // Performance
  'High CPU': ['CPU at 100%', 'Fan running constantly', 'Unknown process using CPU'],
  'High Memory': ['Memory at 100%', 'Out of memory error', 'Memory leak in an application'],
  'High Disk Usage': ['Disk at 100%', 'Disk activity never stops', 'Low disk space'],
  'Application Slow': ['Application slow to open', 'Application slow while working', 'Application lag'],
  'Boot Slow': ['Slow startup', 'Too many startup programs', 'Long time at login screen'],
  // IT Services
  'Service Request': ['New request', 'Request status enquiry', 'Request not fulfilled'],
  Incident: ['Report an incident', 'Incident status enquiry', 'Reopen a closed incident'],
  'Change Request': ['Request a change', 'Change approval enquiry', 'Change rollback'],
  Problem: ['Repeated issue', 'Root cause analysis request'],
  'New User Setup': ['New computer setup', 'New account and mailbox', 'New user access request'],
  'Employee Onboarding': ['Accounts for a new joiner', 'Equipment for a new joiner', 'Access for a new joiner'],
  'Employee Offboarding': ['Disable accounts for a leaver', 'Recover equipment from a leaver', 'Remove access for a leaver'],
};

const GENERIC = ['Not working', 'Error message shown', 'Slow or unresponsive', 'Access problem', 'Setup or configuration help', 'Other'];

// Setup → Category & Subcategory edits a copy of these lists, kept in this browser (the backend has no table for them).
const KEY = 'dex.setup.issues';

function loadOverrides(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Issues to offer for a subcategory: the list edited in Setup, else the built-in one, else a generic one. */
export function getIssues(subcategory: string): string[] {
  if (!subcategory) return [];
  return loadOverrides()[subcategory] ?? ISSUES[subcategory] ?? GENERIC;
}

/** Saves the edited list for a subcategory. Returns false when the browser refused the write. */
export function saveIssues(subcategory: string, issues: string[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadOverrides(), [subcategory]: issues }));
    return true;
  } catch {
    return false;
  }
}

/** Drops the edits for a subcategory so the built-in list is used again. */
export function resetIssues(subcategory: string) {
  try {
    const next = loadOverrides();
    delete next[subcategory];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* nothing stored to remove */
  }
}
