import { useState, useEffect, useRef } from 'react';
import {
  FileJson, Sheet, CloudUpload,
  Upload, FileUp, AlertTriangle, CheckCircle,
  Database, RefreshCw, X, ArrowLeft,
  Calendar, Info, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ── Konstanta ────────────────────────────────────────────────────────────

const ALL_KEYS = [
  'variantGroups', 'menus', 'salesHistory', 'hppLibrary', 'savedBills',
  'expenseCategories', 'expenses', 'incomeCategories', 'incomes',
  'currentShift', 'shiftHistory', 'customers', 'vouchers', 'claimsHistory',
  'storeSettings', 'rawMaterials', 'semiFinished', 'categories',
  'employees', 'employeeDailyRecords', 'additionCategories', 'deductionCategories',
];

const DATE_FILTERABLE_KEYS = {
  salesHistory:        'date',
  expenses:            'date',
  incomes:             'date',
  shiftHistory:        'startTime',
  employeeDailyRecords:'date',
};

const TRANSACTION_KEYS = ['salesHistory', 'expenses', 'incomes', 'shiftHistory'];

const PREFIX = 'mamam_kasir_';

// ── Helpers localStorage ─────────────────────────────────────────────────

function readAllFromLocalStorage() {
  const result = {};
  for (const key of ALL_KEYS) {
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`);
      if (raw) result[key] = JSON.parse(raw);
    } catch { /* skip invalid entries */ }
  }
  return result;
}

function writeAllToLocalStorage(data, mode = 'merge') {
  for (const key of ALL_KEYS) {
    if (!(key in data)) continue;
    try {
      if (mode === 'replace') {
        localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
      } else {
        const existing = localStorage.getItem(`${PREFIX}${key}`);
        if (!existing) {
          localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
          continue;
        }
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && Array.isArray(data[key])) {
          const merged = [...parsed];
          for (const item of data[key]) {
            if (!merged.find(e => e.id === item.id)) merged.push(item);
          }
          localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(merged));
        } else {
          localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
        }
      }
    } catch { /* skip invalid entries */ }
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

function getStorageSize() {
  let total = 0;
  for (const key of ALL_KEYS) {
    const val = localStorage.getItem(`${PREFIX}${key}`);
    if (val) total += val.length;
  }
  if (total < 1024)    return `${total} B`;
  if (total < 1048576) return `${(total / 1024).toFixed(1)} KB`;
  return `${(total / 1048576).toFixed(1)} MB`;
}

function countRecords() {
  let count = 0;
  for (const key of ['salesHistory', 'expenses', 'incomes', 'employees']) {
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`);
      if (raw) count += JSON.parse(raw).length;
    } catch { /* skip */ }
  }
  return count;
}

// ── Supabase sync ────────────────────────────────────────────────────────

async function syncToSupabase() {
  const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Konfigurasi Supabase belum ada di .env');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const data = readAllFromLocalStorage();
  let totalUpserted = 0;

  for (const key of TRANSACTION_KEYS) {
    const items = data[key];
    if (!items?.length) continue;
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100).map(item => ({ id: item.id, payload: item }));
      const { error } = await supabase.from(key).upsert(batch, { onConflict: 'id' });
      if (error) throw new Error(`Gagal sync ${key}: ${error.message}`);
      totalUpserted += Math.min(100, items.length - i);
    }
  }

  localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
  return totalUpserted;
}

// ── DateRangeModal ───────────────────────────────────────────────────────

