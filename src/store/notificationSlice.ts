import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

const storedNotifications = localStorage.getItem('dex_notifications');
const initialNotifications: Notification[] = storedNotifications ? JSON.parse(storedNotifications) : [];

const initialState: NotificationState = {
  notifications: initialNotifications,
  unreadCount: initialNotifications.filter((n) => !n.read).length,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Omit<Notification, 'id' | 'read' | 'createdAt'>>) {
      const notification: Notification = {
        ...action.payload,
        id: Math.random().toString(36).substring(2, 9),
        read: false,
        createdAt: new Date().toISOString(),
      };
      state.notifications.unshift(notification);
      state.unreadCount++;
      localStorage.setItem('dex_notifications', JSON.stringify(state.notifications));
    },
    markAsRead(state, action: PayloadAction<string>) {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount--;
        localStorage.setItem('dex_notifications', JSON.stringify(state.notifications));
      }
    },
    markAllAsRead(state) {
      state.notifications.forEach((n) => (n.read = true));
      state.unreadCount = 0;
      localStorage.setItem('dex_notifications', JSON.stringify(state.notifications));
    },
    removeNotification(state, action: PayloadAction<string>) {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification && !notification.read) {
        state.unreadCount--;
      }
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
      localStorage.setItem('dex_notifications', JSON.stringify(state.notifications));
    },
    clearAll(state) {
      state.notifications = [];
      state.unreadCount = 0;
      localStorage.removeItem('dex_notifications');
    },
  },
});

export const { addNotification, markAsRead, markAllAsRead, removeNotification, clearAll } = notificationSlice.actions;
export default notificationSlice.reducer;
