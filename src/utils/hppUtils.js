import { BASE_UNITS } from './unitConversion';

/**
 * Hitung total biaya LIVE dari array ingredients sebuah resep/prep, nyari
 * harga TERKINI dari `materials` (availableMaterials / rawMaterials) per
 * rawMaterialId. Handle 2 bentuk ingredient sekaligus (peninggalan Patch 2 —
 * resep lama vs baru belum tentu semua udah di-resave pakai Satuan Dasar):
 *   - lama (pre-Patch 2): { rawMaterialId, qtyUsed, snapshotPrice }
 *                         -> pakai material.price (satuan lama, bebas)
 *   - baru (Patch 2+):    { rawMaterialId, qty, snapshotBasePrice }
 *                         -> pakai material.basePrice (per Satuan Dasar)
 * Fallback ke snapshot kalau rawMaterial-nya udah kehapus/gak ketemu.
 *
 * Sengaja gak nyoba convert lama<->baru dalam satu baris ingredient — satu
 * resep isinya SELALU salah satu bentuk aja (ditentukan pas resep itu
 * TERAKHIR kali disimpan lewat form), gak akan campur dalam array yang sama.
 * Ini dipakai di LibraryHppView & availableMaterials (App.jsx) biar logic
 * "cara baca 1 baris ingredient" cuma ada di SATU tempat.
 */
export const computeLiveIngredientsCost = (ingredients, materials) => {
  return (ingredients || []).reduce((sum, ing) => {
    const material = (materials || []).find(m => m.id === ing.rawMaterialId);

    if (ing.qty !== undefined) {
      const price = (material && material.basePrice !== null && material.basePrice !== undefined)
        ? material.basePrice
        : (ing.snapshotBasePrice || 0);
      return sum + ((Number(price) || 0) * (Number(ing.qty) || 0));
    }

    // Bentuk lama: hppLibrary pakai field `qtyUsed`, semiFinished pakai
    // `qtyUsedFraction` — dua nama beda buat konsep yang sama (qty dalam
    // satuan LAMA si rawMaterial), jadi dicek dua-duanya di sini biar 1
    // fungsi ini aman dipakai buat resep MAUPUN prep.
    const legacyQty = ing.qtyUsed !== undefined ? ing.qtyUsed : ing.qtyUsedFraction;
    const price = material ? material.price : ing.snapshotPrice;
    return sum + ((Number(price) || 0) * (Number(legacyQty) || 0));
  }, 0);
};

/**
 * Gabungin rawMaterials + semiFinished (Bahan Prep) jadi satu pool
 * "availableMaterials" yang dipakai sebagai daftar pilihan ingredient di
 * KalkulatorHppView & BahanSetengahJadiView. Prep dianggap punya Satuan
 * Dasar sendiri (baseUnit/basePrice terisi, bisa dipilih jadi ingredient v2
 * di resep lain) HANYA kalau resultUnit-nya udah salah satu dari BASE_UNITS.
 *
 * DULU logic ini ke-duplikat persis di App.jsx & HppView.jsx (dua provider
 * terpisah yang masing-masing manggil usePersistState('rawMaterials', ...)
 * sendiri — cuma salah satu yang aktif tergantung tab yang lagi dibuka).
 * Diekstrak ke sini biar cuma ada SATU tempat yang perlu diubah kalau
 * definisi "material yang tersedia" berubah lagi nanti.
 */
export const computeAvailableMaterials = (rawMaterials, semiFinished) => {
  const prepsAsMaterials = (semiFinished || []).map(prep => {
    const totalIngCost = computeLiveIngredientsCost(prep.ingredients, rawMaterials);
    const totalBatchCost = totalIngCost + (Number(prep.laborCost) || 0) + (Number(prep.overheadCost) || 0);
    const costPerUnit = totalBatchCost / Math.max(1, Number(prep.yieldQty) || 1);
    const isBaseUnitReady = BASE_UNITS.includes(prep.resultUnit);

    return {
      id: prep.id,
      name: `${prep.name} [Prep]`,
      unit: prep.resultUnit,
      price: costPerUnit,
      baseUnit: isBaseUnitReady ? prep.resultUnit : null,
      basePrice: isBaseUnitReady ? costPerUnit : null,
      isPrep: true,
      lastUpdated: prep.lastUpdated || new Date(),
      deletedAt: prep.deletedAt,
    };
  });

  return [...(rawMaterials || []), ...prepsAsMaterials];
};

export const getIngredientCost = (ing) => {
  const price = Number(ing.price) || 0;
  const qty = Number(ing.qtyUsed) || 1;
  const u1 = (ing.unit || '').toLowerCase().trim();
  const u2 = (ing.recipeUnit || ing.unit || '').toLowerCase().trim();

  if (u1 === u2 || !u1 || !u2) {
    return price * qty;
  }
  
  if (u1 === 'kg' && (u2 === 'gram' || u2 === 'g')) return (price / 1000) * qty;
  if (u1 === 'liter' && (u2 === 'ml' || u2 === 'mili')) return (price / 1000) * qty;
  if (u1 === 'ekor' && u2 === 'potong') return (price / 8) * qty;
  if ((u1 === 'gram' || u1 === 'g') && u2 === 'kg') return (price * 1000) * qty;
  if (u1 === 'ml' && u2 === 'liter') return (price * 1000) * qty;
  
  return price * qty;
};