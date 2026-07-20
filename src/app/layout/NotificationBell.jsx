import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Bell, BellOff } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { getSupabaseClient, getDeviceId, isSupabaseConfigured, withTimeout } from '../../storage/syncClient';

/**
 * NotificationBell — icon lonceng di Header, nampilin riwayat notifikasi
 * transaksi dalam bentuk kartu (panel drop-down dari atas).
 *
 * SUMBER DATA: tabel `notification_log` di Supabase — SAMA PERSIS dengan
 * yang dipakai edge function send-push buat kirim FCM (lihat
 * supabase/functions/send-push/index.ts, insert ke notification_log
 * dilakukan di request yang sama, sebelum kirim FCM). Jadi bell ini dan
 * push notif system tray Android sekarang berasal dari 1 event yang sama.
 *
 * SEBELUMNYA bell ini turunan dari state lokal `salesHistory` + hitung
 * unread pakai `lastSeenAt` per-device di localStorage. Itu bikin badge
 * gampang gak sinkron antar device (transaksi baru bisa nyampe lewat
 * realtime dan muncul di HistoryView, tapi bell gak ikut nyala) karena
 * "belum dibaca"-nya dihitung dari state yang beda-beda tiap device.
 * Sekarang read-state (`read_by`) juga disimpan di baris yang sama di
 * Supabase, jadi semua device baca dari 1 sumber kebenaran yang sama —
 * bell nyala/nggak-nya konsisten di semua device begitu ada koneksi.
 *
 * Kalau Supabase belum dikonfigurasi (dev lokal tanpa .env), komponen ini
 * fallback jadi no-op senyap — bell tetap tampil tapi selalu kosong,
 * gak nge-block render Header sama sekali.
 */

const MAX_ITEMS = 30;
const PULL_TIMEOUT_MS = 10000;

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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]); // { id, title, body, created_at, read_by }
  const deviceId = useRef(null);
  const channelRef = useRef(null);

  const isUnread = useCallback((n) => !Array.isArray(n.read_by) || !n.read_by.includes(deviceId.current), []);

  const unreadCount = useMemo(
    () => notifications.filter(isUnread).length,
    [notifications, isUnread]
  );

  // ── Pull awal + subscribe realtime ke notification_log ──────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    deviceId.current = getDeviceId();
    let cancelled = false;

    (async () => {
      try {
        const supabase = await getSupabaseClient();
        if (!supabase || cancelled) return;

        const { data, error } = await withTimeout(
          supabase
            .from('notification_log')
            .select('id, table_name, record_id, title, body, created_at, read_by')
            .order('created_at', { ascending: false })
            .limit(MAX_ITEMS),
          PULL_TIMEOUT_MS, 'pull notification_log'
        );
        if (error) {
          console.warn('[bell] gagal pull notification_log:', error.message);
        } else if (!cancelled) {
          setNotifications(data || []);
        }

        if (cancelled) return;

        // Realtime: notif baru dari device manapun (termasuk device ini
        // sendiri, biar tetap konsisten kalau ada 2 tab/instance app kebuka).
        const channel = supabase
          .channel(`mamam-notification-bell-${Math.random().toString(36).slice(2)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_log' }, (payload) => {
            setNotifications((prev) => {
              const next = [payload.new, ...prev.filter((n) => n.id !== payload.new.id)];
              return next.slice(0, MAX_ITEMS);
            });
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notification_log' }, (payload) => {
            // Update read_by dari device lain (misal HP kasir sama-sama
            // buka bell) — biar badge unread konsisten di semua device.
            setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? payload.new : n)));
          })
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.warn('[bell] setup gagal:', err.message);
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        getSupabaseClient().then((supabase) => supabase?.removeChannel(channelRef.current));
        channelRef.current = null;
      }
    };
  }, []);

  // ── Tandai semua notif yang lagi keliatan sebagai "sudah dibaca" ────────
  const handleOpen = async () => {
    setIsOpen(true);
    if (unreadCount === 0 || !deviceId.current) return;

    const idsToMark = notifications.filter(isUnread).map((n) => n.id);
    if (idsToMark.length === 0) return;

    // Optimistic update lokal dulu biar badge langsung ilang di UI.
    setNotifications((prev) =>
      prev.map((n) =>
        idsToMark.includes(n.id)
          ? { ...n, read_by: [...(Array.isArray(n.read_by) ? n.read_by : []), deviceId.current] }
          : n
      )
    );

    try {
      const supabase = await getSupabaseClient();
      if (!supabase) return;
      // Per-row update (bukan bulk) karena tiap row bisa punya read_by
      // awal yang beda-beda — pakai array_append biar aman dari race
      // kalau device lain nge-update read_by row yang sama nyaris bersamaan.
      for (const id of idsToMark) {
        await supabase.rpc('mark_notification_read', { notif_id: id, device: deviceId.current });
      }
    } catch (err) {
      console.warn('[bell] gagal tandai notif terbaca:', err.message);
      // Non-fatal — badge lokal udah kehapus, worst case device lain
      // masih lihat ini sebagai unread, gak ada data yang hilang.
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
                      {formatRelativeTime(n.created_at)}
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