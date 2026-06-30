/**
 * useBluetoothPermission.js
 *
 * Kenapa dibikin hook:
 *   - Setelah APK update di Android 12+, BLUETOOTH_CONNECT/SCAN bisa perlu re-grant
 *     (terutama kalau targetSdkVersion naik ke 31+).
 *   - Hook ini proactively check status on mount + re-check setiap kali app balik
 *     ke foreground (user habis dari Android Settings, misalnya).
 *   - Kalau pre-Android 12, permission tidak diperlukan → auto 'not_required'.
 *
 * Status lifecycle:
 *   'checking'      → lagi cek (initial state)
 *   'not_required'  → Android < 12, gak perlu runtime permission
 *   'granted'       → izin diberikan
 *   'denied'        → izin ditolak, perlu user action
 *   'unknown'       → plugin gak ada / gak bisa dicek (treated as granted)
 */

import { useState, useEffect, useCallback } from 'react';

const ANDROID_12_THRESHOLD = 12;

const BT_PERMISSIONS = [
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
];

// Hitung versi Android sekali aja (immutable)
const _androidVersion = (() => {
  const m = navigator.userAgent.match(/Android\s([0-9.]+)/);
  return m ? parseFloat(m[1]) : null;
})();

const _isAndroid12Plus = _androidVersion !== null && _androidVersion >= ANDROID_12_THRESHOLD;

export const useBluetoothPermission = () => {
  const [btStatus, setBtStatus] = useState('checking');

  const checkBtPermission = useCallback(() => {
    if (!_isAndroid12Plus) {
      setBtStatus('not_required');
      return;
    }
    if (!window.cordova?.plugins?.permissions) {
      // Plugin gak ada — asumsikan granted, jangan block user
      setBtStatus('unknown');
      return;
    }
    window.cordova.plugins.permissions.checkPermission(
      BT_PERMISSIONS[0], // BLUETOOTH_CONNECT sebagai gatekeeper
      (res) => setBtStatus(res.hasPermission ? 'granted' : 'denied'),
      ()    => setBtStatus('unknown')
    );
  }, []);

  // Check on mount + re-check setiap kali app kembali ke foreground
  useEffect(() => {
    checkBtPermission();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkBtPermission();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [checkBtPermission]);

  /**
   * Request permission. Kalau pre-Android 12 atau plugin gak ada,
   * langsung panggil onGranted.
   */
  const requestBtPermission = useCallback((onGranted, onDenied) => {
    if (!_isAndroid12Plus || !window.cordova?.plugins?.permissions) {
      onGranted?.();
      return;
    }
    window.cordova.plugins.permissions.requestPermissions(
      BT_PERMISSIONS,
      (res) => {
        const ok = res.hasPermission;
        setBtStatus(ok ? 'granted' : 'denied');
        ok ? onGranted?.() : onDenied?.();
      },
      () => {
        setBtStatus('unknown');
        onDenied?.();
      }
    );
  }, []);

  return { btStatus, checkBtPermission, requestBtPermission };
};