import Dexie from 'dexie';

// --- Definisi Database ---
export const db = new Dexie('mamam_kasir_db');

db.version(1).stores({
  // Satu tabel key-value universal, mirip localStorage tapi tanpa batas memori
  // key = nama data (misal: 'menus', 'salesHistory', dll)
  store: 'key'
});

// --- Key yang punya field Date dan perlu dikonversi setelah dibaca ---
const DATE_KEYS = [
  'expenses',
  'employeeDailyRecords',
  'salesHistory',
  'savedBills',
  'incomes',
  'hppLibrary',
  'claimsHistory',
];

// Konversi field date setelah data dibaca dari DB
export const reviveDates = (key, data) => {
  if (!data) return data;

  if (DATE_KEYS.includes(key) && Array.isArray(data)) {
    return data.map(p => ({ ...p, date: new Date(p.date) }));
  }
  if (key === 'currentShift') {
    return { ...data, startTime: new Date(data.startTime) };
  }
  if (key === 'shiftHistory' && Array.isArray(data)) {
    return data.map(s => ({
      ...s,
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    }));
  }
  return data;
};

// --- API Utama ---

/**
 * Baca data dari Dexie. Kalau tidak ada, return defaultData.
 * Otomatis migrasi dari localStorage lama jika ada.
 */
export const loadData = async (key, defaultData) => {
  try {
    const record = await db.store.get(key);

    if (record !== undefined) {
      return reviveDates(key, record.value);
    }

    // Migrasi otomatis dari localStorage lama (sekali saja)
    const oldItem = localStorage.getItem(`mamam_kasir_${key}`);
    if (oldItem) {
      const parsed = JSON.parse(oldItem);
      await db.store.put({ key, value: parsed });
      // Hapus dari localStorage setelah berhasil migrasi
      localStorage.removeItem(`mamam_kasir_${key}`);
      console.log(`[DB] Migrasi '${key}' dari localStorage ke Dexie ✅`);
      return reviveDates(key, parsed);
    }
  } catch (error) {
    console.error(`[DB] Error membaca '${key}':`, error);
  }

  return defaultData;
};

/**
 * Simpan data ke Dexie.
 */
export const saveData = async (key, data) => {
  try {
    await db.store.put({ key, value: data });
  } catch (error) {
    console.error(`[DB] Error menyimpan '${key}':`, error);
  }
};

/**
 * Hapus satu data dari Dexie.
 */
export const deleteData = async (key) => {
  try {
    await db.store.delete(key);
  } catch (error) {
    console.error(`[DB] Error menghapus '${key}':`, error);
  }
};

/**
 * Ambil semua data sekaligus (untuk fitur Backup).
 * Return object { key: value, key: value, ... }
 */
export const exportAllData = async () => {
  try {
    const all = await db.store.toArray();
    return Object.fromEntries(all.map(r => [r.key, r.value]));
  } catch (error) {
    console.error('[DB] Error export data:', error);
    return {};
  }
};

/**
 * Import semua data sekaligus (untuk fitur Restore).
 * @param {Object} dataObj - { key: value, key: value, ... }
 */
export const importAllData = async (dataObj) => {
  try {
    const records = Object.entries(dataObj).map(([key, value]) => ({ key, value }));
    await db.store.bulkPut(records);
  } catch (error) {
    console.error('[DB] Error import data:', error);
  }
};