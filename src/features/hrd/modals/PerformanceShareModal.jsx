import React from "react";
import { Share2, X, Clock, CalendarCheck, AlarmClockOff, TrendingUp } from "lucide-react";
import { useAppContext } from "../../../context/AppContext";
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { pdf } from '@react-pdf/renderer';
import PerformanceSharePDFDocument from './PerformanceSharePDFDocument';

const MiniKpi = ({ icon, label, value, tone = 'default' }) => {
  const toneClass = {
    default: 'text-slate-800 dark:text-slate-100',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-500 dark:text-red-400',
    orange: 'text-accent-600 dark:text-accent-400',
  }[tone];
  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 py-2.5">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">{icon} {label}</p>
      <p className={`text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
};

const PerformanceShareModal = () => {
  const { perfShareModal, setPerfShareModal, formatRupiah } = useAppContext();
  if (!perfShareModal.isOpen || !perfShareModal.data) return null;
  const { data: p, rangeLabel } = perfShareModal;

  const fmtJam = (n) => `${Number(n || 0).toFixed(1).replace('.', ',')} Jam`;

  const handleSharePDF = async () => {
    try {
      const blob = await pdf(
        <PerformanceSharePDFDocument p={p} rangeLabel={rangeLabel} formatRupiah={formatRupiah} />
      ).toBlob();

      // Sanitasi nama file — rangeLabel bisa mengandung karakter ILEGAL buat
      // nama file/path, terutama "/" (dari "s/d") dan "," (dari format
      // tanggal "Jum, 17 Jul 2026"). Kalau "/" lolos, Capacitor Filesystem
      // membacanya sebagai path separator dan gagal nulis file (app crash
      // saat share). Jadi buang semua karakter selain huruf/angka/spasi/-/_,
      // baru whitespace diganti "-".
      const fileName = `laporan-kinerja-${p.employee.name}-${rangeLabel}.pdf`
        .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      if (Capacitor.isNativePlatform()) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Laporan Kinerja',
          text: `Laporan kinerja ${p.employee.name} - ${rangeLabel}`,
          url: savedFile.uri,
          dialogTitle: 'Bagikan Laporan Kinerja via',
        });
      } else {
        // Web: pakai Web Share API kalau tersedia (bisa langsung share ke WA
        // dkk tanpa download manual dulu), fallback ke auto-download PDF.
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Laporan Kinerja',
            text: `Laporan kinerja ${p.employee.name} - ${rangeLabel}`,
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('PDF Error:', error);
      if (error.name !== 'AbortError') {
        alert(`Gagal membuat laporan!\n\nError: ${error.message || JSON.stringify(error)}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-[560px] shadow-2xl relative font-sans text-sm animate-in zoom-in-95 duration-300 ease-out my-8 flex flex-col max-h-[90vh]">

        <button
          type="button"
          onClick={() => setPerfShareModal({ isOpen: false, data: null, rangeLabel: '' })}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors duration-300 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="text-center border-b-2 border-slate-100 dark:border-slate-800 pb-5 mb-5">
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 mb-1">Laporan Kinerja</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">{p.employee.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Periode: {rangeLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <MiniKpi icon={<CalendarCheck className="w-3 h-3" />} label="Hari Masuk" value={`${p.hariMasuk} Hari`} tone="green" />
            <MiniKpi icon={<Clock className="w-3 h-3" />} label="Total Jam Kerja" value={fmtJam(p.totalHours)} />
            <MiniKpi icon={<AlarmClockOff className="w-3 h-3" />} label="Telat" value={`${p.hariTelat} Kali`} tone={p.hariTelat > 0 ? 'red' : 'default'} />
            <MiniKpi icon={<TrendingUp className="w-3 h-3" />} label="Total Lembur" value={p.totalOvertimeMinutes > 0 ? fmtJam(p.totalOvertimeMinutes / 60) : '-'} tone="orange" />
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Upah Pokok</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatRupiah(p.basicPay)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Total Tambahan</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">(+) {formatRupiah(p.totalAdditions)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Total Potongan</span>
              <span className="font-bold text-red-500 dark:text-red-400">(-) {formatRupiah(p.totalDeductions)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
              <span className="font-black text-slate-800 dark:text-slate-100 uppercase">Pendapatan Bersih</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{formatRupiah(p.netPay)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-4">
            Laporan lengkap (termasuk rincian telat & lembur) akan disertakan otomatis di file PDF yang dibagikan.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-b-3xl border-t border-slate-200 dark:border-slate-700 flex gap-4 mt-auto">
          <button onClick={handleSharePDF} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white font-bold shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)] hover:shadow-[0_6px_20px_rgba(var(--color-accent-500),0.4)] hover:-translate-y-0.5 active:scale-[0.98] flex justify-center items-center gap-2 transition-all duration-300">
            <Share2 className="w-5 h-5" /> Bagikan Laporan
          </button>
          <button onClick={() => setPerfShareModal({ isOpen: false, data: null, rangeLabel: '' })} className="flex-1 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-all duration-300">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceShareModal;