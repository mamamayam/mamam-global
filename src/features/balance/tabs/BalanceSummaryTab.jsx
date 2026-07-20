import React, { useState, useMemo } from 'react';
import {
  Scale, Warehouse, ShoppingCart, TrendingUp, Users,
  RefreshCw, AlertTriangle, Package, Receipt, Lock
} from 'lucide-react';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, Badge, EmptyState } from '../../../components/ui';
import { useAppContext } from '../../../context/AppContext';
import { getBalanceSummary } from '../balance';
import { formatPeriodLabel } from '../periodUtils';

/* ─────────────────────────────────────────────────────────────────────────
   Sisi Stok Opname MASIH MOCK — menyusul di tahap berikutnya
   (stockOpnameLogic.js: fetch stock_checklists dari mamam-absensi +
   valuasi rawMaterials + snapshot ke stock_opname_bulanan).
   Struktur objek ini sengaja dipertahankan sama persis dengan bentuk
   snapshot asli nanti, supaya JSX di bawah tidak perlu berubah banyak
   saat wiring stok yang sebenarnya masuk.
───────────────────────────────────────────────────────────────────────── */

const MOCK_STOK_AWAL = {
  period: '2026-06',
  totalValue: 4_250_000,
  generatedAt: '2026-06-30T20:10:00',
  itemCount: 18,
};

const MOCK_STOK_AKHIR_BELUM_GENERATE = null; // simulasikan belum di-generate

const MOCK_STOK_AKHIR_SUDAH_GENERATE = {
  period: '2026-07',
  totalValue: 3_890_000,
  generatedAt: '2026-07-31T21:05:00',
  itemCount: 19,
  unmatchedCount: 2, // item stock opname yang belum ke-link ke rawMaterials
  items: [
    { rawMaterialId: 'rm-1', name: 'Ayam Potong', qty: 12, unit: 'Ekor', priceSnapshot: 45000, subtotal: 540000 },
    { rawMaterialId: 'rm-2', name: 'Minyak Goreng', qty: 20, unit: 'Liter', priceSnapshot: 21000, subtotal: 420000 },
    { rawMaterialId: 'rm-3', name: 'Beras', qty: 50, unit: 'Kg', priceSnapshot: 14500, subtotal: 725000 },
  ],
};

/* ────────────────────────────────────────────────────────────────────── */

