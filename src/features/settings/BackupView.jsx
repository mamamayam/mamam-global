import { useState, useEffect, useRef } from 'react';
import {
  FileJson, Sheet,
  Upload, FileUp, AlertTriangle, CheckCircle,
  Database, RefreshCw, X, ArrowLeft,
  Calendar, Info, Wifi, WifiOff,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { loadData, saveData, exportAllData } from '../../storage/db';
import { toLocalDateString } from '../../utils/formatters';
import { ALL_KEYS, TRANSACTION_KEYS, CONFIG_KEYS, DATE_FILTERABLE_KEYS } from '../../storage/syncKeys';
import { isSupabaseConfigured, getDeviceId } from '../../storage/syncClient';
import { pushTransactionUpsert, pushConfig } from '../../storage/realtimeSync';

// ── Konstanta ────────────────────────────────────────────────────────────
// ALL_KEYS, TRANSACTION_KEYS, CONFIG_KEYS, DATE_FILTERABLE_KEYS
// sekarang berasal dari storage/syncKeys.js (dipakai bersama dengan sync engine).

// ── Helpers Dexie ─────────────────────────────────────────────────────────

/**
 * Tulis hasil import (JSON backup) ke Dexie, lalu propagate ke Supabase
 * (per-record untuk transaksi, per-key untuk config) supaya device lain
 * ikut menerima data hasil import secara realtime.
 *
 * mode 'replace' : timpa total tiap key dengan data dari file.
 * mode 'merge'   : - array (transaksi): upsert per id (item baru ditambah,
 *                    item dengan id sama di-update, bukan cuma di-skip).
 *                  - objek (config seperti storeSettings/currentShift):
 *                    digabung per-field (existing di-override field yang ada di file).
 */
async function writeAllToDexie(data, mode = 'merge') {
  for (const key of ALL_KEYS) {
    if (!(key in data)) continue;
    const incoming = data[key];

    let finalValue;

    if (mode === 'replace') {
      finalValue = incoming;
    } else if (Array.isArray(incoming)) {
      // mode merge, array transaksi: upsert by id (tambah baru, update yang sudah ada)
      const existing = await loadData(key, []);
      const existingArr = Array.isArray(existing) ? existing : [];
      const merged = [...existingArr];
      for (const item of incoming) {
        const idx = merged.findIndex(e => e.id === item.id);
        if (idx === -1) merged.push(item);
        else merged[idx] = item;
      }
      finalValue = merged;
    } else if (incoming && typeof incoming === 'object') {
      // mode merge, objek config (storeSettings, currentShift, dll): merge per-field
      const existing = await loadData(key, null);
      finalValue = (existing && typeof existing === 'object') ? { ...existing, ...incoming } : incoming;
    } else {
      finalValue = incoming;
    }

    await saveData(key, finalValue);

    // Propagate ke Supabase supaya device lain ikut update (realtime)
    if (TRANSACTION_KEYS.includes(key) && Array.isArray(finalValue)) {
      for (const item of finalValue) pushTransactionUpsert(key, item);
    } else if (CONFIG_KEYS.includes(key)) {
      pushConfig(key, finalValue, 0);
    }
  }
}

function filterByDateRange(data, startDate, endDate) {
  if (!startDate && !endDate) return data;
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end   = endDate   ? new Date(endDate   + 'T23:59:59') : null;
  const result = {};
  for (const key of ALL_KEYS) {
    if (!data[key]) continue;
    const dateField = DATE_FILTERABLE_KEYS[key];
    if (!dateField || !Array.isArray(data[key])) {
      result[key] = data[key];
      continue;
    }
    result[key] = data[key].filter(item => {
      if (!item[dateField]) return false;
      const d = new Date(item[dateField]);
      if (start && d < start) return false;
      if (end   && d > end  ) return false;
      return true;
    });
  }
  return result;
}

/**
 * FIX: Hitung ukuran dari data Dexie, bukan localStorage.
 */
function calcStorageSize(allData) {
  const total = JSON.stringify(allData).length;
  if (total < 1024)    return `${total} B`;
  if (total < 1048576) return `${(total / 1024).toFixed(1)} KB`;
  return `${(total / 1048576).toFixed(1)} MB`;
}

/**
 * FIX: Hitung record dari data Dexie, bukan localStorage.
 */
function calcRecordCount(allData) {
  let count = 0;
  for (const key of ['salesHistory', 'expenses', 'incomes', 'employees']) {
    if (Array.isArray(allData[key])) count += allData[key].length;
  }
  return count;
}

// ── DateRangeModal ───────────────────────────────────────────────────────

function DateRangeModal({ onClose, onConfirm, exportType }) {
  const today        = toLocalDateString();
  const firstOfMonth = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate,   setEndDate  ] = useState(today);
  const [preset,    setPreset   ] = useState('thisMonth');

  const PRESETS = [
    {
      id: 'today', label: 'Hari Ini',
      getRange: () => ({ s: today, e: today }),
    },
    {
      id: 'thisWeek', label: 'Minggu Ini',
      getRange: () => {
        const d = new Date(), day = d.getDay(), mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return { s: toLocalDateString(mon), e: today };
      },
    },
    {
      id: 'thisMonth', label: 'Bulan Ini',
      getRange: () => ({ s: firstOfMonth, e: today }),
    },
    {
      id: 'lastMonth', label: 'Bulan Lalu',
      getRange: () => {
        const d = new Date();
        const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const last  = new Date(d.getFullYear(), d.getMonth(), 0);
        return { s: toLocalDateString(first), e: toLocalDateString(last) };
      },
    },
    {
      id: 'allTime', label: 'Semua Data',
      getRange: () => ({ s: '', e: '' }),
    },
    {
      id: 'custom', label: 'Kustom',
      getRange: () => ({ s: startDate, e: endDate }),
    },
  ];

  function applyPreset(p) {
    setPreset(p.id);
    if (p.id !== 'custom') {
      const { s, e } = p.getRange();
      setStartDate(s);
      setEndDate(e);
    }
  }

  const isAllTime    = preset === 'allTime';
  const hasRange     = !isAllTime && (startDate || endDate);
  const label        = exportType === 'json' ? 'JSON' : 'Excel';
  const confirmStart = isAllTime ? '' : startDate;
  const confirmEnd   = isAllTime ? '' : endDate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ animation: 'slideUp 0.25s ease' }}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-xl">
            {exportType === 'json' ? '📦' : '📊'}
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-slate-50 text-base">Export {label} — Pilih Rentang</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Filter berdasarkan tanggal transaksi</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${preset === p.id
                  ? 'border-orange-500 dark:border-orange-500 bg-orange-500 dark:bg-orange-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-500/40'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              ['Dari Tanggal',    startDate, setStartDate],
              ['Sampai Tanggal', endDate,   setEndDate  ],
            ].map(([lbl, val, set]) => (
              <div key={lbl}>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">{lbl}</p>
                <input
                  type="date"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-400 dark:focus:border-orange-500/50"
                />
              </div>
            ))}
          </div>
        )}

        {hasRange && (
          <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{startDate || '∞'} — {endDate || '∞'}</p>
          </div>
        )}
        {isAllTime && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Semua data tanpa filter tanggal</p>
          </div>
        )}

        <button
          onClick={() => onConfirm(confirmStart, confirmEnd)}
          className="w-full py-4 rounded-xl font-black text-sm bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white shadow-lg shadow-orange-200 transition-all"
        >
          Download {label}
        </button>
      </div>
    </div>
  );
}

