import { useState, useEffect, useRef } from 'react';
import {
  FileJson, Sheet, CloudUpload,
  Upload, FileUp, AlertTriangle, CheckCircle,
  Database, RefreshCw, X, ArrowLeft,
  Calendar, Info, Wifi, WifiOff, Clock,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportAllData, loadData, saveData } from '../storage/db';
import { ALL_KEYS, TRANSACTION_KEYS, CONFIG_KEYS, DATE_FILTERABLE_KEYS } from '../storage/syncKeys';
import { getSupabaseClient, isSupabaseConfigured } from '../storage/syncClient';
import { isAutoSyncEnabled, setAutoSyncEnabled } from '../storage/realtimeSync';

// ── Helpers ────────────────────────────────────────────────────────────────

async function writeAllToDexie(data, mode = 'merge') {
  for (const key of ALL_KEYS) {
    if (!(key in data)) continue;

    if (mode === 'replace') {
      await saveData(key, data[key]);
      continue;
    }

    const MISSING = '__DEXIE_MISSING__';
    const existing = await loadData(key, MISSING);

    if (existing === MISSING) {
      await saveData(key, data[key]);
      continue;
    }

    if (Array.isArray(existing) && Array.isArray(data[key])) {
      const merged = [...existing];
      for (const item of data[key]) {
        const alreadyExists = merged.find(e => String(e.id) === String(item.id));
        if (!alreadyExists) merged.push(item);
      }
      await saveData(key, merged);
      continue;
    }

    if (
      existing !== null && typeof existing === 'object' && !Array.isArray(existing) &&
      data[key] !== null && typeof data[key] === 'object' && !Array.isArray(data[key])
    ) {
      const merged = { ...data[key], ...existing };
      await saveData(key, merged);
      continue;
    }

    if (existing === null || existing === undefined) {
      await saveData(key, data[key]);
    }
  }
}

