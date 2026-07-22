// features/balance/stockOpnameLogic.js
//
// Sisi Stok Opname untuk laporan Laba Rugi (BalanceTab.jsx) — sebelumnya
// MOCK di BalanceSummaryTab.jsx, sekarang ambil data ASLI:
//
//   Stok Akhir bulan X  = valuasi checklist "stock_checklists" (tabel milik
//                          mamam-absensi, backend Supabase yang sama) yang
//                          SUBMITTED_AT-nya jatuh di bulan X, diambil yang
//                          PALING TERAKHIR di-submit (BUKAN filter pakai
//                          date_str checklist — date_str bisa menyesatkan
//                          karena mekanisme carry-over di mamam-absensi;
//                          lihat penjelasan lengkap di
//                          findLastSubmittedChecklistInMonth di bawah).
//                          Toko/karyawan libur berhari-hari di penghujung
//                          bulan (mis. libur Lebaran) tetap dapat data,
//                          selama ada minimal 1 checklist submitted bulan
//                          itu — lihat sourceDateStr di hasil generate
//                          untuk tahu tanggal checklist yang jadi sumber.
//                          Item-nya di-match ke rawMaterials (harga, milik
//                          mamam-global) by NAMA (case-insensitive, trim),
//                          lalu snapshot-nya disimpan permanen & terkunci
//                          ke tabel stock_opname_bulanan (lihat
//                          storage/supabase_stock_opname_migration.sql).
//
//   Stok Awal bulan X   = snapshot Stok Akhir bulan (X-1) yang sudah ada di
//                          stock_opname_bulanan. Kalau belum ada (mis. bulan
//                          pertama pakai fitur ini, belum ada histori sama
//                          sekali), Stok Awal = 0 + caller wajib tampilkan
//                          warning ke user (JANGAN diam-diam dianggap 0
//                          tanpa keterangan — itu bisa bikin owner salah
//                          baca HPP bulan pertama).
//
// Kenapa dipisah dari balance.js: balance.js sengaja tidak tahu-menahu
// soal stok opname (lihat docblock computeBalance di sana) supaya tetap
// reusable. File ini yang jadi jembatan ke sumber data stok opname
// sesungguhnya, dipanggil dari BalanceSummaryTab.jsx.

import { getSupabaseClient, getDeviceId } from '../../storage/syncClient';

const CHECKLIST_TABLE = 'stock_checklists';
const STOCK_MASTER_CONFIG_KEY = 'stockMaster';
const SNAPSHOT_TABLE = 'stock_opname_bulanan';

// Kolom JSONB dari Supabase-js biasanya sudah ke-parse otomatis jadi
// object/array JS, tapi kadang (tergantung driver/versi) masih string
// mentah — sama pola antisipasinya seperti parseJsonbField di
// mamam-absensi/src/stockChecklist.js, supaya tidak crash kalau itu terjadi.
function parseJsonbField(value, fallback) {
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

/** "YYYY-MM" -> "YYYY-MM" bulan sebelumnya. */
function previousPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m-2 karena Date bulan 0-indexed, mundur 1 bulan
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Ambil master kategori & item stock checklist (punya mamam-absensi,
 * tabel app_config row key='stockMaster') — dibutuhkan untuk tahu nama &
 * satuan tiap item, karena tabel stock_checklists sendiri cuma nyimpen
 * { [itemId]: { qty, skipped } } tanpa nama.
 */
async function fetchStockMaster(supabase) {
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
 * Cari checklist stock_checklists yang SUBMITTED_AT-nya jatuh di bulan
 * `period`, ambil yang PALING TERAKHIR di-submit — apa pun date_str-nya
 * (BUKAN filter pakai date_str — lihat alasan penting di bawah).
 *
 * KENAPA FILTER PAKAI submitted_at, BUKAN date_str:
 * Checklist di mamam-absensi punya mekanisme "carry-over" (lihat
 * loadActiveChecklistFromServer di mamam-absensi/src/stockChecklist.js):
 * kalau checklist BELUM di-share ke WhatsApp, dia TIDAK direset walau
 * sudah ganti hari — key/date_str-nya TETAP tanggal SAAT checklist itu
 * pertama kali dibuat, bukan tanggal saat akhirnya di-submit/di-share.
 *
 * Konkretnya: checklist yang mulai diisi 30 Juni tapi baru ditekan
 * "Selesai Isi Checklist" + dibagikan tanggal 2 Juli akan tersimpan dengan
 * date_str='2026-06-30', PADAHAL submitted_at-nya di Juli. Kalau kita
 * filter pakai date_str, checklist ini akan KELEWAT saat generate Stok
 * Akhir Juni (harusnya masuk, itu checklist terakhir bulan itu) DAN juga
 * tidak akan pernah ketemu saat generate Juli (padahal secara waktu
 * submit dia milik Juli). submitted_at adalah waktu sebenarnya checklist
 * itu jadi valid sebagai data opname, jadi itu yang jadi patokan periode.
 *
 * Toko/karyawan bisa libur berhari-hari di akhir bulan (mis. libur
 * Lebaran) — checklist submitted terakhir yang tersedia bulan itu, sejauh
 * apa pun mundurnya dari tanggal akhir bulan, tetap jadi patokan stok
 * opname paling valid yang ada. Lebih baik pakai data agak lama daripada
 * gagal generate sama sekali.
 */
async function findLastSubmittedChecklistInMonth(supabase, period) {
  // Batas bulan dalam bentuk timestamp ISO (submitted_at adalah timestamptz).
  // Pakai awal bulan berikutnya sebagai batas atas EKSKLUSIF supaya tidak
  // perlu tahu tanggal akhir bulan yang presisi sampai ke detik.
  const [y, m] = period.split('-').map(Number);
  const startOfMonthIso = new Date(y, m - 1, 1).toISOString();
  const startOfNextMonthIso = new Date(y, m, 1).toISOString();

  // TODO(debug sementara — hapus setelah masalah "belum ada checklist
  // submitted" padahal ada data di Supabase ini selesai ditelusuri):
  console.log('[stockOpnameLogic] cari checklist submitted, period=', period,
    'range=', startOfMonthIso, '→', startOfNextMonthIso);

  const { data, error } = await supabase
    .from(CHECKLIST_TABLE)
    .select('*')
    .gte('submitted_at', startOfMonthIso)
    .lt('submitted_at', startOfNextMonthIso)
    .order('submitted_at', { ascending: false })
    .limit(1);

  console.log('[stockOpnameLogic] hasil query:', { data, error });

  if (error) throw error;
  if (data && data.length > 0) {
    return { row: data[0], usedDateStr: data[0].date_str };
  }

  return { row: null, usedDateStr: null };
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
function valuateChecklist(checklistRow, master, rawMaterials) {
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
 * Ambil snapshot Stok Awal untuk 1 periode — yaitu snapshot Stok Akhir
 * bulan SEBELUMNYA dari stock_opname_bulanan.
 *
 * Kalau belum pernah digenerate (bulan pertama pakai fitur ini / bulan
 * lalu terlewat generate-nya), balikin totalValue: 0 dengan
 * `available: false` supaya UI WAJIB menampilkan warning yang jelas —
 * bukan diam-diam menganggap stok awal = 0 seolah itu angka valid.
 */
export async function fetchStokAwal(period) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return { available: false, period: previousPeriod(period), totalValue: 0, itemCount: 0, generatedAt: null };
  }

  const prevPeriod = previousPeriod(period);
  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('*')
    .eq('period', prevPeriod)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return { available: false, period: prevPeriod, totalValue: 0, itemCount: 0, generatedAt: null };
  }

  return {
    available: true,
    period: data.period,
    totalValue: Number(data.total_value) || 0,
    itemCount: data.item_count || 0,
    generatedAt: data.generated_at,
  };
}

/**
 * Ambil snapshot Stok Akhir untuk periode ini KALAU sudah pernah
 * digenerate sebelumnya (mis. user reload halaman) — supaya tidak perlu
 * generate ulang tiap buka tab. Balikin null kalau belum ada.
 */
export async function fetchStokAkhirIfExists(period) {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('*')
    .eq('period', period)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    period: data.period,
    totalValue: Number(data.total_value) || 0,
    itemCount: data.item_count || 0,
    unmatchedCount: data.unmatched_count || 0,
    items: parseJsonbField(data.items, []),
    unmatchedItems: parseJsonbField(data.unmatched_items, []),
    generatedAt: data.generated_at,
    sourceDateStr: data.source_date_str,
  };
}

