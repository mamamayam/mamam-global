import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

// Ini adalah alat ajaib Anda. Anda buat sekali, bisa dipakai di mana saja.
export const useBackButton = (handlerCallback, dependencies) => {
  useEffect(() => {
    let backListenerHandle = null;

    const setupListener = async () => {
      backListenerHandle = await CapacitorApp.addListener('backButton', handlerCallback);
    };

    setupListener();

    // Otomatis mengurus cleanup untuk Anda!
    return () => {
      if (backListenerHandle) {
        backListenerHandle.remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};