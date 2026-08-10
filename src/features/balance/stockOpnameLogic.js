// features/balance/stockOpnameLogic.js
//
// Stok Awal & Stok Akhir bulan buat Laba Rugi.
//
// PERUBAHAN PENTING (lihat diskusi implementasi "Sidebar & Manajemen
// Menu — refactor" untuk detail): sebelumnya modul ini generate lalu
// MENGUNCI valuasi Stok Akhir ke tabel snapshot terpisah
// (stock_opname_bulanan), dan Stok Awal bulan berjalan dibaca dari
// snapshot bulan lalu itu. Sekarang keduanya dihitung LIVE langsung dari
// stock_checklists tiap kali user menekan tombol generate — TIDAK ada
// lagi tabel snapshot (stock_opname_bulanan sudah di-drop, lihat SQL
// migrasi terlampir).
//
// Konsekuensi dari desain ini, harap dipahami: karena tidak ada lagi
// snapshot yang mengunci harga rawMaterials SAAT itu, generate ulang
// utk bulan lalu akan pakai harga rawMaterials TERBARU (bukan harga
// waktu pertama kali di-generate). Laba Rugi bulan lalu jadi bisa
// berubah kalau di-generate ulang setelah harga bahan baku di-update.
// Trade-off ini sengaja diambil demi kesederhanaan (1 sumber data,
// tanpa lock table terpisah yang perlu dijaga konsistensinya).
//
// Aturan default (bisa selalu ditimpa manual sebelum generate, lihat
// BalanceSummaryTab.jsx):
//   - Stok Awal Bulan X  disarankan dari checklist submitted terakhir
//     yang tersedia di Bulan X-1 (Stok Awal = Stok Akhir bulan lalu).
//   - Stok Akhir Bulan X disarankan dari checklist submitted terakhir
//     yang tersedia DI Bulan X itu sendiri.

import { getSupabaseClient } from '../../storage/syncClient';
import { getPreviousPeriod } from './periodUtils';
import {
  fetchStockMaster,
  valuateChecklist,
  fetchChecklistByDate,
  suggestLastSubmittedDateInMonth,
} from '../stock/stockChecklistApi';

/** Saran tanggal checklist utk Stok Akhir bulan `period` ("YYYY-MM"). */
export async function suggestStokAkhirDate(period) {
  return suggestLastSubmittedDateInMonth(period);
}

/** Saran tanggal checklist utk Stok Awal bulan `period` (= akhir bulan lalu). */
export async function suggestStokAwalDate(period) {
  return suggestLastSubmittedDateInMonth(getPreviousPeriod(period));
}

/**
 * Ambil & valuasi checklist PERSIS di tanggal `dateStr` — dipanggil saat
 * user menekan tombol generate/ambil data (baik pakai tanggal saran
 * maupun tanggal manual yang dia pilih sendiri). Live compute, tidak
 * disimpan ke mana pun.
 *
 * @throws {Error} kalau belum pilih tanggal atau tidak ada checklist di
 *   tanggal itu — supaya UI bisa kasih tahu user dengan jelas, alih-alih
 *   diam-diam menganggap stoknya 0.
 */
export async function computeStockSnapshot(dateStr, rawMaterials, corrections = []) {
  if (!dateStr) {
    throw new Error('Pilih tanggal checklist terlebih dahulu.');
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error('Koneksi Supabase belum siap, coba lagi sebentar.');
  }

  const [row, master] = await Promise.all([
    fetchChecklistByDate(supabase, dateStr),
    fetchStockMaster(supabase),
  ]);

  if (!row) {
    throw new Error(`Tidak ada checklist stok pada tanggal ${dateStr}. Pilih tanggal lain yang ada datanya.`);
  }

  const valuation = valuateChecklist(row, master, rawMaterials || [], corrections);
  return { dateStr, ...valuation };
}
