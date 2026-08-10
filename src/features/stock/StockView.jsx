import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Warehouse, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Calendar, PencilLine, Plus, Trash2 } from 'lucide-react';
import { Card, Badge, EmptyState, Button, PageHeader, IconButton } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { formatRupiah, toLocalMonthString, toLocalDateString } from '../../utils/formatters';
import { formatPeriodLabel } from '../balance/periodUtils';
import { getSupabaseClient } from '../../storage/syncClient';
import { markDeleted } from '../../utils/softDelete';
import { fetchStockMaster, fetchChecklistsInMonth, valuateChecklist } from './stockChecklistApi';
import StockCorrectionModal from './StockCorrectionModal';

// Stok Opname — browse hasil checklist stok bulanan (punya mamam-absensi,
// tabel stock_checklists) dengan rincian per hari + koreksi manual (punya
// mamam-global sendiri, tabel app_config key='stockOpnameCorrections').
// Beda dari tab Ringkasan di Laba Rugi (yang cuma ambil 1 titik valuasi
// buat Stok Awal/Akhir), di sini SEMUA hari yang ada checklist-nya
// ditampilkan sekaligus untuk dilihat historinya.
//
// Data mentah (`rawChecklists`/`master`) dipisah dari hasil valuasi
// (`dailyRows`) SENGAJA: fetch jaringan cuma perlu diulang kalau `period`
// ganti, sementara valuasi (yang gampang & murah dihitung ulang di client)
// otomatis refresh tiap `rawMaterials` ATAU `stockOpnameCorrections`
// berubah — tanpa perlu fetch ulang ke server tiap kali user nyimpen 1
// koreksi.
const StockView = () => {
  const { rawMaterials, stockOpnameCorrections, setStockOpnameCorrections, triggerAlert, triggerConfirm } = useAppContext();
  const [period, setPeriod] = useState(toLocalMonthString());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawChecklists, setRawChecklists] = useState([]);
  const [master, setMaster] = useState({ categories: [] });
  const [expandedDate, setExpandedDate] = useState(null);
  const [correctionTarget, setCorrectionTarget] = useState(null); // { dateStr, prefill } | null -> modal terbuka kalau diisi

  // Race guard: `load` bisa ke-trigger ulang kalau `period` ganti sebelum
  // request sebelumnya selesai. Request lama yang telat resolve HARUS
  // dibuang, bukan menimpa data yang lebih baru.
  const loadEpochRef = useRef(0);

  const load = useCallback(async () => {
    const epoch = ++loadEpochRef.current;
    setIsLoading(true);
    setError(null);
    setExpandedDate(null);
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Koneksi Supabase belum siap, coba lagi sebentar.');

      const [checklists, fetchedMaster] = await Promise.all([
        fetchChecklistsInMonth(supabase, period),
        fetchStockMaster(supabase),
      ]);
      if (loadEpochRef.current !== epoch) return; // ada trigger baru selagi nunggu, buang hasil basi ini

      setRawChecklists(checklists);
      setMaster(fetchedMaster);
    } catch (err) {
      if (loadEpochRef.current !== epoch) return;
      console.error('[StockView] gagal memuat data stok opname bulanan:', err);
      setError(err.message || 'Gagal memuat data stok opname.');
    } finally {
      if (loadEpochRef.current === epoch) setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  // Valuasi murni client-side dari data yang udah di-fetch -> refresh
  // otomatis & instan tiap rawMaterials (harga/Satuan Dasar berubah) atau
  // stockOpnameCorrections (koreksi baru disimpan/dihapus) berubah, tanpa
  // fetch ulang ke server.
  const dailyRows = useMemo(() => {
    if (rawChecklists.length === 0 && !master.categories?.length) return [];

    const byDate = new Map(rawChecklists.map(row => [row.date_str, row]));
    const [y, m] = period.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = period === toLocalMonthString();
    const lastDay = isCurrentMonth ? Number(toLocalDateString().slice(8, 10)) : daysInMonth;

    const rows = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${period}-${String(d).padStart(2, '0')}`;
      const row = byDate.get(dateStr);
      rows.push({
        dateStr,
        valuation: row ? valuateChecklist(row, master, rawMaterials || [], stockOpnameCorrections) : null,
      });
    }
    return rows.reverse(); // terbaru di atas, lebih enak di-scroll dari HP
  }, [rawChecklists, master, period, rawMaterials, stockOpnameCorrections]);

  const summary = useMemo(() => {
    const filled = dailyRows.filter(r => r.valuation).length;
    return { totalDays: dailyRows.length, filledDays: filled };
  }, [dailyRows]);

  const openCorrectionModal = (dateStr, prefill = null) => setCorrectionTarget({ dateStr, prefill });
  const closeCorrectionModal = () => setCorrectionTarget(null);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out custom-scrollbar">
      <PageHeader
        title="Stok Opname"
        subtitle={!isLoading && !error ? `${summary.filledDays} dari ${summary.totalDays} hari ada checklist tersubmit \u2014 ${formatPeriodLabel(period)}` : formatPeriodLabel(period)}
        icon={<Warehouse className="w-6 h-6" />}
        action={
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        }
      />

      {isLoading ? (
        <Card padding="lg" className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-sm py-10">
          <RefreshCw className="w-4 h-4 animate-spin" /> Memuat data stok opname...
        </Card>
      ) : error ? (
        <Card padding="lg">
          <EmptyState icon={<AlertTriangle className="w-8 h-8 text-red-400" />} title="Gagal memuat data stok opname" description={error} />
          <div className="flex justify-center mt-3">
            <Button size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Coba Lagi</Button>
          </div>
        </Card>
      ) : dailyRows.length === 0 ? (
        <EmptyState icon={<Calendar className="w-8 h-8" />} title="Belum ada hari untuk ditampilkan" description="Pilih bulan lain." />
      ) : (
        <div className="space-y-2 pb-10">
          {dailyRows.map(({ dateStr, valuation }) => {
            const isExpanded = expandedDate === dateStr;
            return (
              <Card key={dateStr} padding="none" className="overflow-hidden">
                <button
                  onClick={() => valuation && setExpandedDate(isExpanded ? null : dateStr)}
                  className={`w-full flex items-center justify-between gap-3 p-3.5 text-left ${valuation ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50' : 'cursor-default'} transition-colors duration-200`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100 shrink-0">
                      {new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {valuation ? (
                      <Badge variant="success">{valuation.itemCount} item</Badge>
                    ) : (
                      <Badge variant="neutral">Tidak ada checklist</Badge>
                    )}
                    {valuation?.unmatchedCount > 0 && (
                      <Badge variant="warning">{valuation.unmatchedCount} belum ter-link</Badge>
                    )}
                    {valuation?.unitMismatchCount > 0 && (
                      <Badge variant="warning">{valuation.unitMismatchCount} satuan gak cocok</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {valuation && <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{formatRupiah(valuation.totalValue)}</span>}
                    {valuation && (isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
                  </div>
                </button>

                {isExpanded && valuation && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <th className="p-3 font-bold">Bahan</th>
                            <th className="p-3 font-bold">Qty</th>
                            <th className="p-3 font-bold text-right">Subtotal</th>
                            <th className="p-3 font-bold text-center">Koreksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                          {valuation.items.map(it => (
                            <tr key={it.rawMaterialId} className={it.isCorrected ? 'bg-accent-50/40 dark:bg-accent-500/5' : ''}>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                                {it.name} {it.isCorrected && <Badge variant="orange" size="sm" className="ml-1.5">Terkoreksi</Badge>}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{it.qty} {it.unit}</td>
                              <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatRupiah(it.subtotal)}</td>
                              <td className="p-3 text-center">
                                <IconButton variant="edit" ghost onClick={() => openCorrectionModal(dateStr, { rawMaterialId: it.rawMaterialId, name: it.name })}>
                                  <PencilLine className="w-3.5 h-3.5" />
                                </IconButton>
                              </td>
                            </tr>
                          ))}
                          {valuation.unmatchedItems.map((it, idx) => (
                            <tr key={`u${idx}`} className="bg-amber-50/50 dark:bg-amber-500/5">
                              <td className="p-3 font-bold text-amber-700 dark:text-amber-400">{it.name} <span className="font-normal text-[10px]">(belum ter-link)</span></td>
                              <td className="p-3 text-amber-700 dark:text-amber-400">{it.qty} {it.unit}</td>
                              <td className="p-3 text-right text-amber-700 dark:text-amber-400">&mdash;</td>
                              <td className="p-3 text-center">
                                <IconButton variant="edit" ghost onClick={() => openCorrectionModal(dateStr, null)}>
                                  <PencilLine className="w-3.5 h-3.5" />
                                </IconButton>
                              </td>
                            </tr>
                          ))}
                          {valuation.unitMismatchItems.map((it, idx) => (
                            <tr key={`m${idx}`} className="bg-amber-50/50 dark:bg-amber-500/5">
                              <td className="p-3 font-bold text-amber-700 dark:text-amber-400">
                                {it.name} <span className="font-normal text-[10px]">(satuan "{it.unit || '-'}" gak cocok{it.materialBaseUnit ? ` dgn Satuan Dasar (${it.materialBaseUnit})` : ', bahan belum ada Satuan Dasar'})</span>
                              </td>
                              <td className="p-3 text-amber-700 dark:text-amber-400">{it.qty} {it.unit}</td>
                              <td className="p-3 text-right text-amber-700 dark:text-amber-400">&mdash;</td>
                              <td className="p-3 text-center">
                                <IconButton variant="edit" ghost onClick={() => openCorrectionModal(dateStr, { rawMaterialId: it.rawMaterialId, name: it.name })}>
                                  <PencilLine className="w-3.5 h-3.5" />
                                </IconButton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                      <Button size="xs" variant="ghost" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openCorrectionModal(dateStr, null)}>
                        Tambah Koreksi
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <StockCorrectionModal
        isOpen={!!correctionTarget}
        onClose={closeCorrectionModal}
        dateStr={correctionTarget?.dateStr}
        prefill={correctionTarget?.prefill}
        rawMaterials={rawMaterials}
        corrections={stockOpnameCorrections}
        setCorrections={setStockOpnameCorrections}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
      />
    </div>
  );
};

export default StockView;
