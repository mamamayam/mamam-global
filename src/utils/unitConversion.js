// utils/unitConversion.js
//
// Fondasi "Satuan Dasar" — pengganti sistem lama yang biarin rawMaterials.unit
// jadi teks bebas ("Kg", "Liter", "Ekor", dst) tanpa faktor konversi yang
// konsisten. Sebelumnya ada 2 titik yang sama-sama nebak/nggak convert:
//   - hppUtils.js getIngredientCost() -> cuma hardcode 3 pasangan satuan,
//     di luar itu fallback price*qty apa adanya.
//   - stockChecklistApi.js valuateChecklist() -> ZERO konversi sama sekali.
// Ini akar kenapa input gram vs harga per-Kg bisa beda 1000x.
//
// Aturan baru: SEMUA rawMaterial akhirnya punya `baseUnit` (salah satu dari
// BASE_UNITS) dan `basePrice` = harga per 1 baseUnit itu. Gak ada lagi
// "harga per Kg" vs "input per Gram" ketemu di tempat berbeda — semua
// dihitung dari titik yang sama. `unit`/`price` lama TETAP ada apa adanya
// (dipakai kalkulasi lama sampai Patch 2/3 pindah sepenuhnya), field baru
// ini murni ditambahkan di sampingnya.
//
// File ini murni pure functions (gak nyimpen/fetch apa-apa) — dipakai oleh
// UnitMigrationModal.jsx (saran otomatis + validasi override) dan nanti oleh
// HPP Kalkulator/Bahan Setengah Jadi/Stok Opname versi baru (Patch 2 & 3).

export const BASE_UNITS = ['gram', 'ml', 'pcs'];

export const BASE_UNIT_LABELS = {
  gram: 'Gram',
  ml: 'ml',
  pcs: 'Pcs',
};

// Alias satuan yang UMUM dikenal sistem, dikelompokkan per kategori fisik.
// `factor` = berapa baseUnit setara 1 unit alias ini (mis. 1 kg = 1000 gram).
// Kategori menentukan baseUnit yang cocok: weight->gram, volume->ml, count->pcs.
//
// sdm/sdt sengaja disamakan ke ml (bukan gram) — mengikuti asumsi dapur biasa
// yang SUDAH dipakai sistem lama (KalkulatorHppView totalWeight lama: 1
// sdm=15, 1 sdt=5) supaya resep yang pernah dihitung pakai asumsi itu gak
// tiba-tiba lompat angkanya. ini approksimasi dapur, bukan aturan fisika baru.
const UNIT_ALIASES = {
  // ── Berat (base: gram) ────────────────────────────────────────────────
  kg: { category: 'weight', factor: 1000 },
  kilo: { category: 'weight', factor: 1000 },
  kilogram: { category: 'weight', factor: 1000 },
  ons: { category: 'weight', factor: 100 },
  gram: { category: 'weight', factor: 1 },
  gr: { category: 'weight', factor: 1 },
  g: { category: 'weight', factor: 1 },

  // ── Volume (base: ml) ─────────────────────────────────────────────────
  liter: { category: 'volume', factor: 1000 },
  ltr: { category: 'volume', factor: 1000 },
  l: { category: 'volume', factor: 1000 },
  ml: { category: 'volume', factor: 1 },
  mililiter: { category: 'volume', factor: 1 },
  mil: { category: 'volume', factor: 1 },
  sdm: { category: 'volume', factor: 15 },
  'sendok makan': { category: 'volume', factor: 15 },
  tbsp: { category: 'volume', factor: 15 },
  sdt: { category: 'volume', factor: 5 },
  'sendok teh': { category: 'volume', factor: 5 },
  tsp: { category: 'volume', factor: 5 },

  // ── Hitungan (base: pcs) ──────────────────────────────────────────────
  pcs: { category: 'count', factor: 1 },
  pc: { category: 'count', factor: 1 },
  buah: { category: 'count', factor: 1 },
  butir: { category: 'count', factor: 1 },
  ekor: { category: 'count', factor: 1 },
  lembar: { category: 'count', factor: 1 },
  biji: { category: 'count', factor: 1 },
  potong: { category: 'count', factor: 1 },
  porsi: { category: 'count', factor: 1 },
  unit: { category: 'count', factor: 1 },
};