/**
 * Generate & kunci snapshot Stok Akhir untuk 1 periode:
 * 1. Cari checklist stock_checklists submitted terdekat ke akhir bulan.
 * 2. Ambil master kategori/item (buat nama & satuan tiap item).
 * 3. Valuasi pakai rawMaterials (harga saat ini, snapshot permanen).
 * 4. Upsert ke stock_opname_bulanan (locked=true, immutable — generate
 *    ulang di periode yang sama akan MENIMPA snapshot lama; ini disengaja
 *    untuk kasus "generate lagi setelah rapikan nama bahan baku yang
 *    belum ter-link", TAPI begitu bulan berikutnya sudah baca stok awal
 *    dari snapshot ini, jangan generate ulang tanpa koordinasi karena
 *    akan mengubah dasar perhitungan bulan berikutnya juga).
 *
 * Melempar error dengan pesan jelas kalau tidak ada checklist submitted
 * sama sekali di sekitar akhir bulan itu — supaya UI bisa kasih tau user
 * apa yang perlu dilakukan (isi & submit checklist di Mamam Absensi dulu),
 * bukan diam-diam menyimpan snapshot kosong.
 */
export async function generateStokAkhir(period, rawMaterials) {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase belum terkonfigurasi — tidak bisa mengambil data stok opname.');
  }

  const { row, usedDateStr } = await findLastSubmittedChecklistInMonth(supabase, period);

  if (!row) {
    throw new Error(
      `Belum ada checklist stok opname yang di-submit sepanjang bulan ${period}. Isi & submit checklist di Mamam Absensi dulu, baru generate lagi di sini.`
    );
  }

  const master = await fetchStockMaster(supabase);
  const valuasi = valuateChecklist(row, master, rawMaterials);

  const payload = {
    period,
    total_value: valuasi.totalValue,
    item_count: valuasi.itemCount,
    unmatched_count: valuasi.unmatchedCount,
    items: valuasi.items,
    unmatched_items: valuasi.unmatchedItems,
    source_date_str: usedDateStr,
    generated_at: new Date().toISOString(),
    generated_by: getDeviceId(),
    locked: true,
  };

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .upsert(payload, { onConflict: 'period' })
    .select()
    .single();

  if (error) throw error;

  return {
    period: data.period,
    totalValue: Number(data.total_value) || 0,
    itemCount: data.item_count || 0,
    unmatchedCount: data.unmatched_count || 0,
    items: parseJsonbField(data.items, []),
    unmatchedItems: parseJsonbField(data.unmatched_items, []),
    generatedAt: data.generated_at,
    sourceDateStr: data.source_date_str,
  };
}