// ── ImportModal ──────────────────────────────────────────────────────────

const IMPORT_MODES = [
  { val: 'merge',   label: 'Gabungkan',   desc: 'Tambah ke data ada', icon: '🔗' },
  { val: 'replace', label: 'Timpa Semua', desc: 'Hapus data lama',    icon: '🔄' },
];

function ImportModal({ type, onClose, onConfirm }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file,     setFile    ] = useState(null);
  const [mode,     setMode    ] = useState('merge');

  const label    = type === 'json' ? 'JSON' : 'Excel (.xlsx)';
  const accept   = type === 'json' ? '.json,application/json' : '.xlsx,.xls';
  const fmtBytes = b =>
    b < 1024     ? `${b} B` :
    b < 1048576  ? `${(b / 1024).toFixed(1)} KB` :
    `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ animation: 'slideUp 0.25s ease' }}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-slate-50 text-base">Import dari {label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Pilih file untuk dipulihkan</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files[0]); }}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all
            ${dragOver ? 'border-orange-400 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-500/10' :
              file     ? 'border-green-400 dark:border-green-500/50 bg-green-50 dark:bg-green-500/10'   :
              'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-orange-300 dark:hover:border-orange-500/40'}`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/15 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{fmtBytes(file.size)}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                {dragOver ? 'Lepaskan file di sini' : 'Ketuk untuk pilih file'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">atau seret & lepas file {label}</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => setFile(e.target.files[0])}
        />

        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Mode Import</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {IMPORT_MODES.map(({ val, label: l, desc, icon }) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={`p-3 rounded-xl border-2 text-left transition-all
                ${mode === val
                  ? 'border-orange-500 dark:border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            >
              <p className="text-base mb-1">{icon}</p>
              <p className={`font-bold text-xs ${mode === val ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-200'}`}>{l}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
            </button>
          ))}
        </div>

        {mode === 'replace' && (
          <div className="flex gap-2 items-start bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">
              Mode <strong>Timpa Semua</strong> akan menghapus seluruh data yang ada.
            </p>
          </div>
        )}

        <button
          onClick={() => file && onConfirm(file, mode)}
          disabled={!file}
          className={`w-full py-4 rounded-xl font-black text-sm transition-all
            ${file
              ? 'bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white shadow-lg shadow-orange-200'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
        >
          {file ? `Import ${label}` : 'Pilih file terlebih dahulu'}
        </button>
      </div>
    </div>
  );
}

// ── ActionItem ───────────────────────────────────────────────────────────

function ActionItem({ icon: Icon, label, sublabel, onClick, loading, done, iconBgClass, iconColorClass, badge }) {
  return (
    <button
      onClick={loading || done ? undefined : onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
        ${done    ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10' :
          loading ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10' :
          'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-200 dark:hover:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/10'}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-green-100 dark:bg-green-500/15' : iconBgClass}`}>
        {loading
          ? <RefreshCw className="w-5 h-5 text-orange-500 dark:text-orange-400 animate-spin" />
          : done
            ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            : <Icon className={`w-5 h-5 ${iconColorClass}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{label}</p>
          {badge && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5">
          {loading
            ? <span className="text-orange-500 dark:text-orange-400 font-semibold">Memproses...</span>
            : done
              ? <span className="text-green-600 dark:text-green-400 font-semibold">Selesai</span>
              : <span className="text-slate-400 dark:text-slate-500">{sublabel}</span>
          }
        </p>
      </div>
      {!loading && !done && <span className="text-slate-300 dark:text-slate-600 text-xl font-bold">›</span>}
    </button>
  );
}

// ── BackupView ───────────────────────────────────────────────────────────

const BackupView = ({ onBack }) => {
  const [loadingState,    setLoadingState  ] = useState({});
  const [doneState,       setDoneState     ] = useState({});
  const [toast,           setToast         ] = useState(null);
  const [importModal,     setImportModal   ] = useState(null);
  const [dateRangeModal,  setDateRangeModal] = useState(null);

  // FIX: storageSize & recordCount sekarang dihitung dari Dexie secara async
  const [storageSize,  setStorageSize ] = useState('Menghitung...');
  const [recordCount,  setRecordCount ] = useState('...');

  // Status koneksi realtime ke Supabase (push per-record sudah otomatis
  // ditangani oleh usePersistState; di sini hanya tampilan status saja)
  const realtimeConfigured = isSupabaseConfigured();
  const deviceId = getDeviceId();

  const lastBackup = localStorage.getItem('mamam_last_backup') || 'Belum pernah';

  // FIX: Load stats dari Dexie saat mount
  useEffect(() => {
    exportAllData().then(allData => {
      setStorageSize(calcStorageSize(allData));
      setRecordCount(calcRecordCount(allData));
    });
  }, []);

  // ── helpers ─────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function startAction(key, delay, successMsg, action) {
    if (loadingState[key] || doneState[key]) return;
    setLoadingState(s => ({ ...s, [key]: true }));
    setTimeout(async () => {
      try {
        await action?.();
        setDoneState(s => ({ ...s, [key]: true }));
        showToast(successMsg);
        if (['exportJson', 'exportExcel'].includes(key)) {
          localStorage.setItem('mamam_last_backup', new Date().toLocaleString('id-ID'));
        }
        setTimeout(() => setDoneState(s => ({ ...s, [key]: false })), 3000);
      } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
      } finally {
        setLoadingState(s => ({ ...s, [key]: false }));
      }
    }, delay);
  }

  // ── handlers ────────────────────────────────────────────────────────────

  function handleExportJsonWithRange(startDate, endDate) {
    setDateRangeModal(null);
    const tag = startDate && endDate ? `${startDate}_${endDate}` : 'semua';
    const filename = `backup-mamam-${tag}.json`;

    startAction('exportJson', 300, Capacitor.isNativePlatform() ? 'Membuka menu simpan...' : 'File JSON berhasil diunduh!', async () => {
      // FIX: baca dari Dexie, bukan localStorage
      const raw  = await exportAllData();
      const data = filterByDateRange(raw, startDate, endDate);
      const jsonString = JSON.stringify(data, null, 2);

      if (Capacitor.isNativePlatform()) {
        const base64Data = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
          return String.fromCharCode(parseInt(p1, 16));
        }));
        const fileResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });
        await Share.share({
          title: filename,
          url: fileResult.uri,
          dialogTitle: 'Simpan / Bagikan Backup JSON'
        });
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: filename }).click();
        URL.revokeObjectURL(url);
      }
    });
  }

  function handleExportExcelWithRange(startDate, endDate) {
    setDateRangeModal(null);
    const tag = startDate && endDate ? `${startDate}_${endDate}` : 'semua';
    const filename = `laporan-mamam-${tag}.xlsx`;

    startAction('exportExcel', 400, Capacitor.isNativePlatform() ? 'Membuka menu simpan...' : 'File Excel berhasil diunduh!', async () => {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      // FIX: baca dari Dexie, bukan localStorage
      const raw  = await exportAllData();
      const data = filterByDateRange(raw, startDate, endDate);
      const wb   = XLSX.utils.book_new();
      const sheetMap = {
        salesHistory:         'Riwayat Penjualan',
        expenses:             'Pengeluaran',
        incomes:              'Pemasukan',
        employees:            'Karyawan',
        employeeDailyRecords: 'Absensi',
        shiftHistory:         'Riwayat Shift',
        customers:            'Pelanggan',
      };
      for (const [key, name] of Object.entries(sheetMap)) {
        if (data[key]?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data[key]), name);
      }
      if (startDate || endDate) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
          Dari:         startDate || 'Awal data',
          Sampai:       endDate   || 'Sekarang',
          DiExportPada: new Date().toLocaleString('id-ID'),
        }]), 'Info Export');
      }

      if (Capacitor.isNativePlatform()) {
        const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });
        await Share.share({
          title: filename,
          url: fileResult.uri,
          dialogTitle: 'Simpan / Bagikan Laporan Excel'
        });
      } else {
        XLSX.writeFile(wb, filename);
      }
    });
  }

  function handleImportConfirm(file, mode) {
    setImportModal(null);
    startAction('importJson', 200, 'Data berhasil diimpor!', async () => {
      // FIX: tulis ke Dexie + propagate ke Supabase (realtime), bukan localStorage
      await writeAllToDexie(JSON.parse(await file.text()), mode);
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  // ── render ───────────────────────────────────────────────────────────────

  const STATUS_ROWS = [
    { label: 'Backup terakhir',        value: lastBackup },
    { label: 'Total record',           value: `±${recordCount} data` },
    { label: 'Ukuran tersimpan',       value: storageSize },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl whitespace-nowrap
            ${toast.type === 'error' ? 'bg-red-500 dark:bg-red-600' : 'bg-green-500 dark:bg-green-600'}`}
          style={{ animation: 'fadeInDown 0.2s ease' }}
        >
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {importModal && (
        <ImportModal
          type={importModal}
          onClose={() => setImportModal(null)}
          onConfirm={handleImportConfirm}
        />
      )}
      {dateRangeModal && (
        <DateRangeModal
          exportType={dateRangeModal}
          onClose={() => setDateRangeModal(null)}
          onConfirm={dateRangeModal === 'json' ? handleExportJsonWithRange : handleExportExcelWithRange}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-4 flex items-center gap-3 shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}
        <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-1">
          <Database className="w-6 h-6 text-orange-500 dark:text-orange-400" /> Backup & Restore
        </h2>
        {realtimeConfigured && (
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-full px-3 py-1">
            <span className="w-2 h-2 bg-blue-500 dark:bg-blue-600 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Realtime Sync</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Status Data Lokal</p>
            <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-full px-3 py-0.5">
              ● Aktif
            </span>
          </div>
          <div className="space-y-2">
            {STATUS_ROWS.map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-900 last:border-0">
                <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export */}
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">Export / Backup</p>
          <div className="space-y-2">
            <ActionItem
              icon={FileJson}
              label="Export Data (JSON)"
              sublabel="Backup dengan pilihan rentang tanggal"
              badge="Range"
              onClick={() => setDateRangeModal('json')}
              loading={loadingState['exportJson']}
              done={doneState['exportJson']}
              iconBgClass="bg-orange-50 dark:bg-orange-500/10"
              iconColorClass="text-orange-500 dark:text-orange-400"
            />
            <ActionItem
              icon={Sheet}
              label="Export ke Excel"
              sublabel="Laporan transaksi dengan filter tanggal"
              badge="Range"
              onClick={() => setDateRangeModal('excel')}
              loading={loadingState['exportExcel']}
              done={doneState['exportExcel']}
              iconBgClass="bg-green-50 dark:bg-green-500/10"
              iconColorClass="text-green-600 dark:text-green-400"
            />
          </div>
        </div>

        {/* Realtime Sync Status */}
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">Cloud Sync — Supabase</p>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Sinkronisasi Realtime</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {realtimeConfigured
                    ? 'Aktif — perubahan tersinkron otomatis ke semua device'
                    : 'Belum dikonfigurasi (.env Supabase belum diisi)'}
                </p>
              </div>
              {realtimeConfigured
                ? <Wifi className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                : <WifiOff className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              }
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2">
              <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ID Device ini: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{deviceId.slice(0, 8)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Import */}
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">Import / Restore</p>
          <ActionItem
            icon={FileUp}
            label="Import dari JSON"
            sublabel="Pulihkan data dari file backup"
            onClick={() => setImportModal('json')}
            loading={loadingState['importJson']}
            done={doneState['importJson']}
            iconBgClass="bg-orange-50 dark:bg-orange-500/10"
            iconColorClass="text-orange-500 dark:text-orange-400"
          />
        </div>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
};

export default BackupView;