const CATEGORY_BASE_UNIT = { weight: 'gram', volume: 'ml', count: 'pcs' };

export function normalizeUnitString(unit) {
  return String(unit || '').trim().toLowerCase();
}

/** Cari alias { category, factor } dari sebuah string satuan, atau null kalau gak dikenal. */
export function lookupUnitAlias(unit) {
  return UNIT_ALIASES[normalizeUnitString(unit)] || null;
}

/**
 * Tebak baseUnit + basePrice dari `unit`/`price` LAMA sebuah rawMaterial —
 * dipakai UnitMigrationModal buat ngisi saran otomatis pas migrasi.
 *
 * confidence:
 *   'auto'   -> satuan lama dikenali, baseUnit & basePrice bisa dihitung pasti.
 *   'manual' -> satuan lama gak dikenal (kosong, atau custom kayak "Pouch"/
 *               "Dus") — owner WAJIB pilih baseUnit & isi basePrice sendiri,
 *               karena sistem gak tau berapa gram/ml isi 1 pouch/dus itu.
 */
export function suggestBaseUnitAndPrice(oldUnit, oldPrice) {
  const alias = lookupUnitAlias(oldUnit);
  const price = Number(oldPrice) || 0;

  if (!alias) {
    return { baseUnit: null, basePrice: null, confidence: 'manual' };
  }

  return {
    baseUnit: CATEGORY_BASE_UNIT[alias.category],
    basePrice: alias.factor > 0 ? price / alias.factor : 0,
    confidence: 'auto',
  };
}

/**
 * Konversi qty dari satuan apapun (`fromUnit`) ke `targetBaseUnit`.
 * Urutan pencarian: (1) alias override kustom milik bahan itu sendiri
 * (`overrides`, diisi manual per bahan utk satuan non-standar kayak "Pouch"),
 * (2) alias satuan umum di atas. Kalau keduanya gak ketemu, ATAU ketemu tapi
 * kategorinya beda dari targetBaseUnit (mis. satuan "ml" mau dikonversi ke
 * baseUnit "gram") -> return null. SENGAJA gak pernah nebak/maksa angka —
 * caller (valuateChecklist versi baru di Patch 3) yang mutuskan gimana
 * nampilin "gak bisa dihitung" ke user, bukan diam-diam salah hitung.
 *
 * @param {number} qty
 * @param {string} fromUnit
 * @param {'gram'|'ml'|'pcs'} targetBaseUnit
 * @param {{label:string, factor:number}[]} [overrides]
 * @returns {number|null}
 */
export function convertQtyToBaseUnit(qty, fromUnit, targetBaseUnit, overrides = []) {
  const n = Number(qty);
  if (Number.isNaN(n)) return null;

  const normalized = normalizeUnitString(fromUnit);
  if (!normalized || !targetBaseUnit) return null;

  if (normalized === targetBaseUnit) return n;

  const override = (overrides || []).find(o => normalizeUnitString(o.label) === normalized);
  if (override && Number(override.factor) > 0) {
    return n * Number(override.factor);
  }

  const alias = lookupUnitAlias(fromUnit);
  if (alias && CATEGORY_BASE_UNIT[alias.category] === targetBaseUnit) {
    return n * alias.factor;
  }

  return null;
}

/** Label tampilan buat sebuah baseUnit, mis. "Rp12 / Gram". Fallback '-' kalau kosong. */
export function formatBaseUnit(baseUnit) {
  return BASE_UNIT_LABELS[baseUnit] || baseUnit || '-';
}

/** Sebuah rawMaterial dianggap "lengkap" satuan dasarnya kalau baseUnit & basePrice keduanya keisi. */
export function hasBaseUnit(rawMaterial) {
  return !!rawMaterial?.baseUnit && rawMaterial?.basePrice !== null && rawMaterial?.basePrice !== undefined;
}
