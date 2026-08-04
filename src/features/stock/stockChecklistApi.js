// features/stock/stockChecklistApi.js
//
// Akses data mentah ke tabel `stock_checklists` (punya app mamam-absensi,
// backend Supabase yang sama) + valuasinya terhadap rawMaterials
// (punya mamam-global). Dipakai bareng oleh:
//   - features/stock/StockView.jsx      (Stok Opname: browse bulanan + rincian per hari)
//   - features/balance/stockOpnameLogic.js (Laba Rugi: Stok Awal & Stok Akhir bulan)
//
// Sebelumnya logic ini cuma ada di stockOpnameLogic.js. Dipindah ke sini
// (tanpa ubah logic valuasinya) supaya gak duplikat waktu StockView.jsx
// dibangun.

import { getSupabaseClient } from '../../storage/syncClient';

export const CHECKLIST_TABLE = 'stock_checklists';
const STOCK_MASTER_CONFIG_KEY = 'stockMaster';

// Kolom JSONB dari Supabase-js biasanya sudah ke-parse otomatis jadi
// object/array JS, tapi kadang (tergantung driver/versi) masih string
// mentah — sama pola antisipasinya seperti parseJsonbField di
// mamam-absensi/src/stockChecklist.js, supaya tidak crash kalau itu terjadi.
export function parseJsonbField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Ambil master kategori & item stock checklist (punya mamam-absensi,
 * tabel app_config row key='stockMaster') — dibutuhkan untuk tahu nama &
 * satuan tiap item, karena tabel stock_checklists sendiri cuma nyimpen
 * { [itemId]: { qty, skipped } } tanpa nama.
 */
export async function fetchStockMaster(supabase) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', STOCK_MASTER_CONFIG_KEY)
    .maybeSingle();

  if (error) throw error;

  const value = data?.value;
  const categories = Array.isArray(value?.categories) ? value.categories : [];
  return { categories };
}

/**
 * Valuasi 1 checklist mentah jadi bentuk snapshot { totalValue, itemCount,
 * unmatchedCount, items, unmatchedItems } — match ke rawMaterials BY NAMA
 * (case-insensitive, trim), karena item stock checklist (punya
 * mamam-absensi) dan rawMaterials (punya mamam-global) adalah 2 sumber
 * data terpisah tanpa foreign key bersama, cuma nama yang bisa disamakan.
 *
 * Item dengan qty kosong/null atau skipped=true TIDAK ikut dihitung (belum
 * benar-benar diketahui sisa stoknya). Item dengan qty terisi tapi
 * namanya tidak ketemu di rawMaterials masuk ke unmatchedItems (tidak ikut
 * totalValue, supaya tidak diam-diam anggap harga 0 padahal sebenarnya
 * belum ter-link — owner perlu tahu & rapikan Database Bahan Baku).
 */
export function valuateChecklist(checklistRow, master, rawMaterials) {
  const values = parseJsonbField(checklistRow.values, {});
  const rawByName = new Map(
    (rawMaterials || []).map(rm => [normalizeName(rm.name), rm])
  );

  const items = [];
  const unmatchedItems = [];

  for (const category of master.categories) {
    for (const it of category.items) {
      const v = values[it.id];
      if (!v || v.skipped) continue;
      if (v.qty === null || v.qty === '' || Number.isNaN(Number(v.qty))) continue;

      const qty = Number(v.qty);
      const match = rawByName.get(normalizeName(it.name));

      if (!match) {
        unmatchedItems.push({ name: it.name, qty, unit: it.unit || '' });
        continue;
      }

      const priceSnapshot = Number(match.price) || 0;
      items.push({
        rawMaterialId: match.id,
        name: it.name,
        qty,
        unit: it.unit || '',
        priceSnapshot,
        subtotal: qty * priceSnapshot,
      });
    }
  }

  const totalValue = items.reduce((sum, it) => sum + it.subtotal, 0);

  return {
    totalValue,
    itemCount: items.length,
    unmatchedCount: unmatchedItems.length,
    items,
    unmatchedItems,
  };
}

