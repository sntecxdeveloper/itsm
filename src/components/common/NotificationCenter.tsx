import { useState, useCallback } from 'react';
import { useDeviceStatusUpdates, useIssueUpdates } from '../../hooks/useWebSocket';

interface Notification {
  id: string;
  type: 'ALERT' | 'STATUS_CHANGE' | 'NOTIFICATION';
  title: string;
  message: string;
  severity: string;
  agentId?: string;
  timestamp: string;
  read: boolean;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50',
  HIGH: 'text-orange-600 bg-orange-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  LOW: 'text-blue-600 bg-blue-50',
  ONLINE: 'text-green-600 bg-green-50',
  OFFLINE: 'text-red-600 bg-red-50',
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Subscribe to device status changes
  const handleStatusChange = useCallback((data: unknown) => {
    const event = data as { type?: string; agentId?: string; hostname?: string; status?: string; timestamp?: string };
    if (event.type === 'STATUS_CHANGE') {
      setNotifications((prev) => [
        {
          id: `status-${event.agentId}-${Date.now()}`,
          type: 'STATUS_CHANGE',
          title: `Device ${event.status === 'ONLINE' ? 'Online' : 'Offline'}`,
          message: `${event.hostname} is now ${event.status}`,
          severity: event.status || 'UNKNOWN',
          agentId: event.agentId,
          timestamp: event.timestamp || new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 49),
      ]);
    }
  }, []);

  // Subscribe to alerts/issues
  const handleIssueUpdate = useCallback((data: unknown) => {
    const event = data as { type?: string; ruleName?: string; severity?: string; agentId?: string; hostname?: string; metric?: string; value?: number; timestamp?: string; title?: string; message?: string; issueCode?: string; category?: string };
    
    if (event.type === 'ISSUE_CREATED') {
      setNotifications((prev) => [
        {
          id: `issue-${event.issueCode || Date.now()}`,
          type: 'ALERT',
          title: event.title || 'New Issue',
          message: `${event.hostname || 'Unknown device'} — ${event.category || ''}`,
          severity: event.severity || 'MEDIUM',
          agentId: event.agentId,
          timestamp: event.timestamp || new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 49),
      ]);
    } else if (event.type === 'ALERT') {
      setNotifications((prev) => [
        {
          id: `alert-${Date.now()}`,
          type: 'ALERT',
          title: event.ruleName || 'Alert',
          message: `${event.metric} = ${event.value} (${event.severity})`,
          severity: event.severity || 'MEDIUM',
          agentId: event.agentId,
          timestamp: event.timestamp || new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 49),
      ]);
    }
  }, []);

  useDeviceStatusUpdates(handleStatusChange);
  useIssueUpdates(handleIssueUpdate);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-teal-600 hover:text-teal-700">
                    Mark all read
                  </button>
                )}
                <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      !notif.read ? 'bg-teal-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        !notif.read ? 'bg-teal-500' : 'bg-transparent'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{notif.title}</p>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[notif.severity] || 'bg-gray-100 text-gray-600'}`}>
                            {notif.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{notif.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatTime(notif.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
