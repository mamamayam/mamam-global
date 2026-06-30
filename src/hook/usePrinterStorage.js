/**
 * usePrinterStorage.js
 *
 * Kenapa bukan localStorage:
 *   - WebView localStorage bisa kena wipe saat APK update (signing key berubah,
 *     WebView provider update, dll).
 *   - @capacitor/preferences pakai native SharedPreferences di Android → survive
 *     APK update selama app tidak uninstall.
 *   - Di web/dev, Capacitor otomatis fallback ke localStorage — jadi gak perlu
 *     manual handling.
 *
 * Migration:
 *   - One-time auto-migrate dari key localStorage lama ('my_printer_mac' /
 *     'my_printer_name') ke Preferences baru. Setelah migrated, key lama dihapus.
 */

import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';

const KEY_MAC  = 'printer_mac';
const KEY_NAME = 'printer_name';

// Key lama (localStorage) — hanya untuk migrasi
const LS_MAC_LEGACY  = 'my_printer_mac';
const LS_NAME_LEGACY = 'my_printer_name';

export const usePrinterStorage = () => {
  const [savedPrinter,        setSavedPrinter]        = useState(null);
  const [isLoadingPrinter,    setIsLoadingPrinter]    = useState(true);

  useEffect(() => {
    const load = async () => {
      let { value: mac  } = await Preferences.get({ key: KEY_MAC  });
      let { value: name } = await Preferences.get({ key: KEY_NAME });

      // 🔄 One-time migration dari localStorage lama
      if (!mac) {
        const oldMac  = localStorage.getItem(LS_MAC_LEGACY);
        const oldName = localStorage.getItem(LS_NAME_LEGACY);
        if (oldMac && oldName) {
          await Preferences.set({ key: KEY_MAC,  value: oldMac  });
          await Preferences.set({ key: KEY_NAME, value: oldName });
          localStorage.removeItem(LS_MAC_LEGACY);
          localStorage.removeItem(LS_NAME_LEGACY);
          mac  = oldMac;
          name = oldName;
          console.log('[usePrinterStorage] Migrated printer from localStorage → Preferences');
        }
      }

      if (mac && name) setSavedPrinter({ name, address: mac });
      setIsLoadingPrinter(false);
    };
    load();
  }, []);

  const savePrinter = useCallback(async (device) => {
    await Preferences.set({ key: KEY_MAC,  value: device.address });
    await Preferences.set({ key: KEY_NAME, value: device.name    });
    setSavedPrinter(device);
  }, []);

  const clearPrinter = useCallback(async () => {
    await Preferences.remove({ key: KEY_MAC  });
    await Preferences.remove({ key: KEY_NAME });
    setSavedPrinter(null);
  }, []);

  return { savedPrinter, savePrinter, clearPrinter, isLoadingPrinter };
};