function filterByDateRange(data, startDate, endDate) {
  if (!startDate && !endDate) return data;
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;
  const result = {};
  for (const key of ALL_KEYS) {
    if (!data[key]) continue;
    const dateField = DATE_FILTERABLE_KEYS[key];
    if (!dateField || !Array.isArray(data[key])) { result[key] = data[key]; continue; }
    result[key] = data[key].filter(item => {
      if (!item[dateField]) return false;
      const d = new Date(item[dateField]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }
  return result;
}

function calcStorageSize(allData) {
  const total = JSON.stringify(allData).length;
  if (total < 1024) return `${total} B`;
  if (total < 1048576) return `${(total / 1024).toFixed(1)} KB`;
  return `${(total / 1048576).toFixed(1)} MB`;
}

function calcRecordCount(allData) {
  let count = 0;
  for (const key of ['salesHistory', 'expenses', 'incomes', 'employees']) {
    if (Array.isArray(allData[key])) count += allData[key].length;
  }
  return count;
}

const SYNC_BATCH_DELAY_MS = 400;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function syncAllToSupabase() {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Konfigurasi Supabase belum ada di .env');

  const data = await exportAllData();
  let totalUpserted = 0;

  for (const key of TRANSACTION_KEYS) {
    const items = Array.isArray(data[key]) ? data[key] : [];
    if (!items.length) continue;
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100).map(item => ({
        id: String(item.id), payload: item,
        updated_at: item.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from(key).upsert(batch, { onConflict: 'id' });
      if (error) throw new Error(`Gagal sync [${key}]: ${error.message}`);
      totalUpserted += batch.length;
      await sleep(SYNC_BATCH_DELAY_MS);
    }
  }

  const configBatch = CONFIG_KEYS
    .filter(k => data[k] !== undefined)
    .map(k => ({ key: k, value: data[k], updated_at: new Date().toISOString() }));

  if (configBatch.length) {
    await sleep(SYNC_BATCH_DELAY_MS);
    const { error } = await supabase.from('app_config').upsert(configBatch, { onConflict: 'key' });
    if (error) throw new Error(`Gagal sync config: ${error.message}`);
    totalUpserted += configBatch.length;
  }

  localStorage.setItem('mamam_last_supabase_sync', new Date().toISOString());
  return totalUpserted;
}

async function restoreFromSupabase(mode = 'replace') {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Konfigurasi Supabase belum ada di .env');

  const restored = {};

  for (const key of TRANSACTION_KEYS) {
    const { data: rows, error } = await supabase.from(key).select('payload');
    if (error) throw new Error(`Gagal restore [${key}]: ${error.message}`);
    restored[key] = (rows || []).map(r => r.payload);
  }

  const { data: configRows, error: configErr } = await supabase
    .from('app_config').select('key, value').in('key', CONFIG_KEYS);
  if (configErr) throw new Error(`Gagal restore config: ${configErr.message}`);
  for (const row of configRows || []) restored[row.key] = row.value;

  await writeAllToDexie(restored, mode);
  return Object.keys(restored).length;
}

// ── DateRangeModal ─────────────────────────────────────────────────────────

function DateRangeModal({ onClose, onConfirm, exportType }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [preset, setPreset] = useState('thisMonth');

  const PRESETS = [
    { id: 'today', label: 'Hari Ini', getRange: () => ({ s: today, e: today }) },
    {
      id: 'thisWeek', label: 'Minggu Ini', getRange: () => {
        const d = new Date(), day = d.getDay(), mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return { s: mon.toISOString().slice(0, 10), e: today };
      }
    },
    { id: 'thisMonth', label: 'Bulan Ini', getRange: () => ({ s: firstOfMonth, e: today }) },
    {
      id: 'lastMonth', label: 'Bulan Lalu', getRange: () => {
        const d = new Date();
        const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const last = new Date(d.getFullYear(), d.getMonth(), 0);
        return { s: first.toISOString().slice(0, 10), e: last.toISOString().slice(0, 10) };
      }
    },
    { id: 'allTime', label: 'Semua Data', getRange: () => ({ s: '', e: '' }) },
    { id: 'custom', label: 'Kustom', getRange: () => ({ s: startDate, e: endDate }) },
  ];

  function applyPreset(p) {
    setPreset(p.id);
    if (p.id !== 'custom') { const { s, e } = p.getRange(); setStartDate(s); setEndDate(e); }
  }

  const isAllTime = preset === 'allTime';
  const hasRange = !isAllTime && (startDate || endDate);
  const label = exportType === 'json' ? 'JSON' : 'Excel';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ animation: 'slideUp 0.25s ease' }}>
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-xl">
            {exportType === 'json' ? '📦' : '📊'}
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-slate-100 text-base">Export {label} — Pilih Rentang</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Filter berdasarkan tanggal transaksi</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                ${preset === p.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-500/50'}`}
            >{p.label}</button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[['Dari Tanggal', startDate, setStartDate], ['Sampai Tanggal', endDate, setEndDate]].map(([lbl, val, set]) => (
              <div key={lbl}>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">{lbl}</p>
                <input type="date" value={val} onChange={e => set(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors" />
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
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Semua data tanpa filter tanggal</p>
          </div>
        )}

        <button onClick={() => onConfirm(isAllTime ? '' : startDate, isAllTime ? '' : endDate)}
          className="w-full py-4 rounded-xl font-black text-sm bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white shadow-lg shadow-orange-200 dark:shadow-none transition-all">
          Download {label}
        </button>
      </div>
    </div>
  );
}

// ── ImportModal ────────────────────────────────────────────────────────────

function ImportModal({ type, onClose, onConfirm }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const [replaceConfirm, setReplaceConfirm] = useState('');

  const label = type === 'json' ? 'JSON' : 'Excel (.xlsx)';
  const accept = type === 'json' ? '.json,application/json' : '.xlsx,.xls';
  const fmtBytes = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const canSubmit = file && (mode === 'merge' || replaceConfirm.trim().toUpperCase() === 'TIMPA');

  function handleModeChange(val) {
    setMode(val);
    setReplaceConfirm('');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ animation: 'slideUp 0.25s ease' }}>
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
            <FileUp className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-slate-100 text-base">Import dari {label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Data lokal aman — mode default: Gabungkan</p>
          </div>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files[0]); }}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all
            ${dragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10' : file ? 'border-green-400 bg-green-50 dark:bg-green-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-orange-300 dark:hover:border-orange-500/50'}`}
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
              <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">{dragOver ? 'Lepaskan file di sini' : 'Ketuk untuk pilih file'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">atau seret & lepas file {label}</p>
            </>
          )}
        </div>

        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => setFile(e.target.files[0])} />

        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Mode Import</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => handleModeChange('merge')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${mode === 'merge' ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
          >
            <p className="text-base mb-1">🔗</p>
            <p className={`font-bold text-xs ${mode === 'merge' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>Gabungkan</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tambah ke data ada</p>
            {mode === 'merge' && <p className="text-xs text-orange-500 dark:text-orange-400 font-bold mt-1">✓ Aman — direkomendasikan</p>}
          </button>
          <button onClick={() => handleModeChange('replace')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${mode === 'replace' ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
          >
            <p className="text-base mb-1">🔄</p>
            <p className={`font-bold text-xs ${mode === 'replace' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>Timpa Semua</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Hapus data lama</p>
          </button>
        </div>

        {mode === 'replace' && (
          <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                <strong>Peringatan!</strong> Mode ini akan menghapus SELURUH data lokal dan menggantinya dengan isi file import.
                Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-red-500 dark:text-red-400 mb-1.5">
                Ketik <span className="bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 rounded font-mono">TIMPA</span> untuk konfirmasi:
              </p>
              <input
                type="text"
                value={replaceConfirm}
                onChange={e => setReplaceConfirm(e.target.value)}
                placeholder="Ketik TIMPA di sini..."
                className="w-full border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-red-400 dark:focus:border-red-400 transition-colors"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <button onClick={() => canSubmit && onConfirm(file, mode)} disabled={!canSubmit}
          className={`w-full py-4 rounded-xl font-black text-sm transition-all
            ${canSubmit
              ? mode === 'replace'
                ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none'
                : 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white shadow-lg shadow-orange-200 dark:shadow-none'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
        >
          {file ? `Import ${label}` : 'Pilih file terlebih dahulu'}
        </button>
      </div>
    </div>
  );
}

// ── ActionItem ─────────────────────────────────────────────────────────────

function ActionItem({ icon: Icon, label, sublabel, onClick, loading, done, iconBgClass, iconColorClass, badge }) {
  return (
    <button onClick={loading || done ? undefined : onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
        ${done ? 'border-green-200 bg-green-50' : loading ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white hover:border-orange-200 hover:bg-orange-50'}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-green-100' : iconBgClass}`}>
        {loading ? <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
          : done ? <CheckCircle className="w-5 h-5 text-green-600" />
            : <Icon className={`w-5 h-5 ${iconColorClass}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-slate-800">{label}</p>
          {badge && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{badge}</span>}
        </div>
        <p className="text-xs mt-0.5">
          {loading ? <span className="text-orange-500 font-semibold">Memproses...</span>
            : done ? <span className="text-green-600 font-semibold">Selesai</span>
              : <span className="text-slate-400">{sublabel}</span>}
        </p>
      </div>
      {!loading && !done && <span className="text-slate-300 text-xl font-bold">›</span>}
    </button>
  );
}

// ── BackupView ─────────────────────────────────────────────────────────────

const BackupView = ({ onBack }) => {
  const [loadingState, setLoadingState] = useState({});
  const [doneState, setDoneState] = useState({});
  const [toast, setToast] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [dateRangeModal, setDateRangeModal] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [storageSize, setStorageSize] = useState('Menghitung...');
  const [recordCount, setRecordCount] = useState('...');

  const supabaseReady = isSupabaseConfigured();
  const lastBackup = localStorage.getItem('mamam_last_backup') || 'Belum pernah';
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const raw = localStorage.getItem('mamam_last_supabase_sync');
    return raw ? new Date(raw).toLocaleString('id-ID') : null;
  });

  const [autoSyncOn, setAutoSyncOn] = useState(() => isAutoSyncEnabled());
  const [dailySyncOn, setDailySyncOn] = useState(() => {
    const saved = localStorage.getItem('mamam_daily_sync');
    return saved !== 'false'; // Default bernilai true sebagai safety net
  });

  const [lastSyncIso, setLastSyncIso] = useState(
    () => localStorage.getItem('mamam_last_supabase_sync')
  );
  const [now, setNow] = useState(() => new Date());

  const minutesUntilSync = (() => {
    if (!autoSyncOn || !lastSyncIso) return null;
    const diff = Math.ceil(
      (new Date(lastSyncIso).getTime() + 15 * 60 * 1000 - now.getTime()) / 60_000
    );
    return Math.max(0, diff);
  })();

  function handleToggleAutoSync() {
    const next = !autoSyncOn;
    setAutoSyncEnabled(next);
    setAutoSyncOn(next);
  }

  function handleToggleDailySync() {
    const next = !dailySyncOn;
    localStorage.setItem('mamam_daily_sync', String(next));
    setDailySyncOn(next);
  }

  useEffect(() => {
    exportAllData().then(allData => {
      setStorageSize(calcStorageSize(allData));
      setRecordCount(calcRecordCount(allData));
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const raw = localStorage.getItem('mamam_last_supabase_sync');
      setLastSyncIso(raw);
      if (raw) setLastSyncTime(new Date(raw).toLocaleString('id-ID'));
      const currentTime = new Date();
      setNow(currentTime);

      // Trigger sync otomatis setiap jam 21:00 jika fitur dihidupkan
      if (dailySyncOn && currentTime.getHours() === 21) {
        const lastD = raw ? new Date(raw) : null;
        if (!lastD || lastD.toDateString() !== currentTime.toDateString() || lastD.getHours() < 21) {
          syncAllToSupabase().then(count => {
            const tsStr = new Date().toISOString();
            localStorage.setItem('mamam_last_supabase_sync', tsStr);
            setLastSyncIso(tsStr);
            setLastSyncTime(new Date(tsStr).toLocaleString('id-ID'));
            showToast(`Auto-Sync 21:00 selesai — ${count} data tersimpan`);
          }).catch(e => console.error("Daily sync fail:", e));
        }
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [dailySyncOn]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
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

  function handleExportJsonWithRange(startDate, endDate) {
    setDateRangeModal(null);
    const tag = startDate && endDate ? `${startDate}_${endDate}` : 'semua';
    startAction('exportJson', 300,
      Capacitor.isNativePlatform() ? 'Membuka menu simpan...' : 'File JSON berhasil diunduh!',
      async () => {
        const raw = await exportAllData();
        const data = filterByDateRange(raw, startDate, endDate);
        const jsonStr = JSON.stringify(data, null, 2);
        const filename = `backup-mamam-${tag}.json`;

        if (Capacitor.isNativePlatform()) {
          const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
          const r = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
          await Share.share({ title: filename, url: r.uri, dialogTitle: 'Simpan / Bagikan Backup JSON' });
        } else {
          const url = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }));
          Object.assign(document.createElement('a'), { href: url, download: filename }).click();
          URL.revokeObjectURL(url);
        }
      }
    );
  }

  function handleExportExcelWithRange(startDate, endDate) {
    setDateRangeModal(null);
    const tag = startDate && endDate ? `${startDate}_${endDate}` : 'semua';
    startAction('exportExcel', 400,
      Capacitor.isNativePlatform() ? 'Membuka menu simpan...' : 'File Excel berhasil diunduh!',
      async () => {
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
        const raw = await exportAllData();
        const data = filterByDateRange(raw, startDate, endDate);
        const wb = XLSX.utils.book_new();
        const sheets = {
          salesHistory: 'Riwayat Penjualan', expenses: 'Pengeluaran',
          incomes: 'Pemasukan', employees: 'Karyawan',
          employeeDailyRecords: 'Absensi', shiftHistory: 'Riwayat Shift', customers: 'Pelanggan',
        };
        for (const [key, name] of Object.entries(sheets)) {
          if (data[key]?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data[key]), name);
        }
        const filename = `laporan-mamam-${tag}.xlsx`;
        if (Capacitor.isNativePlatform()) {
          const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
          const r = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
          await Share.share({ title: filename, url: r.uri, dialogTitle: 'Simpan / Bagikan Laporan Excel' });
        } else {
          XLSX.writeFile(wb, filename);
        }
      }
    );
  }

  function handleImportConfirm(file, mode) {
    setImportModal(null);
    startAction('importJson', 200, 'Data berhasil diimpor! Muat ulang aplikasi.', async () => {
      const parsed = JSON.parse(await file.text());
      await writeAllToDexie(parsed, mode);
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  async function handleManualSync() {
    if (!supabaseReady) { showToast('Supabase belum dikonfigurasi di .env', 'error'); return; }
    setIsSyncing(true);
    try {
      const count = await syncAllToSupabase();
      const raw = localStorage.getItem('mamam_last_supabase_sync');
      const ts = new Date().toLocaleString('id-ID');
      setLastSyncIso(raw);
      setLastSyncTime(ts);
      setNow(new Date());
      showToast(`Sync selesai — ${count} record diupload`);
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRestoreFromSupabase() {
    if (!supabaseReady) { showToast('Supabase belum dikonfigurasi di .env', 'error'); return; }
    if (!window.confirm('Restore semua data dari Supabase?\nData lokal akan ditimpa sepenuhnya.')) return;
    setIsRestoring(true);
    try {
      const count = await restoreFromSupabase('replace');
      showToast(`Restore selesai — ${count} key dipulihkan`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsRestoring(false);
    }
  }

  const STATUS_ROWS = [
    { label: 'Backup local terakhir', value: lastBackup },
    { label: 'Sync cloud terakhir', value: lastSyncTime || 'Belum pernah' },
    { label: 'Total record', value: `±${recordCount} data` },
    { label: 'Ukuran tersimpan', value: storageSize },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">

      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl whitespace-nowrap
          ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} style={{ animation: 'fadeInDown 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      {importModal && <ImportModal type={importModal} onClose={() => setImportModal(null)} onConfirm={handleImportConfirm} />}
      {dateRangeModal && (
        <DateRangeModal exportType={dateRangeModal} onClose={() => setDateRangeModal(null)}
          onConfirm={dateRangeModal === 'json' ? handleExportJsonWithRange : handleExportExcelWithRange} />
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
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 border text-xs font-bold
          ${supabaseReady ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
          {supabaseReady ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {supabaseReady ? 'Cloud' : 'Offline'}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-slate-700">Status Penyimpanan</p>
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">● Aktif</span>
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Export / Backup Lokal</p>
          <div className="space-y-2">
            <ActionItem icon={FileJson} label="Export Data (JSON)" sublabel="Backup dengan pilihan rentang tanggal"
              badge="Range" onClick={() => setDateRangeModal('json')}
              loading={loadingState['exportJson']} done={doneState['exportJson']}
              iconBgClass="bg-orange-50" iconColorClass="text-orange-500" />
            <ActionItem icon={Sheet} label="Export ke Excel" sublabel="Laporan transaksi dengan filter tanggal"
              badge="Range" onClick={() => setDateRangeModal('excel')}
              loading={loadingState['exportExcel']} done={doneState['exportExcel']}
              iconBgClass="bg-green-50" iconColorClass="text-green-600" />
          </div>
        </div>

        {/* Import Lokal */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Import dari File</p>
          <ActionItem icon={FileUp} label="Import dari JSON" sublabel="Pulihkan data dari file backup lokal"
            onClick={() => setImportModal('json')}
            loading={loadingState['importJson']} done={doneState['importJson']}
            iconBgClass="bg-orange-50" iconColorClass="text-orange-500" />
        </div>

        {/* Cloud Sync */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Cloud Sync Realtime — Supabase</p>
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 space-y-4">

            {!supabaseReady && (
              <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>VITE_SUPABASE_URL</strong> dan <strong>VITE_SUPABASE_ANON_KEY</strong> belum diset di .env.
                  Sync realtime tidak aktif.
                </p>
              </div>
            )}

            {supabaseReady && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 animate-pulse shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-700">Realtime aktif</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Perubahan di device ini otomatis dikirim ke device lain secara real-time.
                    Push diblok selama initial pull saat startup.
                  </p>
                </div>
              </div>
            )}

            {/* Layout 3 Tombol Berdampingan */}
            {supabaseReady && (
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Sync Jam 21:00 (Safety Net) */}
                <button onClick={handleToggleDailySync} className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${dailySyncOn ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  <Clock className="w-5 h-5" />
                  <p className="text-[10px] font-bold leading-tight">Otomatis<br />21:00</p>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${dailySyncOn ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{dailySyncOn ? 'ON' : 'OFF'}</div>
                </button>

                {/* 2. Sync 15 Menit */}
                <button onClick={handleToggleAutoSync} className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${autoSyncOn ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  <RefreshCw className="w-5 h-5" />
                  <p className="text-[10px] font-bold leading-tight">Otomatis<br />15 Menit</p>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${autoSyncOn ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{autoSyncOn ? 'ON' : 'OFF'}</div>
                </button>

                {/* 3. Sync Manual Sekarang */}
                <button onClick={handleManualSync} disabled={isSyncing || isRestoring || !supabaseReady} className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${isSyncing ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                  {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
                  <p className="text-[10px] font-bold leading-tight">Manual<br />Sekarang</p>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isSyncing ? 'bg-orange-500 text-white' : 'bg-indigo-500 text-white'}`}>{isSyncing ? 'SYNC' : 'TAP'}</div>
                </button>
              </div>
            )}

            {/* Info Waktu Sync Terakhir */}
            {supabaseReady && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <RefreshCw className="w-3 h-3" />
                  {lastSyncTime
                    ? <span>Terakhir: <span className="font-bold text-slate-700">{lastSyncTime}</span></span>
                    : <span>Belum pernah sync</span>}
                </span>
                {(autoSyncOn && minutesUntilSync !== null) && (
                  <span className={`text-xs font-bold tabular-nums
                    ${minutesUntilSync === 0 ? 'text-orange-500 animate-pulse' : 'text-emerald-600'}`}>
                    {minutesUntilSync === 0 ? '⟳ Sebentar lagi...' : `dalam ${minutesUntilSync} mnt`}
                  </span>
                )}
              </div>
            )}

            {/* Restore dari server */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400 mb-2">
                Pindah HP atau install ulang? Tarik semua data dari cloud. Server adalah <strong>source of truth</strong>.
              </p>
              <button onClick={handleRestoreFromSupabase} disabled={isSyncing || isRestoring || !supabaseReady}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border-2
                  ${isRestoring || !supabaseReady
                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
              >
                {isRestoring
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Memulihkan...</>
                  : <><Upload className="w-4 h-4" /> Restore dari Server</>}
              </button>
            </div>
          </div>
        </div>



      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity:0; transform:translateX(-50%) translateY(-8px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BackupView;