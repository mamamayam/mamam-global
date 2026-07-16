// ============================================================================
// useBiometric — WebAuthn helper buat fingerprint pengganti PIN kasir
// ============================================================================
// Kenapa WebAuthn (bukan plugin native)?
// - Jalan di browser/PWA DAN di APK Capacitor (WebView Android modern sudah
//   support platform authenticator), tanpa nambah dependency Capacitor baru.
// - Private key gak pernah keluar dari secure hardware HP (fingerprint sensor).
//   Yang disimpan di localStorage cuma credentialId (public, gak sensitif).
// - Kalau device/browser gak support, semua fungsi di sini otomatis
//   mengembalikan `unsupported` — PinModal tinggal sembunyikan tombolnya.
//
// PENTING: WebAuthn butuh secure context (HTTPS, atau localhost pas dev).
// Kalau app dibuka lewat http:// biasa (bukan localhost), browser akan
// menolak — itu bukan bug, itu batasan browser.
// ============================================================================

const STORAGE_KEY = 'mamam_pin_biometric_credential';

// Ganti sesuai domain app kamu kalau perlu (dipakai WebAuthn buat scoping)
const RP_NAME = 'Mamam Ayam';

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function base64ToBuf(base64) {
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

function randomChallenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Cek apakah device/browser ini support fingerprint/FaceID (platform authenticator).
 * Async karena beberapa browser butuh cek availability ke OS.
 */
export async function isBiometricSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  if (!navigator.credentials || !navigator.credentials.create) return false;

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch {
    return false;
  }
}

/** Apakah kasir di device ini sudah pernah setup fingerprint. */
export function hasBiometricCredential() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

/** Hapus credential fingerprint dari device ini (mis. tombol "Matikan Fingerprint"). */
export function clearBiometricCredential() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Daftarkan fingerprint baru di device ini. Panggil ini SETELAH kasir
 * berhasil verifikasi PIN biasa (jadi fingerprint cuma bisa didaftarkan
 * oleh orang yang sudah tau PIN yang aktif).
 * Return { success, error }.
 */
export async function registerBiometric() {
  try {
    const supported = await isBiometricSupported();
    if (!supported) {
      return { success: false, error: 'Device ini tidak mendukung fingerprint/FaceID.' };
    }

    const userId = crypto.getRandomValues(new Uint8Array(16));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: RP_NAME },
        user: {
          id: userId,
          name: 'kasir-pin',
          displayName: 'PIN Kasir',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // wajib sensor built-in (fingerprint/FaceID), bukan security key USB
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });

    if (!credential) {
      return { success: false, error: 'Pendaftaran fingerprint dibatalkan.' };
    }

    localStorage.setItem(STORAGE_KEY, bufToBase64(credential.rawId));
    return { success: true, error: null };
  } catch (err) {
    // Termasuk kasus user cancel prompt fingerprint
    return { success: false, error: err?.message || 'Gagal mendaftarkan fingerprint.' };
  }
}

/**
 * Minta verifikasi fingerprint. Return { success, error }.
 * success=true artinya sensor mengonfirmasi orang yang sama yang dulu registerBiometric().
 */
export async function verifyBiometric() {
  try {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      return { success: false, error: 'Fingerprint belum diaktifkan di device ini.' };
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [
          {
            type: 'public-key',
            id: base64ToBuf(storedId),
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (!assertion) {
      return { success: false, error: 'Verifikasi fingerprint dibatalkan.' };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err?.message || 'Verifikasi fingerprint gagal.' };
  }
}