import { useState, useEffect, useRef } from 'react';
import { loadData, saveData } from '../storage/db';

/**
 * Seperti useState biasa, tapi otomatis load dari Dexie (IndexedDB) saat mount
 * dan save ke Dexie setiap kali nilai berubah.
 *
 * Karena Dexie async, state dimulai dengan `defaultValue` dulu,
 * lalu diupdate setelah data selesai dibaca dari DB.
 *
 * @param {string} key - Key storage
 * @param {*} defaultValue - Nilai sementara sebelum data dari DB dimuat
 * @returns {[*, Function, boolean]} - [state, setState, isLoading]
 */
export function usePersistState(key, defaultValue) {
  const [state, setState]     = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad           = useRef(true);
  const isMounted             = useRef(true);

  // Load dari DB saat pertama mount
  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);

    loadData(key, defaultValue).then(data => {
      if (isMounted.current) {
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
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (!isLoading) {
      saveData(key, state);
    }
  }, [key, state, isLoading]);

  return [state, setState, isLoading];
}