const StatCard = ({ icon, label, value, tone = 'neutral', sub }) => {
  const toneMap = {
    neutral: 'text-slate-700 dark:text-slate-200',
    danger:  'text-red-600 dark:text-red-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    accent:  'text-accent-600 dark:text-accent-400',
  };
  return (
    <Card padding="lg" className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-xl font-black ${toneMap[tone]}`}>{formatRupiah(value)}</span>
      {sub && <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{sub}</span>}
    </Card>
  );
};

// `period` ("YYYY-MM") diteruskan dari BalanceTab.jsx (shell) supaya
// filter periode tetap sinkron antara tab Ringkasan dan tab Rincian.
const BalanceSummaryTab = ({ period }) => {
  const { salesHistory, expenses, employeeDailyRecords, employees } = useAppContext();

  const [stokAkhir, setStokAkhir] = useState(MOCK_STOK_AKHIR_BELUM_GENERATE);
  const [isGenerating, setIsGenerating] = useState(false);

  // TODO(stockOpnameLogic): ganti dengan lookup snapshot periode
  // sebelumnya dari tabel stock_opname_bulanan. Kalau belum ada snapshot
  // bulan lalu, totalValue harus 0 + tampilkan warning ke user, bukan
  // diam-diam pura-pura ada data.
  const stokAwal = MOCK_STOK_AWAL;

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulasi delay fetch dari Supabase (stock_checklists) + valuasi
    setTimeout(() => {
      setStokAkhir(MOCK_STOK_AKHIR_SUDAH_GENERATE);
      setIsGenerating(false);
    }, 900);
  };

  // Penghasilan (salesHistory), Belanja Bahan Baku/Biaya Operasional
  // (expenses), dan Biaya Gaji (employeeDailyRecords + expenses kasbon)
  // sudah dihitung dari data ASLI lewat balance.js. Sisi stok opname
  // (stokAwalValue/stokAkhirValue) masih mock sampai stockOpnameLogic.js
  // selesai — begitu itu jadi, cukup ganti 2 baris di bawah ini.
  const ringkasan = useMemo(() => {
    return getBalanceSummary(salesHistory, expenses, employeeDailyRecords, employees, period, {
      stokAwalValue: stokAwal.totalValue,
      stokAkhirValue: stokAkhir ? stokAkhir.totalValue : 0,
    });
  }, [salesHistory, expenses, employeeDailyRecords, employees, period, stokAwal, stokAkhir]);

  // Hasil akhir (HPP/Laba Kotor/Laba Bersih) hanya ditampilkan kalau stok
  // akhir bulan ini SUDAH di-generate & dikunci — sebelum itu, HPP belum
  // punya makna (stok akhir belum diketahui).
  const hasil = stokAkhir ? ringkasan : null;

  return (
    <div>
      {/* ── STOK AWAL vs STOK AKHIR ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Stok Awal — otomatis dari snapshot bulan lalu */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Stok Awal Bulan</h3>
            </div>
            <Badge variant="neutral">Dari opname {stokAwal.period}</Badge>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
            {formatRupiah(stokAwal.totalValue)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {stokAwal.itemCount} item &middot; digenerate {new Date(stokAwal.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </Card>

        {/* Stok Akhir — perlu di-generate dari mamam-absensi */}
        <Card padding="lg" className={!stokAkhir ? 'border-dashed' : ''}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Stok Akhir Bulan</h3>
            </div>
            {stokAkhir && (
              <Badge variant="success" dot>
                <Lock className="w-2.5 h-2.5" /> Terkunci
              </Badge>
            )}
          </div>

          {!stokAkhir ? (
            <div className="flex flex-col items-center text-center py-2 gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Belum ada snapshot untuk periode ini. Ambil data stok opname akhir bulan dari <span className="font-semibold">Mamam Absensi</span>.
              </p>
              <Button
                size="sm"
                icon={isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Mengambil data...' : 'Ambil & Generate Stok Akhir'}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
                {formatRupiah(stokAkhir.totalValue)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                {stokAkhir.itemCount} item &middot; dikunci {new Date(stokAkhir.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              {stokAkhir.unmatchedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {stokAkhir.unmatchedCount} item belum ter-link ke Database Bahan Baku, tidak ikut terhitung
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* ── DETAIL ITEM STOK AKHIR (kalau sudah generate) ──────────────── */}
      {stokAkhir && (
        <Card padding="none" className="overflow-hidden mb-6">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">
              Rincian Valuasi Stok Akhir
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3.5 font-bold">Bahan</th>
                  <th className="p-3.5 font-bold">Qty</th>
                  <th className="p-3.5 font-bold">Harga Satuan</th>
                  <th className="p-3.5 font-bold text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {stokAkhir.items.map(it => (
                  <tr key={it.rawMaterialId}>
                    <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">{it.name}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{it.qty} {it.unit}</td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{formatRupiah(it.priceSnapshot)}</td>
                    <td className="p-3.5 text-right font-bold text-slate-800 dark:text-slate-100">{formatRupiah(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── RINGKASAN PENGHASILAN & BIAYA ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Penghasilan" value={ringkasan.penghasilan} tone="success" />
        <StatCard icon={<ShoppingCart className="w-3.5 h-3.5" />} label="Belanja Bahan Baku" value={ringkasan.belanjaBahanBaku} tone="neutral" />
        <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Biaya Gaji" value={ringkasan.biayaGaji} tone="neutral" sub="Upah kotor karyawan, kasbon tidak dihitung" />
        <StatCard icon={<Receipt className="w-3.5 h-3.5" />} label="Biaya Operasional" value={ringkasan.biayaOperasional} tone="neutral" sub="Listrik, sewa, dll (di luar gaji)" />
      </div>

      {/* ── HASIL LABA RUGI ──────────────────────────────────────────────── */}
      {!hasil ? (
        <Card padding="lg">
          <EmptyState
            icon={<Scale className="w-8 h-8 text-slate-300" />}
            title="Generate stok akhir dulu untuk melihat hasil Laba Rugi"
          />
        </Card>
      ) : (
        <Card variant="dark-elevated" padding="lg" className="space-y-4">
          <h4 className="font-black border-b border-slate-800 dark:border-slate-100 pb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-accent-400" /> HASIL LABA RUGI — {formatPeriodLabel(period)}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card variant="dark-muted" padding="lg" className="text-center">
              <span className="block text-[11px] uppercase text-slate-400 font-bold mb-1">HPP (Terpakai)</span>
              <span className="block text-xl font-black text-slate-100">{formatRupiah(hasil.hpp)}</span>
            </Card>
            <Card variant="dark-muted" padding="lg" className="text-center">
              <span className="block text-[11px] uppercase text-slate-400 font-bold mb-1">Laba Kotor</span>
              <span className={`block text-xl font-black ${hasil.labaKotor >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(hasil.labaKotor)}
              </span>
            </Card>
            <Card variant="dark-muted" padding="lg" className="text-center">
              <span className="block text-[11px] uppercase text-slate-400 font-bold mb-1">Laba Bersih</span>
              <span className={`block text-2xl font-black ${hasil.labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(hasil.labaBersih)}
              </span>
            </Card>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            HPP = Stok Awal ({formatRupiah(stokAwal.totalValue)}) + Belanja Bahan Baku ({formatRupiah(ringkasan.belanjaBahanBaku)}) − Stok Akhir ({formatRupiah(stokAkhir.totalValue)}).
            Laba Bersih = Laba Kotor − Biaya Operasional − Biaya Gaji ({formatRupiah(ringkasan.biayaGaji)}). Kasbon karyawan tidak dihitung sebagai biaya di mana pun.
          </p>
        </Card>
      )}
    </div>
  );
};

export default BalanceSummaryTab;