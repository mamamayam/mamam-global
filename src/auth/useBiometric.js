// ============================================================================
// useBiometric — fingerprint/FaceID pengganti PIN kasir
// ============================================================================
// Pakai @aparajita/capacitor-biometric-auth: plugin native Capacitor 8 yang
// akses BiometricPrompt Android / LocalAuthentication iOS langsung — BUKAN
// WebAuthn browser API. Ini penting karena WebAuthn di WebView Android
// (yang dipakai APK Capacitor) sering ditolak/gak lengkap kecuali di-setup
// Digital Asset Links; plugin native ini gak punya masalah itu.
//
// Di web (browser/PWA biasa), plugin ini otomatis pakai simulator built-in
// (lihat dokumentasinya) — jadi kode yang sama jalan di dua-duanya tanpa
// cabang if/else platform.
//
// Beda penting dari WebAuthn: plugin ini TIDAK menyimpan "credential" —
// dia cuma verifikasi "orang yang pegang HP ini adalah pemilik sah device"
// lewat sensor, mirip kayak unlock HP. Makanya status "sudah aktif belum"
// kita simpan sendiri sebagai flag boolean di localStorage.
// ============================================================================

import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

const ENABLED_FLAG_KEY = 'mamam_pin_biometric_enabled';

/**
 * Cek apakah device ini punya sensor fingerprint/FaceID yang aktif & terdaftar.
 * Return boolean.
 */
export async function isBiometricSupported() {
  try {
    const result = await BiometricAuth.checkBiometry();
    return Boolean(result.isAvailable);
  } catch {
    return false;
  }
}

/** Apakah kasir di device ini sudah mengaktifkan fingerprint untuk PIN. */
export function hasBiometricCredential() {
  return localStorage.getItem(ENABLED_FLAG_KEY) === '1';
}

/** Matikan fingerprint untuk PIN kasir di device ini. */
export function clearBiometricCredential() {
  localStorage.removeItem(ENABLED_FLAG_KEY);
}

/**
 * Aktifkan fingerprint di device ini. Panggil ini SETELAH kasir berhasil
 * verifikasi PIN biasa (jadi fingerprint cuma bisa diaktifkan oleh orang
 * yang sudah tau PIN yang aktif). Sensor akan diminta sekali sebagai
 * konfirmasi sebelum flag diaktifkan.
 * Return { success, error }.
 */
export async function registerBiometric() {
  try {
    await BiometricAuth.authenticate({
      reason: 'Aktifkan fingerprint untuk PIN kasir',
      cancelTitle: 'Batal',
      androidTitle: 'Aktifkan Fingerprint',
      androidSubtitle: 'Konfirmasi sidik jari untuk mengaktifkan',
      allowDeviceCredential: false,
    });

    localStorage.setItem(ENABLED_FLAG_KEY, '1');
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: mapBiometryError(err) };
  }
}

/**
 * Minta verifikasi fingerprint sebagai pengganti PIN.
 * Return { success, error }.
 */
export async function verifyBiometric() {
  if (!hasBiometricCredential()) {
    return { success: false, error: 'Fingerprint belum diaktifkan di device ini.' };
  }

  try {
    await BiometricAuth.authenticate({
      reason: 'Verifikasi untuk masuk mode kasir',
      cancelTitle: 'Batal',
      androidTitle: 'Verifikasi PIN Kasir',
      androidSubtitle: 'Gunakan sidik jari yang terdaftar',
      allowDeviceCredential: false,
    });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: mapBiometryError(err) };
  }
}

function mapBiometryError(err) {
  const code = err?.code;

  switch (code) {
    case 'userCancel':
    case 'appCancel':
    case 'systemCancel':
      return 'Verifikasi fingerprint dibatalkan.';
    case 'biometryNotEnrolled':
      return 'Belum ada sidik jari yang terdaftar di HP ini.';
    case 'biometryNotAvailable':
      return 'HP ini tidak mendukung fingerprint/FaceID.';
    case 'biometryLockout':
      return 'Sensor fingerprint terkunci sementara, coba lagi nanti atau pakai PIN.';
    default:
      return err?.message || 'Verifikasi fingerprint gagal.';
  }
}