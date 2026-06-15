import { useState, useEffect, useRef } from 'react';
import { loadData, saveData } from '../storage/db';
import { diffArrays, pushTransactionUpsert, pushTransactionDelete, pushConfig } from '../storage/realtimeSync';

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
 *  - undefined     : tidak ada sync ke Supabase (hanya simpan lokal ke Dexie).
 *
 * @param {string} key - Key storage
 * @param {*} defaultValue - Nilai sementara sebelum data dari DB dimuat
 * @param {{ syncMode?: 'transaction'|'config', tableKey?: string }} [options]
 * @returns {[*, Function, boolean]} - [state, setState, isLoading]
 */
export function usePersistState(key, defaultValue, options = {}) {
  const { syncMode, tableKey = key } = options;

  const [state, setState]     = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad           = useRef(true);
  const isMounted             = useRef(true);
  const prevStateRef          = useRef(state);

  // Load dari DB saat pertama mount
  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);

    loadData(key, defaultValue).then(data => {
      if (isMounted.current) {
        prevStateRef.current = data;
        setState(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Save ke DB setiap kali state berubah (skip saat pertama load)
  // + push perubahan ke Supabase sesuai syncMode.
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      prevStateRef.current = state;
      return;
    }
    if (!isLoading) {
      saveData(key, state);

      if (syncMode === 'transaction') {
        const { upserts, deletes } = diffArrays(prevStateRef.current, state);
        for (const item of upserts) pushTransactionUpsert(tableKey, item);
        for (const id of deletes) pushTransactionDelete(tableKey, id);
      } else if (syncMode === 'config') {
        pushConfig(key, state);
      }

      prevStateRef.current = state;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state, isLoading]);

  return [state, setState, isLoading];
}
