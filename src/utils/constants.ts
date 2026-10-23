export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  OFFLINE: 'bg-amber-100 text-amber-800 border border-amber-200',
  ERROR: 'bg-red-100 text-red-800 border border-red-200',
  ENROLLING: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-amber-500',
  ERROR: 'bg-red-500',
  ENROLLING: 'bg-blue-500',
};

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export const SEVERITY_DOT_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
};

export const ISSUE_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800 border border-red-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const REMEDIATION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
  RUNNING: 'bg-blue-100 text-blue-800 border border-blue-200',
  SUCCESS: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  FAILED: 'bg-red-100 text-red-800 border border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const ROLE_COLORS: Record<string, string> = {
  ROLE_ADMIN: 'bg-purple-100 text-purple-800 border border-purple-200',
  ROLE_OPERATOR: 'bg-blue-100 text-blue-800 border border-blue-200',
  ROLE_VIEWER: 'bg-gray-100 text-gray-600 border border-gray-200',
  ROLE_ITSM_TECHNICIAN: 'bg-teal-100 text-teal-800 border border-teal-200',
};

export const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_OPERATOR: 'Operator',
  ROLE_VIEWER: 'Viewer',
  ROLE_ITSM_TECHNICIAN: 'ITSM Technician',
};

// Which roles can see each nav item
export const NAV_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/devices': ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  '/groups': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/agent-customization': ['ROLE_ADMIN'],
  '/issues': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/deleted': ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  '/remediation': ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  '/remediation/execute': ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  '/knowledge': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/ai-chat': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/ai-tasks': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
  '/tickets': ['ROLE_ADMIN', 'ROLE_ITSM_TECHNICIAN'],
  '/assets': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_ITSM_TECHNICIAN'],
  '/reports': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER'],
  '/alerts': ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  '/audit-logs': ['ROLE_ADMIN'],
  '/security': ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_VIEWER', 'ROLE_ITSM_TECHNICIAN'],
};

// Which roles can perform which actions
export const ACTION_PERMISSIONS = {
  UPDATE_ISSUE_STATUS: ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_ITSM_TECHNICIAN'],
  ASSIGN_ISSUE: ['ROLE_ADMIN'],
  DELETE_DEVICE: ['ROLE_ADMIN'],
  DELETE_ISSUE: ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  CREATE_REMEDIATION: ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  MANAGE_USERS: ['ROLE_ADMIN'],
  MANAGE_GROUPS: ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  VIEW_AUDIT_LOGS: ['ROLE_ADMIN'],
  APPROVE_KB_ARTICLE: ['ROLE_ADMIN', 'ROLE_OPERATOR'],
  MANAGE_KB_CONTENT: ['ROLE_ADMIN', 'ROLE_OPERATOR', 'ROLE_ITSM_TECHNICIAN'],
};

export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
};

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/devices', label: 'Devices', icon: 'devices' },
  { path: '/groups', label: 'Groups', icon: 'groups' },
  { path: '/agent-customization', label: 'Agent Customization', icon: 'customize' },
  { path: '/issues', label: 'Issues', icon: 'issues' },
  { path: '/deleted', label: 'Deleted Items', icon: 'deleted' },
  { path: '/remediation', label: 'Remediation History', icon: 'remediation' },
  { path: '/remediation/execute', label: 'Execute Remediation', icon: 'execute' },
  { path: '/knowledge', label: 'Knowledge Base', icon: 'knowledge' },
  { path: '/ai-chat', label: 'AI Chat', icon: 'aichat' },
  { path: '/ai-tasks', label: 'AI Tasks', icon: 'aitasks' },
  { path: '/tickets', label: 'ITSM', icon: 'tickets' },
  { path: '/assets', label: 'Assets', icon: 'assets' },
  { path: '/reports', label: 'Reports', icon: 'reports' },
  { path: '/alerts', label: 'Alert Rules', icon: 'alerts' },
  { path: '/audit-logs', label: 'Audit Logs', icon: 'audit' },
  { path: '/security', label: 'Security', icon: 'security' },
];

export const ADMIN_NAV_ITEMS = [
  { path: '/admin/users', label: 'User Management', icon: 'users' },
  { path: '/organizations', label: 'Organizations', icon: 'organizations' },
  { path: '/console-customization', label: 'Console Customization', icon: 'customize' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];
