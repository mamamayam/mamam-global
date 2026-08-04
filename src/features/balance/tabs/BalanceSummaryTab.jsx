import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Scale, Warehouse, ShoppingCart, TrendingUp, Users,
  RefreshCw, AlertTriangle, Package, Receipt
} from 'lucide-react';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, EmptyState } from '../../../components/ui';
import { useAppContext } from '../../../context/AppContext';
import { getBalanceSummary } from '../balance';
import { formatPeriodLabel } from '../periodUtils';
import { suggestStokAwalDate, suggestStokAkhirDate, computeStockSnapshot } from '../stockOpnameLogic';

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

// Kartu Stok Awal & Stok Akhir sekarang bentuknya sama persis (beda cuma
// label) — keduanya date-picker + tombol "Ambil", bukan lagi 1 otomatis +
// 1 manual seperti versi snapshot lama. Diekstrak jadi 1 komponen supaya
// tidak duplikat.
const StokDateCard = ({ label, dateStr, setDateStr, result, error, isGenerating, onGenerate }) => (
  <Card padding="lg">
    <div className="flex items-center gap-2 mb-3">
      <Warehouse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">{label}</h3>
    </div>

    <div className="flex items-center gap-2 mb-3">
      <input
        type="date"
        value={dateStr}
        onChange={e => setDateStr(e.target.value)}
        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      <Button
        size="sm"
        variant={result ? 'secondary' : 'primary'}
        icon={<RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />}
        onClick={onGenerate}
        disabled={isGenerating || !dateStr}
        className="shrink-0"
      >
        {isGenerating ? 'Memuat...' : result ? 'Ulangi' : 'Ambil'}
      </Button>
    </div>

    {error ? (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {error}
      </div>
    ) : !result ? (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {dateStr ? 'Belum diambil — tekan "Ambil" untuk menghitung.' : 'Belum ada checklist yang bisa disarankan, pilih tanggal manual.'}
      </p>
    ) : (
      <>
        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
          {formatRupiah(result.totalValue)}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {result.itemCount} item &middot; dari checklist {result.dateStr}
        </p>
        {result.unmatchedCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {result.unmatchedCount} item belum ter-link ke Database Bahan Baku, tidak ikut terhitung
          </div>
        )}
      </>
    )}
  </Card>
);

