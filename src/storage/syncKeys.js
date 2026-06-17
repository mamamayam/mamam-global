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
];

// Key transaksi: array of objects dengan field `id`.
// Disinkronkan PER-RECORD (upsert/delete satu baris saja), bukan re-upload
// seluruh array — supaya hemat kuota Supabase free tier walau data sudah ribuan baris.
// Tabel Supabase: kolom (id text PK, payload jsonb, updated_at timestamptz, updated_by text)
export const TRANSACTION_KEYS = [
  'salesHistory', 'expenses', 'incomes', 'shiftHistory',
  'employeeDailyRecords', 'claimsHistory', 'savedBills',
];

// Key konfigurasi: disimpan sebagai satu blob JSON per key di tabel `app_config`.
// Ukurannya kecil & jarang berubah (hanya diedit owner), jadi upsert utuh per key
// masih murah — last-write-wins berdasarkan updated_at.
// Tabel Supabase: kolom (key text PK, value jsonb, updated_at timestamptz, updated_by text)
export const CONFIG_KEYS = [
  'menus', 'variantGroups', 'variantCategories', 'categories', 'hppLibrary',
  'customers', 'vouchers', 'employees',
  'expenseCategories', 'incomeCategories', 'additionCategories', 'deductionCategories',
  'rawMaterials', 'semiFinished', 'storeSettings', 'currentShift',
];

export const DATE_FILTERABLE_KEYS = {
  salesHistory:         'date',
  expenses:             'date',
  incomes:              'date',
  shiftHistory:         'startTime',
  employeeDailyRecords: 'date',
};

// Map key app -> nama tabel Supabase untuk transaksi
export const TRANSACTION_TABLE = Object.fromEntries(TRANSACTION_KEYS.map(k => [k, k]));