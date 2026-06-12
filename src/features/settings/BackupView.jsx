import { useState, useRef } from 'react';
import {
  Download, FileJson, Sheet, CloudUpload,
  Upload, FileUp, AlertTriangle, CheckCircle,
  Database, Wifi, RefreshCw, X, ArrowLeft, ArrowDownCircle
} from 'lucide-react';

// =========================================================================
// SEMUA KEY localStorage yang dipakai aplikasi mamam-kasir
// =========================================================================
const ALL_KEYS = [
  'variantGroups', 'menus', 'salesHistory', 'hppLibrary', 'savedBills',
  'expenseCategories', 'expenses', 'incomeCategories', 'incomes',
  'currentShift', 'shiftHistory', 'customers', 'vouchers', 'claimsHistory',
  'storeSettings', 'rawMaterials', 'semiFinished', 'categories',
  'employees', 'employeeDailyRecords', 'additionCategories', 'deductionCategories',
];

const PREFIX = 'mamam_kasir_';

// =========================================================================
// HELPER: Baca semua data dari localStorage
// =========================================================================
function readAllFromLocalStorage() {
  const result = {};
  for (const key of ALL_KEYS) {
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`);
      if (raw) result[key] = JSON.parse(raw);
    } catch {
      // skip key yang error
    }
  }
  return result;
}

// =========================================================================
// HELPER: Tulis semua data ke localStorage
// =========================================================================
function writeAllToLocalStorage(data, mode = 'merge') {
  for (const key of ALL_KEYS) {
    if (!(key in data)) continue;
    try {
      if (mode === 'replace') {
        localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
      } else {
        // merge: gabungkan array, timpa object
        const existing = localStorage.getItem(`${PREFIX}${key}`);
        if (!existing) {
          localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
        } else {
          const parsed = JSON.parse(existing);
          if (Array.isArray(parsed) && Array.isArray(data[key])) {
            // Gabungkan, hindari duplikat berdasarkan id
            const merged = [...parsed];
            for (const item of data[key]) {
              if (!merged.find(e => e.id === item.id)) merged.push(item);
            }
            localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(merged));
          } else {
            // Untuk object (storeSettings, dll): timpa
            localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data[key]));
          }
        }
      }
    } catch {
      // skip
    }
  }
}

// =========================================================================
// HELPER: Hitung ukuran data localStorage
// =========================================================================
function getStorageSize() {
  let total = 0;
  for (const key of ALL_KEYS) {
    const val = localStorage.getItem(`${PREFIX}${key}`);
    if (val) total += val.length;
  }
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
  return `${(total / (1024 * 1024)).toFixed(1)} MB`;
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

// =========================================================================
// MODAL IMPORT
// =========================================================================
function ImportModal({ type, onClose, onConfirm }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const inputRef = useRef();

  const isJson = type === 'json';
  const accept = isJson ? '.json,application/json' : '.xlsx,.xls';
  const label = isJson ? 'JSON' : 'Excel (.xlsx)';

  function handleFile(f) {
    if (!f) return;
    setFile(f);
  }

  function formatBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

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
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-base">Import dari {label}</p>
            <p className="text-xs text-slate-400">Pilih file untuk dipulihkan</p>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all ${
            dragOver ? 'border-orange-400 bg-orange-50' :
            file ? 'border-green-400 bg-green-50' :
            'border-slate-200 bg-slate-50 hover:border-orange-300'
          }`}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
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
          onChange={e => handleFile(e.target.files[0])}
        />

        {/* Mode Selector */}
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mode Import</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { val: 'merge', label: 'Gabungkan', desc: 'Tambah ke data ada', icon: '🔗' },
            { val: 'replace', label: 'Timpa Semua', desc: 'Hapus data lama', icon: '🔄' },
          ].map(({ val, label: l, desc, icon }) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                mode === val
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

        {/* Warning timpa */}
        {mode === 'replace' && (
          <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">
              Mode <strong>Timpa Semua</strong> akan menghapus seluruh data yang ada. Pastikan kamu sudah punya backup sebelum lanjut.
            </p>
          </div>
        )}

        {/* Tombol Konfirm */}
        <button
          onClick={() => file && onConfirm(file, mode)}
          disabled={!file}
          className={`w-full py-4 rounded-xl font-black text-sm transition-all ${
            file
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

// =========================================================================
// ACTION BUTTON ITEM
// =========================================================================
function ActionItem({ icon: Icon, label, sublabel, onClick, loading, done, iconBgClass, iconColorClass }) {
  return (
    <button
      onClick={loading || done ? undefined : onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
        done
          ? 'border-green-200 bg-green-50'
          : loading
          ? 'border-orange-200 bg-orange-50'
          : 'border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-green-100' : iconBgClass}`}>
        {loading ? (
          <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
        ) : done ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <Icon className={`w-5 h-5 ${iconColorClass}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-slate-800">{label}</p>
        <p className="text-xs mt-0.5">
          {loading ? (
            <span className="text-orange-500 font-semibold">Memproses...</span>
          ) : done ? (
            <span className="text-green-600 font-semibold">✓ Selesai</span>
          ) : (
            <span className="text-slate-400">{sublabel}</span>
          )}
        </p>
      </div>
      {!loading && !done && (
        <span className="text-slate-300 text-xl font-bold">›</span>
      )}
    </button>
  );
}

// =========================================================================
// KOMPONEN UTAMA BACKUP VIEW
// =========================================================================
const BackupView = ({ onBack }) => {
  const [loadingState, setLoadingState] = useState({});
  const [doneState, setDoneState] = useState({});
  const [toast, setToast] = useState(null);
  const [importModal, setImportModal] = useState(null); // 'json' | null

  const storageSize = getStorageSize();
  const recordCount = countRecords();
  const lastBackup = localStorage.getItem('mamam_last_backup') || 'Belum pernah';

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
        // Catat waktu backup terakhir
        if (['exportJson', 'exportExcel', 'supabase'].includes(key)) {
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

  // ── EXPORT JSON ────────────────────────────────────────────────────────
  function handleExportJson() {
    startAction('exportJson', 300, 'File JSON berhasil diunduh!', () => {
      const data = readAllFromLocalStorage();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-mamam-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ── EXPORT EXCEL ───────────────────────────────────────────────────────
  function handleExportExcel() {
    startAction('exportExcel', 400, 'File Excel berhasil diunduh!', async () => {
      // Pakai SheetJS dari CDN — sudah ada di package react artifacts
      // Di project asli, install: npm install xlsx
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const data = readAllFromLocalStorage();
      const wb = XLSX.utils.book_new();

      const sheetMap = {
        salesHistory: 'Riwayat Penjualan',
        expenses: 'Pengeluaran',
        incomes: 'Pemasukan',
        employees: 'Karyawan',
        employeeDailyRecords: 'Absensi',
        shiftHistory: 'Riwayat Shift',
        customers: 'Pelanggan',
      };

      for (const [key, sheetName] of Object.entries(sheetMap)) {
        if (data[key]?.length) {
          const ws = XLSX.utils.json_to_sheet(data[key]);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      }

      XLSX.writeFile(wb, `laporan-mamam-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  // ── IMPORT JSON ────────────────────────────────────────────────────────
  function handleImportConfirm(file, mode) {
    setImportModal(null);
    startAction('importJson', 200, 'Data berhasil diimpor! Muat ulang aplikasi.', async () => {
      const text = await file.text();
      const data = JSON.parse(text);
      writeAllToLocalStorage(data, mode);
      // Reload agar React state segar
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  // ── SUPABASE (placeholder — isi URL & key di .env) ─────────────────────
  function handleSupabaseSync() {
    startAction('supabase', 500, 'Sinkronisasi selesai!', async () => {
      const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Belum ada konfigurasi Supabase di .env');
      }

      const data = readAllFromLocalStorage();
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Upsert tabel-tabel utama
      for (const key of ['salesHistory', 'expenses', 'incomes', 'employees', 'customers']) {
        if (data[key]?.length) {
          const { error } = await supabase.from(key).upsert(data[key]);
          if (error) throw new Error(`Gagal sync ${key}: ${error.message}`);
        }
      }
    });
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">

      {/* ── TOAST ── */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl whitespace-nowrap transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{ animation: 'fadeInDown 0.2s ease' }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── MODAL IMPORT ── */}
      {importModal && (
        <ImportModal
          type={importModal}
          onClose={() => setImportModal(null)}
          onConfirm={handleImportConfirm}
        />
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3 shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
        )}
        <div className="flex-1">
          <p className="font-black text-slate-900 text-lg leading-tight">Backup & Restore</p>
          <p className="text-xs text-slate-400">Kelola, ekspor & impor data kasir</p>
        </div>
        <Database className="w-6 h-6 text-orange-400" />
      </div>

      <div className="p-4 space-y-4">

        {/* ── STATUS CARD ── */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-slate-700">Status Data Lokal</p>
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
              ● Aktif
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Backup terakhir', value: lastBackup },
              { label: 'Total record', value: `±${recordCount} data` },
              { label: 'Ukuran tersimpan', value: storageSize },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION EXPORT ── */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Export / Backup
          </p>
          <div className="space-y-2">
            <ActionItem
              icon={FileJson}
              label="Export Data (JSON)"
              sublabel="Backup semua data dalam format JSON"
              onClick={handleExportJson}
              loading={loadingState['exportJson']}
              done={doneState['exportJson']}
              iconBgClass="bg-orange-50"
              iconColorClass="text-orange-500"
            />
            <ActionItem
              icon={Sheet}
              label="Export ke Excel"
              sublabel="Laporan transaksi format .xlsx"
              onClick={handleExportExcel}
              loading={loadingState['exportExcel']}
              done={doneState['exportExcel']}
              iconBgClass="bg-green-50"
              iconColorClass="text-green-600"
            />
            <ActionItem
              icon={CloudUpload}
              label="Sinkronisasi ke Supabase"
              sublabel="Upload data lokal ke cloud"
              onClick={handleSupabaseSync}
              loading={loadingState['supabase']}
              done={doneState['supabase']}
              iconBgClass="bg-blue-50"
              iconColorClass="text-blue-500"
            />
          </div>
        </div>

        {/* ── SECTION IMPORT ── */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Import / Restore
          </p>
          <div className="space-y-2">
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

        {/* ── INFO BOX ── */}
        <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Backup rutin setiap hari disarankan. Saat import, gunakan mode{' '}
            <strong>Gabungkan</strong> agar data lama tidak terhapus. Sinkronisasi Supabase
            butuh konfigurasi <code className="bg-amber-100 px-1 rounded">.env</code> terlebih dahulu.
          </p>
        </div>

      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BackupView;
