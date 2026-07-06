import { useEffect, useRef, useState } from 'react';

/**
 * Pantau status koneksi browser (navigator.onLine + event online/offline).
 *
 * Tidak cuma balikin status saat ini — juga kasih tau App.jsx PERSIS momen
 * transisi terjadi (`justWentOnline` / `justWentOffline`), jadi App.jsx bisa
 * munculin toast & trigger re-sync HANYA pas transisi, bukan tiap render.
 *
 * @returns {{ isOnline: boolean, justWentOnline: boolean, justWentOffline: boolean }}
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [transition, setTransition] = useState(null); // 'online' | 'offline' | null

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setTransition('online');
    }
    function handleOffline() {
      setIsOnline(false);
      setTransition('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    justWentOnline: transition === 'online',
    justWentOffline: transition === 'offline',
    // dipanggil App.jsx setelah transisi di-handle (toast ditampilkan, sync
    // dipicu) supaya gak ke-trigger ulang terus-terusan tiap re-render.
    clearTransition: () => setTransition(null),
  };
}
