import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

/**
 * NotificationBell — icon lonceng di Header, buat "double confirm" visual
 * bahwa push notification beneran nyampe ke device.
 *
 * Notifnya diisi langsung dari listener 'pushNotificationReceived' di
 * storage/pushNotifications.js (lihat useNotificationStore) — BUKAN dari
 * jalur terpisah. Jadi kalau bell gak nunjukkin apa-apa pas ada transaksi
 * baru padahal Edge Function udah "sent: 1" di log, itu tandanya notif
 * gak nyampe ke client (device foreground listener) — bukan bug di bell-nya.
 *
 * Catatan: 'pushNotificationReceived' cuma fire pas app foreground. Notif
 * yang masuk pas app di-background gak akan nambah ke list ini (itu udah
 * ditangani Android system tray langsung, di luar kontrol JS).
 */
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return new Date(isoString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  const handleOpen = () => {
    setIsOpen(true);
    // Tandai dibaca begitu panel dibuka, bukan per-item — cukup buat
    // kebutuhan "double confirm", gak perlu granular per notif.
    if (unreadCount > 0) markAllRead();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Notifikasi'}
        className="relative p-2.5 hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-95 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-300"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent-500 text-white text-[9px] font-bold leading-none shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifikasi"
        side="right"
        size="md"
      >
        <div className="px-5 pb-5 pt-1">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellOff className="w-8 h-8" />}
              title="Belum ada notifikasi"
              description="Notifikasi transaksi & pengeluaran baru bakal muncul di sini selama app kebuka."
              size="sm"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-50">{n.title}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                      {formatRelativeTime(n.receivedAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.body}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}