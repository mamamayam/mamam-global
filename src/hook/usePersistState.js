import { useState, useEffect, useRef, useCallback } from 'react';
import { loadData, saveData } from '../storage/db';
import { diffArrays, pushTransactionUpsert, pushTransactionDelete, pushConfig, pushLiveState } from '../storage/realtimeSync';

/**
 * Seperti useState biasa, tapi otomatis load dari Dexie (IndexedDB) saat mount
 * dan save ke Dexie setiap kali nilai berubah.
 *
 * Karena Dexie async, state dimulai dengan `defaultValue` dulu,
 * lalu diupdate setelah data selesai dibaca dari DB.
 *
 * Opsional: sinkronisasi realtime ke Supabase via `syncMode`:
 *  - 'transaction' : `state` harus berupa array of {id, ...}. Saat berubah,
 *                     HANYA record yang baru/berubah/terhapus yang di-push
 *                     (per-record upsert/delete) — bukan re-upload semua array.
 *                     `tableKey` (default = `key`) menentukan nama tabel Supabase.
 *  - 'config'      : seluruh `state` di-push sebagai 1 blob ke tabel app_config
 *                     (didebounce), cocok untuk data kecil yang jarang berubah.
 *  - 'live'        : seperti 'config' (1 blob ke tabel app_config), TAPI push
 *                     INSTAN tanpa debounce sama sekali. Khusus key yang masuk
 *                     LIVE_STATE_KEYS di syncKeys.js (misal currentShift) — yang
 *                     wajib langsung kelihatan di device lain begitu berubah,
 *                     karena transaksi di bawahnya nunggu status ini.
 *  - undefined     : tidak ada sync ke Supabase (hanya simpan lokal ke Dexie).
 *
 * FIX:
 *  - Terima `syncReadyPromise` dari App.jsx (hasil initRealtimeSync) supaya
 *    push tidak bisa jalan sebelum initial pull selesai.
 *  - Save ke DB dan push ke Supabase HANYA setelah isLoading false (tidak lagi
 *    skip pakai isFirstLoad ref yang bisa race).
 *  - prevStateRef diupdate SETELAH setState selesai (via useEffect terpisah)
 *    sehingga diffArrays selalu dapat nilai yang benar.
 *
 * @param {string} key - Key storage
 * @param {*} defaultValue - Nilai sementara sebelum data dari DB dimuat
 * @param {{ syncMode?: 'transaction'|'config'|'live', tableKey?: string, syncReadyPromise?: Promise<void> }} [options]
 * @returns {[*, Function, boolean]} - [state, setState, isLoading]
 */
export function usePersistState(key, defaultValue, options = {}) {
  const { syncMode, tableKey = key, syncReadyPromise, pushDelay } = options;

  const [state, setStateInternal] = useState(defaultValue);
  const [isLoading, setIsLoading]  = useState(true);

  // FIX BUG 3 & 4: Gunakan ref terpisah untuk:
  //  - isLoadedRef: apakah load pertama sudah selesai (ganti isFirstLoad)
  //  - prevStateRef: nilai state sebelumnya untuk diffArrays
  //  - isRemoteUpdateRef: apakah setState dipicu oleh update dari device lain
  //    (kalau iya, JANGAN push balik ke Supabase → infinite loop)
  const isLoadedRef      = useRef(false);
  const isMounted        = useRef(true);
  const prevStateRef     = useRef(defaultValue);
  const isRemoteUpdate   = useRef(false);

  // FIX ANTI OVERWRITE: Ref pelindung agar data lokal lama tidak langsung di-push saat pertama dibuka
  const isFirstEffectPassAfterLoad = useRef(true);

  // Load dari DB saat pertama mount
  useEffect(() => {
    isMounted.current  = true;
    isLoadedRef.current = false;
    isFirstEffectPassAfterLoad.current = true; // Reset flag setiap kali key di-load balik
    setIsLoading(true);

    loadData(key, defaultValue).then(data => {
      if (isMounted.current) {
        prevStateRef.current = data;   // set prevState SEBELUM setState
        setStateInternal(data);
        setIsLoading(false);
        isLoadedRef.current = true;
      }
    });

    return () => {
      isMounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Save ke DB + push ke Supabase setiap kali state berubah,
  // TAPI hanya setelah initial load benar-benar selesai.
  useEffect(() => {
    // FIX BUG 3: Jangan save/push kalau masih loading atau belum pernah load
    if (isLoading || !isLoadedRef.current) return;

    // FIX UTAMA ANTI OVERWRITE: 
    // Jika effect berjalan pertama kali tepat setelah loading lokal selesai, LEWATI proses push.
    // Kita hanya mau nge-push kalau ada aksi nyata dari user setelah aplikasi terbuka.
    if (isFirstEffectPassAfterLoad.current) {
      isFirstEffectPassAfterLoad.current = false;
      prevStateRef.current = state;
      return;
    }

    // Simpan ke Dexie
    saveData(key, state);

    // Kalau update datang dari device lain (via onTransactionUpsert/onConfigUpdate),
    // jangan push balik ke Supabase — sudah ada di sana, dan ini akan bikin loop
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      prevStateRef.current   = state;
      return;
    }

    if (syncMode === 'transaction') {
      // FIX BUG 4: prevStateRef sudah diupdate di load effect,
      // dan akan kita update lagi di sini setelah diff
      const { upserts, deletes } = diffArrays(prevStateRef.current, state);
      for (const item of upserts) pushTransactionUpsert(tableKey, item, syncReadyPromise);
      for (const id of deletes)   pushTransactionDelete(tableKey, id,   syncReadyPromise);
    } else if (syncMode === 'config') {
      // pushDelay bisa di-set ke 0 untuk key kritis (misal currentShift)
      // supaya push langsung tanpa debounce 1500ms default
      pushConfig(key, state, syncReadyPromise, pushDelay ?? 1500);
    } else if (syncMode === 'live') {
      // Live state (currentShift, dkk) — push INSTAN, gak lewat setTimeout
      // sama sekali (beda dari 'config' + pushDelay:0 yang tetap nunggu satu
      // tick event loop). Lihat LIVE_STATE_KEYS di storage/syncKeys.js.
      pushLiveState(key, state, syncReadyPromise);
    }

    prevStateRef.current = state;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isLoading]);

  /**
   * setState yang menandai apakah update berasal dari device lain.
   * App.jsx harus pakai `setStateRemote` (via setter yang dikembalikan dari
   * onTransactionUpsert/onConfigUpdate) supaya push tidak terjadi dua kali.
   *
   * Cara pakai di App.jsx (onTransactionUpsert callback):
   *   setter(prev => ...) → ini adalah setState biasa, TIDAK push balik
   *   Tapi karena kita tidak bisa tau dari luar, kita expose `setRemote`.
   */
  const setState = useCallback((valueOrUpdater) => {
    setStateInternal(valueOrUpdater);
  }, []);

  /**
   * Versi setState untuk update yang datang dari Supabase realtime /
   * initial pull — TIDAK akan di-push balik ke Supabase.
   */
  const setStateRemote = useCallback((valueOrUpdater) => {
    isRemoteUpdate.current = true;
    setStateInternal(valueOrUpdater);
  }, []);

  return [state, setState, isLoading, setStateRemote];
}