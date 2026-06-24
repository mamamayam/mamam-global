// --- Daftar key & klasifikasinya untuk sinkronisasi ---
//
// Dipakai bersama oleh:
//  - storage/realtimeSync.js (sync engine)
//  - hook/usePersistState.js (auto-push saat state berubah)
//  - features/settings/BackupView.jsx (export/import manual)

// Semua key yang dikenal aplikasi.
export const ALL_KEYS = [
  'variantGroups', 'variantCategories', 'menus', 'salesHistory', 'hppLibrary', 'savedBills',
  'expenseCategories', 'expenses', 'incomeCategories', 'incomes',
  'currentShift', 'shiftHistory', 'customers', 'vouchers', 'claimsHistory',
  'storeSettings', 'rawMaterials', 'semiFinished', 'categories',
  'employees', 'employeeDailyRecords', 'additionCategories', 'deductionCategories',
  'attendanceLog',
];

// Key transaksi: array of objects dengan field `id`.
// Disinkronkan PER-RECORD (upsert/delete satu baris saja), bukan re-upload
// seluruh array — supaya hemat kuota Supabase free tier walau data sudah ribuan baris.
// Tabel Supabase: kolom (id text PK, payload jsonb, updated_at timestamptz, updated_by text)
export const TRANSACTION_KEYS = [
  'salesHistory', 'expenses', 'incomes', 'shiftHistory',
  'employeeDailyRecords', 'claimsHistory', 'savedBills',
  'attendanceLog',
];

// Key konfigurasi: disimpan sebagai satu blob JSON per key di tabel `app_config`.
// Ukurannya kecil & jarang berubah (hanya diedit owner), jadi upsert utuh per key
// masih murah — last-write-wins berdasarkan updated_at.
// Tabel Supabase: kolom (key text PK, value jsonb, updated_at timestamptz, updated_by text)
export const CONFIG_KEYS = [
  'menus', 'variantGroups', 'variantCategories', 'categories', 'hppLibrary',
  'customers', 'vouchers', 'employees',
  'expenseCategories', 'incomeCategories', 'additionCategories', 'deductionCategories',
  'rawMaterials', 'semiFinished', 'storeSettings',
];

// Key "live state": object TUNGGAL (bukan array-of-record kayak TRANSACTION_KEYS)
// yang berubah sering & wajib langsung sampai ke device lain SEKETIKA — gak boleh
// nunggu debounce kayak CONFIG_KEYS. Kalau nunggu, device lain bisa lihat status
// null/stale (misal shift kelihatan belum buka padahal sudah), padahal transaksi
// di bawahnya sudah jalan.
// Tabel Supabase TETAP `app_config` (kolom sama: key, value, updated_at, updated_by)
// — cuma beda fungsi push: pushLiveState() (instan) bukan pushConfig() (debounced 1.5s).
export const LIVE_STATE_KEYS = [
  'currentShift',
];

// Gabungan semua key yang fisiknya tinggal di tabel `app_config`.
// Dipakai untuk query PULL & filter realtime subscribe — supaya CONFIG_KEYS
// dan LIVE_STATE_KEYS sama-sama kebaca walau cara push-nya beda.
export const APP_CONFIG_KEYS = [...CONFIG_KEYS, ...LIVE_STATE_KEYS];

export const DATE_FILTERABLE_KEYS = {
  salesHistory:         'date',
  expenses:             'date',
  incomes:              'date',
  shiftHistory:         'startTime',
  employeeDailyRecords: 'date',
  attendanceLog:        'date',
};

// Map key app -> nama tabel Supabase untuk transaksi
export const TRANSACTION_TABLE = Object.fromEntries(TRANSACTION_KEYS.map(k => [k, k]));