// `period` ("YYYY-MM") diteruskan dari BalanceTab.jsx (shell) supaya
// filter periode tetap sinkron antara tab Ringkasan dan tab Rincian.
const BalanceSummaryTab = ({ period }) => {
  const { salesHistory, expenses, employeeDailyRecords, employees, rawMaterials } = useAppContext();

  const [stokAwalDate, setStokAwalDate] = useState('');
  const [stokAkhirDate, setStokAkhirDate] = useState('');
  const [stokAwal, setStokAwal] = useState(null);     // hasil computeStockSnapshot | null (belum diambil)
  const [stokAkhir, setStokAkhir] = useState(null);
  const [awalError, setAwalError] = useState(null);
  const [akhirError, setAkhirError] = useState(null);
  const [isGeneratingAwal, setIsGeneratingAwal] = useState(false);
  const [isGeneratingAkhir, setIsGeneratingAkhir] = useState(false);

  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(true);
  const [suggestionError, setSuggestionError] = useState(null);

  // Race guard: setiap ganti `period`, epoch di-bump. loadSuggestions &
  // kedua handleGenerate di bawah menangkap epoch saat mereka MULAI, lalu
  // cek lagi SETELAH await selesai — kalau epoch udah beda (user keburu
  // ganti bulan lagi sebelum request lama selesai), hasil yang telat itu
  // DIBUANG, tidak menimpa state. Tanpa ini: ganti bulan cepat-cepat bisa
  // bikin request lama (utk bulan sebelumnya) selesai belakangan dan
  // nimpa data bulan yang sekarang lagi dilihat dengan angka yang salah.
  const periodEpochRef = useRef(0);

  // Setiap `period` ganti: muat SARAN tanggal (checklist terakhir yang
  // tersedia) untuk Stok Awal (bulan lalu) & Stok Akhir (bulan ini), isi
  // ke date-picker sebagai default. Ini cuma saran — user bisa timpa
  // manual sebelum menekan "Ambil". Nilai stok hasil generate sebelumnya
  // direset karena sudah tidak relevan untuk periode baru.
  const loadSuggestions = useCallback(async () => {
    const epoch = ++periodEpochRef.current;
    setIsLoadingSuggestion(true);
    setSuggestionError(null);
    setStokAwal(null);
    setStokAkhir(null);
    setAwalError(null);
    setAkhirError(null);
    // Kalau ada generate yang masih in-flight dari periode sebelumnya,
    // lepas status loading tombolnya sekarang — hasilnya bakal dibuang
    // sendiri lewat pengecekan epoch begitu request itu selesai (lihat
    // handleGenerateAwal/handleGenerateAkhir), tapi tombolnya gak perlu
    // nunggu itu buat balik ke kondisi normal.
    setIsGeneratingAwal(false);
    setIsGeneratingAkhir(false);
    try {
      const [awalDate, akhirDate] = await Promise.all([
        suggestStokAwalDate(period),
        suggestStokAkhirDate(period),
      ]);
      if (periodEpochRef.current !== epoch) return; // period udah ganti lagi, buang hasil basi ini
      setStokAwalDate(awalDate || '');
      setStokAkhirDate(akhirDate || '');
    } catch (err) {
      if (periodEpochRef.current !== epoch) return;
      console.error('[BalanceSummaryTab] gagal memuat saran tanggal stok:', err);
      setSuggestionError(err.message || 'Gagal memuat saran tanggal checklist.');
    } finally {
      if (periodEpochRef.current === epoch) setIsLoadingSuggestion(false);
    }
  }, [period]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleGenerateAwal = async () => {
    const epoch = periodEpochRef.current; // snapshot, BUKAN di-bump — cuma baca epoch periode saat ini
    setIsGeneratingAwal(true);
    setAwalError(null);
    try {
      const result = await computeStockSnapshot(stokAwalDate, rawMaterials);
      if (periodEpochRef.current !== epoch) return; // periode udah ganti selagi nunggu, buang hasil ini
      setStokAwal(result);
    } catch (err) {
      if (periodEpochRef.current !== epoch) return;
      console.error('[BalanceSummaryTab] gagal mengambil data stok awal:', err);
      setAwalError(err.message || 'Gagal mengambil data stok awal.');
      setStokAwal(null);
    } finally {
      if (periodEpochRef.current === epoch) setIsGeneratingAwal(false);
    }
  };

  const handleGenerateAkhir = async () => {
    const epoch = periodEpochRef.current;
    setIsGeneratingAkhir(true);
    setAkhirError(null);
    try {
      const result = await computeStockSnapshot(stokAkhirDate, rawMaterials);
      if (periodEpochRef.current !== epoch) return;
      setStokAkhir(result);
    } catch (err) {
      if (periodEpochRef.current !== epoch) return;
      console.error('[BalanceSummaryTab] gagal mengambil data stok akhir:', err);
      setAkhirError(err.message || 'Gagal mengambil data stok akhir.');
      setStokAkhir(null);
    } finally {
      if (periodEpochRef.current === epoch) setIsGeneratingAkhir(false);
    }
  };

  // Penghasilan (salesHistory), Belanja Bahan Baku/Biaya Operasional
  // (expenses), dan Biaya Gaji (employeeDailyRecords + expenses kasbon)
  // dihitung dari data ASLI lewat balance.js. Stok Awal/Stok Akhir dari
  // stockOpnameLogic.js (live compute dari stock_checklists, lihat catatan
  // di file itu soal trade-off-nya).
  const ringkasan = useMemo(() => {
    return getBalanceSummary(salesHistory, expenses, employeeDailyRecords, employees, period, {
      stokAwalValue: stokAwal?.totalValue || 0,
      stokAkhirValue: stokAkhir ? stokAkhir.totalValue : 0,
    });
  }, [salesHistory, expenses, employeeDailyRecords, employees, period, stokAwal, stokAkhir]);

  // Hasil akhir (HPP/Laba Kotor/Laba Bersih) hanya ditampilkan kalau stok
  // akhir bulan ini SUDAH diambil — sebelum itu, HPP belum punya makna
  // (stok akhir belum diketahui).
  const hasil = stokAkhir ? ringkasan : null;

  if (isLoadingSuggestion) {
    return (
      <Card padding="lg" className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-sm py-10">
        <RefreshCw className="w-4 h-4 animate-spin" /> Memuat saran tanggal stok opname...
      </Card>
    );
  }

  if (suggestionError) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-red-400" />}
          title="Gagal memuat saran tanggal stok opname"
          description={suggestionError}
        />
        <div className="flex justify-center mt-3">
          <Button size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadSuggestions}>
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
        <StokDateCard
          label="Stok Awal Bulan"
          dateStr={stokAwalDate}
          setDateStr={setStokAwalDate}
          result={stokAwal}
          error={awalError}
          isGenerating={isGeneratingAwal}
          onGenerate={handleGenerateAwal}
        />
        <StokDateCard
          label="Stok Akhir Bulan"
          dateStr={stokAkhirDate}
          setDateStr={setStokAkhirDate}
          result={stokAkhir}
          error={akhirError}
          isGenerating={isGeneratingAkhir}
          onGenerate={handleGenerateAkhir}
        />
      </div>

      {/* ── DETAIL ITEM STOK AKHIR (kalau sudah diambil) ────────────────── */}
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
            Nama item ini ada isian qty di checklist stok, tapi namanya tidak persis sama dengan nama bahan baku manapun di menu Bahan Baku — jadi tidak ikut dihitung ke HPP. Samakan nama lalu tekan "Ulangi" di atas.
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
            title="Ambil data stok akhir dulu untuk melihat hasil Laba Rugi"
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
