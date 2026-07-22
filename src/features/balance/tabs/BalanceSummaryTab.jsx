import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scale, Warehouse, ShoppingCart, TrendingUp, Users,
  RefreshCw, AlertTriangle, Package, Receipt, Lock
} from 'lucide-react';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, Badge, EmptyState } from '../../../components/ui';
import { useAppContext } from '../../../context/AppContext';
import { getBalanceSummary } from '../balance';
import { formatPeriodLabel } from '../periodUtils';
import { fetchStokAwal, fetchStokAkhirIfExists, generateStokAkhir } from '../stockOpnameLogic';

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
  const { salesHistory, expenses, employeeDailyRecords, employees, rawMaterials, triggerAlert } = useAppContext();

  const [stokAwal, setStokAwal] = useState(null);       // { available, period, totalValue, itemCount, generatedAt } | null (masih loading)
  const [stokAkhir, setStokAkhir] = useState(null);      // snapshot lengkap | null (belum ada)
  const [isLoadingStok, setIsLoadingStok] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Muat ulang Stok Awal (snapshot bulan lalu) & Stok Akhir (kalau sudah
  // pernah digenerate sebelumnya untuk periode ini) setiap `period` ganti.
  const loadStok = useCallback(async () => {
    setIsLoadingStok(true);
    setLoadError(null);
    try {
      const [awal, akhir] = await Promise.all([
        fetchStokAwal(period),
        fetchStokAkhirIfExists(period),
      ]);
      setStokAwal(awal);
      setStokAkhir(akhir);
    } catch (err) {
      console.error('[BalanceSummaryTab] gagal memuat data stok opname:', err);
      setLoadError(err.message || 'Gagal memuat data stok opname.');
    } finally {
      setIsLoadingStok(false);
    }
  }, [period]);

  useEffect(() => {
    loadStok();
  }, [loadStok]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateStokAkhir(period, rawMaterials);
      setStokAkhir(result);
    } catch (err) {
      console.error('[BalanceSummaryTab] gagal generate stok akhir:', err);
      triggerAlert?.(err.message || 'Gagal mengambil & generate data stok akhir.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Penghasilan (salesHistory), Belanja Bahan Baku/Biaya Operasional
  // (expenses), dan Biaya Gaji (employeeDailyRecords + expenses kasbon)
  // dihitung dari data ASLI lewat balance.js. Stok Awal/Stok Akhir sekarang
  // juga data ASLI dari stockOpnameLogic.js (bukan mock lagi).
  const ringkasan = useMemo(() => {
    return getBalanceSummary(salesHistory, expenses, employeeDailyRecords, employees, period, {
      stokAwalValue: stokAwal?.totalValue || 0,
      stokAkhirValue: stokAkhir ? stokAkhir.totalValue : 0,
    });
  }, [salesHistory, expenses, employeeDailyRecords, employees, period, stokAwal, stokAkhir]);

  // Hasil akhir (HPP/Laba Kotor/Laba Bersih) hanya ditampilkan kalau stok
  // akhir bulan ini SUDAH di-generate & dikunci — sebelum itu, HPP belum
  // punya makna (stok akhir belum diketahui).
  const hasil = stokAkhir ? ringkasan : null;

  if (isLoadingStok) {
    return (
      <Card padding="lg" className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-sm py-10">
        <RefreshCw className="w-4 h-4 animate-spin" /> Memuat data stok opname...
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-400" />}
          title="Gagal memuat data stok opname"
          description={loadError}
        />
        <div className="flex justify-center mt-3">
          <Button size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadStok}>
            Coba Lagi
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* ── STOK AWAL vs STOK AKHIR ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Stok Awal — otomatis dari snapshot bulan lalu (stock_opname_bulanan) */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Stok Awal Bulan</h3>
            </div>
            {stokAwal?.available && (
              <Badge variant="neutral">Dari opname {stokAwal.period}</Badge>
            )}
          </div>

          {!stokAwal?.available ? (
            <>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
                {formatRupiah(0)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Belum ada snapshot stok opname bulan {stokAwal?.period}. Stok Awal dianggap Rp 0 — HPP bulan ini kemungkinan belum akurat sampai histori tersedia.
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
                {formatRupiah(stokAwal.totalValue)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {stokAwal.itemCount} item &middot; digenerate {new Date(stokAwal.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}
        </Card>

        {/* Stok Akhir — di-generate dari stock_checklists (mamam-absensi) */}
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
                {stokAkhir.sourceDateStr && <> &middot; sumber checklist {stokAkhir.sourceDateStr}</>}
              </p>
              {stokAkhir.unmatchedCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {stokAkhir.unmatchedCount} item belum ter-link ke Database Bahan Baku, tidak ikut terhitung
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Mengambil data...' : 'Generate Ulang'}
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* ── DETAIL ITEM STOK AKHIR (kalau sudah generate) ──────────────── */}
      {stokAkhir && stokAkhir.items.length > 0 && (
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

      {/* ── ITEM YANG BELUM TER-LINK (kalau ada) ────────────────────────── */}
      {stokAkhir && stokAkhir.unmatchedItems?.length > 0 && (
        <Card padding="lg" className="mb-6 border-amber-200 dark:border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">
              Item Checklist Belum Ter-link ke Database Bahan Baku
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
            Nama item ini ada isian qty di checklist stok, tapi namanya tidak persis sama dengan nama bahan baku manapun di menu Bahan Baku — jadi tidak ikut dihitung ke HPP. Samakan nama lalu tekan "Generate Ulang" di atas.
          </p>
          <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
            {stokAkhir.unmatchedItems.map((it, idx) => (
              <li key={idx} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                <span className="font-semibold">{it.name}</span>
                <span className="text-slate-500 dark:text-slate-400">{it.qty} {it.unit}</span>
              </li>
            ))}
          </ul>
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
            HPP = Stok Awal ({formatRupiah(stokAwal?.totalValue || 0)}) + Belanja Bahan Baku ({formatRupiah(ringkasan.belanjaBahanBaku)}) − Stok Akhir ({formatRupiah(stokAkhir.totalValue)}).
            Laba Bersih = Laba Kotor − Biaya Operasional − Biaya Gaji ({formatRupiah(ringkasan.biayaGaji)}). Kasbon karyawan tidak dihitung sebagai biaya di mana pun.
          </p>
        </Card>
      )}
    </div>
  );
};

export default BalanceSummaryTab;