function DateRangeModal({ onClose, onConfirm, exportType }) {
  const today        = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);

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
        return { s: mon.toISOString().slice(0, 10), e: today };
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
        return { s: first.toISOString().slice(0, 10), e: last.toISOString().slice(0, 10) };
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
        className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ animation: 'slideUp 0.25s ease' }}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl">
            {exportType === 'json' ? '📦' : '📊'}
          </div>
          <div>
            <p className="font-black text-slate-900 text-base">Export {label} — Pilih Rentang</p>
            <p className="text-xs text-slate-400">Filter berdasarkan tanggal transaksi</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${preset === p.id
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
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
                <p className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{lbl}</p>
                <input
                  type="date"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-orange-400"
                />
              </div>
            ))}
          </div>
        )}

        {hasRange && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 font-semibold">{startDate || '∞'} — {endDate || '∞'}</p>
          </div>
        )}
        {isAllTime && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 font-semibold">Semua data tanpa filter tanggal</p>
          </div>
        )}

        <button
          onClick={() => onConfirm(confirmStart, confirmEnd)}
          className="w-full py-4 rounded-xl font-black text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200 transition-all"
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
  const inputRef = useRef(null);  // fix: pakai useRef, bukan plain object
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
        className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ animation: 'slideUp 0.25s ease' }}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-base">Import dari {label}</p>
            <p className="text-xs text-slate-400">Pilih file untuk dipulihkan</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files[0]); }}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all
            ${dragOver ? 'border-orange-400 bg-orange-50' :
              file     ? 'border-green-400 bg-green-50'   :
              'border-slate-200 bg-slate-50 hover:border-orange-300'}`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{fmtBytes(file.size)}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-600">
                {dragOver ? 'Lepaskan file di sini' : 'Ketuk untuk pilih file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">atau seret & lepas file {label}</p>
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

        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mode Import</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {IMPORT_MODES.map(({ val, label: l, desc, icon }) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={`p-3 rounded-xl border-2 text-left transition-all
                ${mode === val
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
            >
              <p className="text-base mb-1">{icon}</p>
              <p className={`font-bold text-xs ${mode === val ? 'text-orange-600' : 'text-slate-700'}`}>{l}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </button>
          ))}
        </div>

        {mode === 'replace' && (
          <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              Mode <strong>Timpa Semua</strong> akan menghapus seluruh data yang ada.
            </p>
          </div>
        )}

        <button
          onClick={() => file && onConfirm(file, mode)}
          disabled={!file}
          className={`w-full py-4 rounded-xl font-black text-sm transition-all
            ${file
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
        ${done    ? 'border-green-200 bg-green-50' :
          loading ? 'border-orange-200 bg-orange-50' :
          'border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50'}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-green-100' : iconBgClass}`}>
        {loading
          ? <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
          : done
            ? <CheckCircle className="w-5 h-5 text-green-600" />
            : <Icon className={`w-5 h-5 ${iconColorClass}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-slate-800">{label}</p>
          {badge && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5">
          {loading
            ? <span className="text-orange-500 font-semibold">Memproses...</span>
            : done
              ? <span className="text-green-600 font-semibold">Selesai</span>
              : <span className="text-slate-400">{sublabel}</span>
          }
        </p>
      </div>
      {!loading && !done && <span className="text-slate-300 text-xl font-bold">›</span>}
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
  const [isSyncing,       setIsSyncing     ] = useState(false);

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(
    () => localStorage.getItem('mamam_auto_sync_enabled') === 'true'
  );
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const raw = localStorage.getItem('mamam_last_supabase_sync');
    return raw ? new Date(raw).toLocaleString('id-ID') : null;
  });

  const storageSize = getStorageSize();
  const recordCount = countRecords();
  const lastBackup  = localStorage.getItem('mamam_last_backup') || 'Belum pernah';

  // Persist auto-sync preference
  useEffect(() => {
    localStorage.setItem('mamam_auto_sync_enabled', autoSyncEnabled ? 'true' : 'false');
  }, [autoSyncEnabled]);

  // Expose global trigger — panggil dari handler transaksi: window.__triggerSupabaseSync?.()
  useEffect(() => {
    window.__triggerSupabaseSync = async () => {
      if (!autoSyncEnabled) return;
      try {
        await syncToSupabase();
        setLastSyncTime(new Date().toLocaleString('id-ID'));
      } catch (err) {
        console.warn('[mamam] sync gagal:', err.message);
      }
    };
    return () => { delete window.__triggerSupabaseSync; };
  }, [autoSyncEnabled]);

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
    startAction('exportJson', 300, 'File JSON berhasil diunduh!', () => {
      const data = filterByDateRange(readAllFromLocalStorage(), startDate, endDate);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `backup-mamam-${tag}.json` }).click();
      URL.revokeObjectURL(url);
    });
  }

  function handleExportExcelWithRange(startDate, endDate) {
    setDateRangeModal(null);
    const tag = startDate && endDate ? `${startDate}_${endDate}` : 'semua';
    startAction('exportExcel', 400, 'File Excel berhasil diunduh!', async () => {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const data = filterByDateRange(readAllFromLocalStorage(), startDate, endDate);
      const wb   = XLSX.utils.book_new();
      const sheetMap = {
        salesHistory:        'Riwayat Penjualan',
        expenses:            'Pengeluaran',
        incomes:             'Pemasukan',
        employees:           'Karyawan',
        employeeDailyRecords:'Absensi',
        shiftHistory:        'Riwayat Shift',
        customers:           'Pelanggan',
      };
      for (const [key, name] of Object.entries(sheetMap)) {
        if (data[key]?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data[key]), name);
      }
      if (startDate || endDate) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
          Dari:        startDate || 'Awal data',
          Sampai:      endDate   || 'Sekarang',
          DiExportPada: new Date().toLocaleString('id-ID'),
        }]), 'Info Export');
      }
      XLSX.writeFile(wb, `laporan-mamam-${tag}.xlsx`);
    });
  }

  function handleImportConfirm(file, mode) {
    setImportModal(null);
    startAction('importJson', 200, 'Data berhasil diimpor! Muat ulang aplikasi.', async () => {
      writeAllToLocalStorage(JSON.parse(await file.text()), mode);
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      const count = await syncToSupabase();
      setLastSyncTime(new Date().toLocaleString('id-ID'));
      showToast(`Sync selesai — ${count} record diupload`);
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  const STATUS_ROWS = [
    { label: 'Backup terakhir',        value: lastBackup },
    { label: 'Sync Supabase terakhir', value: lastSyncTime || 'Belum pernah' },
    { label: 'Total record',           value: `±${recordCount} data` },
    { label: 'Ukuran tersimpan',       value: storageSize },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl whitespace-nowrap
            ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}
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
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3 shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
        )}
        <h2 className="font-black text-xl text-slate-800 flex items-center gap-2 flex-1">
          <Database className="w-6 h-6 text-orange-500" /> Backup & Restore
        </h2>
        {autoSyncEnabled && (
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-blue-600">Auto-Sync</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-slate-700">Status Data Lokal</p>
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
              ● Aktif
            </span>
          </div>
          <div className="space-y-2">
            {STATUS_ROWS.map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Export / Backup</p>
          <div className="space-y-2">
            <ActionItem
              icon={FileJson}
              label="Export Data (JSON)"
              sublabel="Backup dengan pilihan rentang tanggal"
              badge="Range"
              onClick={() => setDateRangeModal('json')}
              loading={loadingState['exportJson']}
              done={doneState['exportJson']}
              iconBgClass="bg-orange-50"
              iconColorClass="text-orange-500"
            />
            <ActionItem
              icon={Sheet}
              label="Export ke Excel"
              sublabel="Laporan transaksi dengan filter tanggal"
              badge="Range"
              onClick={() => setDateRangeModal('excel')}
              loading={loadingState['exportExcel']}
              done={doneState['exportExcel']}
              iconBgClass="bg-green-50"
              iconColorClass="text-green-600"
            />
          </div>
        </div>

        {/* Supabase Sync */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Cloud Sync — Supabase</p>
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-800">Sync setiap transaksi</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {autoSyncEnabled
                    ? `Aktif · terakhir: ${lastSyncTime || 'belum pernah'}`
                    : 'Nonaktif'}
                </p>
              </div>
              <button
                onClick={() => setAutoSyncEnabled(v => !v)}
                className={`transition-colors ${autoSyncEnabled ? 'text-blue-500' : 'text-slate-300'}`}
              >
                {autoSyncEnabled
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft  className="w-8 h-8" />
                }
              </button>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${isSyncing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200'
                }`}
            >
              {isSyncing
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Menyinkronkan...</>
                : <><CloudUpload className="w-4 h-4" /> Sync Sekarang</>
              }
            </button>
          </div>
        </div>

        {/* Import */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Import / Restore</p>
          <ActionItem
            icon={FileUp}
            label="Import dari JSON"
            sublabel="Pulihkan data dari file backup"
            onClick={() => setImportModal('json')}
            loading={loadingState['importJson']}
            done={doneState['importJson']}
            iconBgClass="bg-orange-50"
            iconColorClass="text-orange-500"
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