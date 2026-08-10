// features/stock/stockChecklistApi.js
//
// Akses data mentah ke tabel `stock_checklists` (punya app mamam-absensi,
// backend Supabase yang sama) + valuasinya terhadap rawMaterials
// (punya mamam-global), dioverride opsional oleh stockOpnameCorrections
// (juga punya mamam-global, lihat App.jsx & valuateChecklist di bawah).
// Dipakai bareng oleh:
//   - features/stock/StockView.jsx      (Stok Opname: browse bulanan + rincian per hari + koreksi)
//   - features/balance/stockOpnameLogic.js (Laba Rugi: Stok Awal & Stok Akhir bulan)
//
// Sebelumnya logic ini cuma ada di stockOpnameLogic.js. Dipindah ke sini
// (tanpa ubah logic valuasinya) supaya gak duplikat waktu StockView.jsx
// dibangun.

import { getSupabaseClient } from '../../storage/syncClient';
import { hasBaseUnit, convertQtyToBaseUnit, formatBaseUnit } from '../../utils/unitConversion';

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

/** Cari koreksi AKTIF (belum di-soft-delete) buat kombinasi (dateStr, rawMaterialId) tertentu, atau null kalau belum ada. */
export function findActiveCorrection(corrections, dateStr, rawMaterialId) {
  return (corrections || []).find(c => !c.deletedAt && c.dateStr === dateStr && c.rawMaterialId === rawMaterialId) || null;
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
 * unmatchedCount, unitMismatchCount, items, unmatchedItems, unitMismatchItems }.
 * Match ke rawMaterials BY NAMA (case-insensitive, trim), karena item stock
 * checklist (punya mamam-absensi) dan rawMaterials (punya mamam-global)
 * adalah 2 sumber data terpisah tanpa foreign key bersama.
 *
 * Setelah Patch 3, sebuah item bisa gagal dihitung karena 2 alasan berbeda
 * (dipisah biar owner tau persis harus benerin apa & di mana):
 *   - unmatchedItems: NAMA item gak ketemu di rawMaterials sama sekali.
 *   - unitMismatchItems: NAMA ketemu, tapi satuan checklist item itu gak
 *     bisa dipastikan konversinya ke baseUnit rawMaterial itu (rawMaterial
 *     belum diisi Satuan Dasar-nya di Migrasi Satuan, ATAU satuannya gak
 *     dikenal & gak ada alias di checklistUnitOverride bahan itu).
 * Keduanya SENGAJA tidak ikut totalValue (dianggap 0), bukan ditebak.
 *
 * `corrections` (opsional, array stockOpnameCorrections milik mamam-global
 * sendiri — lihat App.jsx): override manual owner per (dateStr,
 * rawMaterialId), SELALU menang di atas apa pun hasil checklist asli untuk
 * kombinasi itu. Ini jalan keluarnya biar Stok Opname "bisa diedit" tanpa
 * mamam-global perlu nulis ke tabel stock_checklists (punya mamam-absensi)
 * sama sekali — data karyawan asli tetap utuh sebagai audit trail.
 */
export function valuateChecklist(checklistRow, master, rawMaterials, corrections = []) {
  const dateStr = checklistRow.date_str;
  const values = parseJsonbField(checklistRow.values, {});
  const rawByName = new Map(
    (rawMaterials || []).map(rm => [normalizeName(rm.name), rm])
  );
  const rawById = new Map((rawMaterials || []).map(rm => [rm.id, rm]));

  const correctionsForDate = (corrections || []).filter(c => !c.deletedAt && c.dateStr === dateStr);
  const correctionByMaterialId = new Map(correctionsForDate.map(c => [c.rawMaterialId, c]));
  const appliedCorrectionIds = new Set();

  const items = [];
  const unmatchedItems = [];
  const unitMismatchItems = [];

  for (const category of master.categories) {
    for (const it of category.items) {
      const match = rawByName.get(normalizeName(it.name));
      const correction = match ? correctionByMaterialId.get(match.id) : null;

      // Koreksi manual owner SELALU menang, apa pun isi checklist aslinya
      // (termasuk kalau checklist-nya kosong/skipped/qty aneh).
      if (correction) {
        appliedCorrectionIds.add(correction.id);
        items.push({
          rawMaterialId: match.id,
          name: it.name,
          qty: correction.qty,
          unit: formatBaseUnit(match.baseUnit),
          priceSnapshot: match.basePrice || 0,
          subtotal: (Number(correction.qty) || 0) * (match.basePrice || 0),
          isCorrected: true,
          correctionId: correction.id,
        });
        continue;
      }

      const v = values[it.id];
      if (!v || v.skipped) continue;
      if (v.qty === null || v.qty === '' || Number.isNaN(Number(v.qty))) continue;

      const qty = Number(v.qty);

      if (!match) {
        unmatchedItems.push({ name: it.name, qty, unit: it.unit || '' });
        continue;
      }

      if (!hasBaseUnit(match)) {
        unitMismatchItems.push({
          name: it.name, qty, unit: it.unit || '', rawMaterialId: match.id,
          reason: 'material_no_base_unit',
        });
        continue;
      }

      const qtyInBaseUnit = convertQtyToBaseUnit(qty, it.unit, match.baseUnit, match.checklistUnitOverride);
      if (qtyInBaseUnit === null) {
        unitMismatchItems.push({
          name: it.name, qty, unit: it.unit || '', rawMaterialId: match.id,
          materialBaseUnit: match.baseUnit, reason: 'unit_not_convertible',
        });
        continue;
      }

      items.push({
        rawMaterialId: match.id,
        name: it.name,
        qty,
        unit: it.unit || '',
        priceSnapshot: match.basePrice,
        subtotal: qtyInBaseUnit * (match.basePrice || 0),
        isCorrected: false,
      });
    }
  }

  // Koreksi yang rawMaterialId-nya gak "ketemu" lewat item checklist manapun
  // di atas (mis. owner nambahin koreksi buat bahan yang gak ada sama
  // sekali di daftar stockMaster hari itu) tetep dihitung di sini.
  for (const correction of correctionsForDate) {
    if (appliedCorrectionIds.has(correction.id)) continue;
    const material = rawById.get(correction.rawMaterialId);
    if (!material) continue; // rawMaterial-nya udah kehapus, koreksi gak relevan lagi
    items.push({
      rawMaterialId: material.id,
      name: material.name,
      qty: correction.qty,
      unit: formatBaseUnit(material.baseUnit),
      priceSnapshot: material.basePrice || 0,
      subtotal: (Number(correction.qty) || 0) * (material.basePrice || 0),
      isCorrected: true,
      correctionId: correction.id,
    });
  }

  const totalValue = items.reduce((sum, it) => sum + it.subtotal, 0);

  return {
    totalValue,
    itemCount: items.length,
    unmatchedCount: unmatchedItems.length,
    unitMismatchCount: unitMismatchItems.length,
    items,
    unmatchedItems,
    unitMismatchItems,
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
