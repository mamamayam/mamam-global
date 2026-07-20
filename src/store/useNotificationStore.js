import { create } from 'zustand';

// Store notifikasi in-app buat bell icon di Header.
// SENGAJA gak di-persist ke localStorage — ini cuma buat "double confirm"
// visual pas app lagi kebuka, bukan riwayat notif jangka panjang. Direset
// tiap app di-reload/restart, sama seperti UI state lain di usePosStore.
//
// Diisi dari src/storage/pushNotifications.js lewat listener
// 'pushNotificationReceived' — jadi notif yang nongol di sini ATO SAMA
// PERSIS dengan yang datang dari FCM lewat send-push Edge Function,
// gak ada mekanisme terpisah. Kalau bell gak nampilin apa-apa pas ada
// transaksi baru, itu bukti pipeline push-nya sendiri yang gak nyampe
// ke device — bukan masalah di UI bell ini.

const MAX_NOTIFICATIONS = 30; // cukup buat sesi berjalan, gak perlu tak terbatas

export const useNotificationStore = create((set) => ({
  notifications: [], // { id, title, body, receivedAt, read }
  unreadCount: 0,

  addNotification: (notification) => set((state) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: notification.title || 'Notifikasi',
      body: notification.body || '',
      receivedAt: new Date().toISOString(),
      read: false,
    };
    return {
      notifications: [entry, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
      unreadCount: state.unreadCount + 1,
    };
  }),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));