// src/storage/pushNotifications.js
//
// ═══════════════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS — registrasi device token ke FCM + simpan ke Supabase
// ═══════════════════════════════════════════════════════════════════════
// Mengikuti pola getSupabaseClient()/getDeviceId() di syncClient.js:
// - Cuma jalan di native Android (Capacitor), no-op di web/browser.
// - device_id yang dipakai SAMA dengan getDeviceId() dari syncClient.js
//   biar 1 device = 1 identity yang konsisten di semua tabel Supabase.
//
// CARA PAKAI: panggil registerPushNotifications() sekali, idealnya di
// App.jsx dalam useEffect() setelah user login/PIN masuk (lihat App.jsx
// integration guide).

import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from './syncClient';
import { getDeviceId } from './syncClient';
import { useNotificationStore } from '../store/useNotificationStore';

let _registered = false;

/**
 * Minta izin notifikasi & daftarkan device token FCM ke Supabase.
 * Aman dipanggil berkali-kali (idempotent — guard _registered).
 * No-op total di web (push notification cuma didukung di native Android/iOS).
 */
export async function registerPushNotifications() {
  if (_registered) return;
  if (!Capacitor.isNativePlatform()) {
    console.log('[push] skip — bukan native platform (web/dev server)');
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // 1. Cek/minta izin
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.warn('[push] izin notifikasi ditolak user');
      return;
    }

    // 2. Register ke FCM — hasil token-nya masuk lewat event listener 'registration'
    await PushNotifications.register();

    // 2b. local-notifications punya permission model sendiri, terpisah dari
    // push-notifications. Wajib diminta di awal juga, kalau enggak, schedule()
    // di listener 'pushNotificationReceived' bakal gagal diam-diam.
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const localPerm = await LocalNotifications.checkPermissions();
      if (localPerm.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.error('[push] gagal minta izin local-notifications:', err);
    }

    PushNotifications.addListener('registration', async (token) => {
      console.log('[push] FCM token diterima, menyimpan ke Supabase...');
      await saveTokenToSupabase(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registrasi FCM gagal:', err);
    });

    // 3. (Opsional) tangani tap notif — buka app ke halaman tertentu.
    // Sesuaikan navigasi ini kalau app punya router/tab state sendiri.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[push] user tap notif:', action.notification);
      // contoh: window.location.hash = '#/dompet';
    });

    // 4. PENTING: pas app lagi foreground (lagi dibuka), Android TIDAK
    // otomatis nampilin notif ke tray — cuma fire event ini ke dalam app.
    // Tanpa listener ini, notif dari send-push bakal "ilang" kalau kasir
    // lagi buka app pas transaksi masuk. Kita tampilin manual pakai
    // local-notifications biar behaviour-nya sama kayak pas app di-background.
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('[push] notif diterima saat app foreground:', notification);

      // Double-confirm di dalam UI app — independen dari apakah local
      // notification berhasil tampil di system tray atau enggak. Ini yang
      // dibaca bell icon di Header.
      useNotificationStore.getState().addNotification({
        title: notification.title,
        body: notification.body,
      });

      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: notification.title || 'Mamam Global',
              body: notification.body || '',
            },
          ],
        });
      } catch (err) {
        console.error('[push] gagal nampilin local notification:', err);
      }
    });

    _registered = true;
  } catch (err) {
    console.error('[push] setup gagal:', err);
  }
}

/** Simpan/update FCM token ke tabel device_tokens, dikaitkan ke device_id lokal. */
async function saveTokenToSupabase(fcmToken) {
  const client = await getSupabaseClient();
  if (!client) {
    console.warn('[push] Supabase belum terkonfigurasi, token tidak tersimpan');
    return;
  }

  const deviceId = getDeviceId();
  const { error } = await client
    .from('device_tokens')
    .upsert(
      { device_id: deviceId, fcm_token: fcmToken },
      { onConflict: 'device_id' }
    );

  if (error) {
    console.error('[push] gagal simpan token ke Supabase:', error);
  } else {
    console.log('[push] token tersimpan untuk device:', deviceId);
  }
}