/**
 * Cari checklist yang SUBMITTED_AT-nya jatuh di bulan `period` ("YYYY-MM"),
 * ambil yang PALING TERAKHIR di-submit — apa pun date_str-nya (BUKAN
 * filter pakai date_str — lihat alasan penting di bawah).
 *
 * KENAPA FILTER PAKAI submitted_at, BUKAN date_str:
 * Checklist di mamam-absensi punya mekanisme "carry-over" (lihat
 * loadActiveChecklistFromServer di mamam-absensi/src/stockChecklist.js):
 * kalau checklist BELUM di-share ke WhatsApp, dia TIDAK direset walau
 * sudah ganti hari — key/date_str-nya TETAP tanggal SAAT checklist itu
 * pertama kali dibuat, bukan tanggal saat akhirnya di-submit/di-share.
 * submitted_at adalah waktu sebenarnya checklist itu jadi valid sebagai
 * data opname, jadi itu yang jadi patokan periode saat mencari "checklist
 * terakhir bulan ini" (dipakai untuk SARAN tanggal Stok Akhir).
 *
 * Toko/karyawan bisa libur berhari-hari di akhir bulan (mis. libur
 * Lebaran) — checklist submitted terakhir yang tersedia bulan itu, sejauh
 * apa pun mundurnya dari tanggal akhir bulan, tetap jadi saran paling
 * valid. Owner tetap bisa timpa saran ini dengan tanggal manual lain.
 */
export async function findLastSubmittedChecklistInMonth(supabase, period) {
  const [y, m] = period.split('-').map(Number);
  const startOfMonthIso = new Date(y, m - 1, 1).toISOString();
  const startOfNextMonthIso = new Date(y, m, 1).toISOString();

  const { data, error } = await supabase
    .from(CHECKLIST_TABLE)
    .select('*')
    .gte('submitted_at', startOfMonthIso)
    .lt('submitted_at', startOfNextMonthIso)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) {
    return { row: data[0], dateStr: data[0].date_str };
  }
  return { row: null, dateStr: null };
}

/**
 * Saran tanggal (date_str) untuk dipakai sebagai default di date-picker —
 * bungkus tipis di atas findLastSubmittedChecklistInMonth, cuma balikin
 * date_str-nya (atau null kalau belum ada checklist submitted bulan itu).
 * Ini SARAN doang — user tetap bisa timpa manual sebelum generate.
 */
export async function suggestLastSubmittedDateInMonth(period) {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  const { dateStr } = await findLastSubmittedChecklistInMonth(supabase, period);
  return dateStr;
}

/**
 * Ambil 1 checklist PERSIS di tanggal `dateStr` ("YYYY-MM-DD") — dipakai
 * waktu user sudah pilih tanggal (baik dari saran otomatis maupun input
 * manual) dan menekan tombol generate/ambil data. Match EXACT ke
 * date_str (bukan submitted_at) karena di titik ini user sudah secara
 * eksplisit memilih "checklist hari ini", jadi harus persis, tidak
 * disubstitusi diam-diam ke tanggal terdekat.
 */
export async function fetchChecklistByDate(supabase, dateStr) {
  const { data, error } = await supabase
    .from(CHECKLIST_TABLE)
    .select('*')
    .eq('date_str', dateStr)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Ambil SEMUA checklist yang date_str-nya jatuh di bulan `period`
 * ("YYYY-MM"), urut tanggal naik — dipakai StockView.jsx untuk rincian
 * per hari. Beda dari findLastSubmittedChecklistInMonth (yang cuma
 * ambil 1 checklist terakhir buat kebutuhan Laba Rugi), di sini
 * dikelompokkan per date_str karena tujuannya BROWSING histori harian,
 * bukan menentukan 1 titik valuasi.
 */
export async function fetchChecklistsInMonth(supabase, period) {
  const { data, error } = await supabase
    .from(CHECKLIST_TABLE)
    .select('*')
    .gte('date_str', `${period}-01`)
    .lte('date_str', `${period}-31`)
    .order('date_str', { ascending: true });

  if (error) throw error;
  return data || [];
}
