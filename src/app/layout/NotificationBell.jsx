import { useState, useMemo } from 'react';
import { Bell, BellOff } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

/**
 * NotificationBell — icon lonceng di Header, nampilin riwayat transaksi
 * dalam bentuk kartu notifikasi (panel drop-down dari atas).
 *
 * PENTING: sumber datanya adalah `salesHistory` ASLI (state lokal, sama
 * yang dipake HistoryView/ReportsView) — BUKAN dari push notification
 * (FCM). Jadi bell ini tetap keisi & bisa diandalkan walaupun push
 * notification lagi bermasalah/belum kekirim — dua hal ini sengaja
 * dipisah. FCM (lihat storage/pushNotifications.js) tetap kepake buat
 * alert di system tray Android pas app di-background/ditutup; bell ini
 * cuma buat "riwayat aktivitas" pas app kebuka.
 *
 * Baru nyakup sales dulu. Nanti expenses/incomes/absensi tinggal nambah
 * builder serupa di dalam useMemo di bawah terus digabung+sort bareng
 * sales — lihat komen "TODO: sumber lain" di bawah.
 */

const MAX_ITEMS = 30;
const LAST_SEEN_KEY = 'mamam_notif_last_seen';

function formatRelativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatSaleNotification(sale) {
  const total = Number(sale.total || 0).toLocaleString('id-ID');
  const method = sale.paymentMethod || 'Tunai';
  return {
    id: sale.id,
    kind: 'sale',
    title: '🛒 Transaksi Baru',
    body: `Rp${total} • ${method}${sale.orderType ? ' • ' + sale.orderType : ''}`,
    date: sale.date,
  };
}

export default function NotificationBell({ salesHistory = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  // Kapan terakhir kali bell dibuka (persisted, buat itung unread di
  // antara sesi/reload). Kalau belum pernah ada (pemakaian pertama fitur
  // ini), diset ke "sekarang" biar riwayat lama yang udah ada gak
  // langsung nongol semua sebagai "belum dibaca".
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) return new Date(stored);
    const now = new Date();
    localStorage.setItem(LAST_SEEN_KEY, now.toISOString());
    return now;
  });

  // salesHistory selalu unshift item baru ke depan (lihat PaymentModal.jsx:
  // `setSalesHistory([newOrder, ...salesHistory])`), jadi udah terurut
  // terbaru dulu — tinggal slice, gak perlu sort ulang.
  const notifications = useMemo(() => {
    const items = salesHistory.slice(0, MAX_ITEMS).map(formatSaleNotification);

    // TODO: sumber lain (expenses, incomes, absensi) — bikin builder
    // serupa (formatExpenseNotification, dst), gabung ke `items`, terus
    // sort bareng by `date` desc sebelum di-slice MAX_ITEMS.

    return items;
  }, [salesHistory]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => new Date(n.date) > lastSeenAt).length,
    [notifications, lastSeenAt]
  );

  const handleOpen = () => {
    setIsOpen(true);
    if (unreadCount > 0) {
      const now = new Date();
      localStorage.setItem(LAST_SEEN_KEY, now.toISOString());
      setLastSeenAt(now);
    }
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
        side="top"
      >
        <div className="px-5 pb-5 pt-1">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellOff className="w-8 h-8" />}
              title="Belum ada notifikasi"
              description="Transaksi baru bakal muncul di sini."
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
                      {formatRelativeTime(n.date)}
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
