import React, { useState, useEffect, useMemo } from 'react';
import {
  Fingerprint, RefreshCw, Clock, Users, Trash2, RotateCcw, Link2, Copy, CheckCircle2,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString } from '../../utils/formatters';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { pushConfig } from '../../storage/realtimeSync';
import { isSupabaseConfigured } from '../../storage/syncClient';
import {
  Card, Button, PageHeader, EmptyState, Badge, IconButton, Alert,
} from '../../components/ui';

// URL web absen karyawan (project terpisah, di-deploy ke Vercel — lihat Step 4).
// Ganti placeholder ini setelah web absennya online.
const ATTENDANCE_WEB_URL = 'https://absen-mamam-kasir.vercel.app';

// Kode OTP berlaku 30 detik, lalu otomatis diganti.
const OTP_LIFETIME_MS = 30_000;

function generateOtp() {
  // 6 digit, gak diawali 0 biar gak ambigu kalau dibaca cepat
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Attendance — layar yang dibuka kasir/owner & ditunjukkan ke karyawan saat
 * mereka datang. Nggak ada form di sini — cuma kode OTP (di-refresh tiap 30s)
 * + rekap siapa yang sudah/belum absen hari ini.
 *
 * Karyawan absen lewat web terpisah (ATTENDANCE_WEB_URL) di HP masing-masing:
 * pilih nama → masukkan kode yang tampil di sini. Web itu insert langsung ke
 * tabel Supabase `attendanceLog`, yang otomatis nongol di sini lewat realtime
 * sync yang sudah disambungkan di App.jsx (tidak perlu polling manual).
 *
 * Kode OTP sendiri NGGAK disimpan di Dexie/state lokal (cuma hidup di memori
 * komponen ini) — tiap kali digenerate, langsung ditembak ke tabel
 * `app_config` (key: 'attendanceOtp') lewat pushConfig() yang sudah ada,
 * supaya web absen bisa baca & validasi kode yang diketik karyawan.
 *
 * Bentuk 1 record `attendanceLog` (diisi oleh web absen):
 *   { id, employeeId, employeeName, type: 'masuk'|'keluar', date, dateStr, deletedAt }
 *
 * Catatan: kalau ada 2 device yang sama-sama buka layar ini bersamaan, masing-
 * masing akan generate kode sendiri-sendiri tiap 30s (saling override di
 * Supabase). Untuk skala outlet kecil yang biasanya cuma 1 device buka ini
 * per shift, ini belum jadi masalah — kalau nanti kepakai multi-device
 * bersamaan, baru perlu dipikirin mekanisme "lock" tambahan.
 */
export default function Attendance() {
  const { employees, attendanceLog, setAttendanceLog, isAdminMode } = useAppContext();

  const [otpCode, setOtpCode] = useState(() => generateOtp());
  const [otpGeneratedAt, setOtpGeneratedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [showTrash, setShowTrash] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tick tiap detik buat countdown visual
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const pushOtp = (code) => {
    pushConfig('attendanceOtp', {
      code,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + OTP_LIFETIME_MS).toISOString(),
    }, undefined, 0); // delay 0 — kirim langsung, gak usah didebounce kayak config biasa
  };

  // Generate kode baru tiap 30 detik + kirim kode awal pas mount.
  // pushOtp sengaja gak dimasukin dependency array — dia stable enough
  // (cuma baca otpCode lewat closure param, gak baca state luar).
  useEffect(() => {
    pushOtp(otpCode);

    const timer = setInterval(() => {
      const fresh = generateOtp();
      setOtpCode(fresh);
      setOtpGeneratedAt(Date.now());
      pushOtp(fresh);
    }, OTP_LIFETIME_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualRefresh = () => {
    const fresh = generateOtp();
    setOtpCode(fresh);
    setOtpGeneratedAt(Date.now());
    pushOtp(fresh);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(ATTENDANCE_WEB_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // clipboard API gak tersedia (mis. http non-secure) — diemin aja
    }
  };

  const secondsLeft = Math.max(0, Math.ceil((otpGeneratedAt + OTP_LIFETIME_MS - now) / 1000));
  const todayStr = toLocalDateString();

  const todayActive = useMemo(
    () => activeOnly(attendanceLog).filter(r => r.dateStr === todayStr),
    [attendanceLog, todayStr]
  );

  const trashedToday = useMemo(
    () => trashedOnly(attendanceLog).filter(r => r.dateStr === todayStr),
    [attendanceLog, todayStr]
  );

  // Status tiap karyawan hari ini: belum absen / sudah masuk / sudah pulang
  const employeeStatuses = useMemo(() => {
    return employees.map(emp => {
      const records = todayActive
        .filter(r => r.employeeId === emp.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        employee: emp,
        masuk: records.find(r => r.type === 'masuk'),
        keluar: records.find(r => r.type === 'keluar'),
      };
    });
  }, [employees, todayActive]);

  const sudahMasukCount = employeeStatuses.filter(s => s.masuk).length;

  const handleDeleteRecord = (id) => {
    setAttendanceLog(prev => prev.map(r => (r.id === id ? markDeleted(r) : r)));
  };

  const handleRestoreRecord = (id) => {
    setAttendanceLog(prev => prev.map(r => (r.id === id ? restoreItem(r) : r)));
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <PageHeader
        title="Absensi Karyawan"
        subtitle={`${sudahMasukCount} dari ${employees.length} karyawan sudah absen masuk hari ini`}
        icon={<Fingerprint className="w-6 h-6" />}
      />

      {!isSupabaseConfigured() && (
        <Alert type="callout" variant="warning" className="mb-4">
          Sinkronisasi cloud belum aktif. Karyawan belum bisa absen lewat HP sendiri
          sampai Supabase disambungkan di Pengaturan.
        </Alert>
      )}

      {/* === Kode OTP — ini bagian yang diliatin ke karyawan === */}
      <Card variant="dark-elevated" padding="lg" className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">
          Kode Absen Hari Ini
        </p>
        <p className="font-heading text-5xl md:text-6xl font-black tracking-[0.2em] text-orange-400 mb-3">
          {otpCode}
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium mb-4">
          <Clock className="w-3.5 h-3.5" />
          Berganti dalam {secondsLeft} detik
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / 30) * 100}%` }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={handleManualRefresh}
        >
          Ganti Kode Sekarang
        </Button>
      </Card>

      <Alert
        type="callout"
        variant="info"
        icon={<Link2 className="w-4 h-4 mt-0.5 shrink-0" />}
        action={
          <IconButton variant="neutral" size="sm" title="Salin link" onClick={handleCopyLink}>
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </IconButton>
        }
        className="mb-6"
      >
        Karyawan absen lewat HP masing-masing di{' '}
        <span className="font-bold break-all">{ATTENDANCE_WEB_URL}</span>, lalu masukkan kode di atas.
      </Alert>

      {/* === Status karyawan hari ini === */}
      <Card padding="none" className="mb-6 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4" /> Status Hari Ini
          </h3>
          {isAdminMode && trashedToday.length > 0 && (
            <button
              onClick={() => setShowTrash(s => !s)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showTrash ? 'Tutup Sampah' : `Sampah (${trashedToday.length})`}
            </button>
          )}
        </div>

        {employees.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Users className="w-8 h-8" />}
            title="Belum ada data karyawan"
            description="Tambahkan karyawan dulu di menu Karyawan"
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {employeeStatuses.map(({ employee, masuk, keluar }) => (
              <div key={employee.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                    {employee.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {masuk ? `Masuk ${formatTime(masuk.date)}` : 'Belum absen masuk'}
                    {keluar && ` · Pulang ${formatTime(keluar.date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {keluar ? (
                    <Badge variant="neutral" dot>Pulang</Badge>
                  ) : masuk ? (
                    <Badge variant="success" dot>Masuk</Badge>
                  ) : (
                    <Badge variant="warning" dot>Belum Absen</Badge>
                  )}
                  {isAdminMode && masuk && (
                    <IconButton
                      variant="delete"
                      ghost
                      title="Koreksi: hapus catatan absen ini"
                      onClick={() => handleDeleteRecord(keluar ? keluar.id : masuk.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* === Recycle bin hari ini (khusus admin) === */}
      {isAdminMode && showTrash && trashedToday.length > 0 && (
        <Card padding="md">
          <h4 className="font-bold text-xs uppercase text-slate-400 mb-3">
            Absen Terhapus Hari Ini
          </h4>
          <div className="space-y-2">
            {trashedToday.map(r => {
              const emp = employees.find(e => e.id === r.employeeId);
              return (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {emp?.name ?? r.employeeName} · {r.type === 'masuk' ? 'Masuk' : 'Pulang'}{' '}
                    {formatTime(r.date)}
                  </span>
                  <IconButton variant="success" ghost title="Kembalikan" onClick={() => handleRestoreRecord(r.id)}>
                    <RotateCcw className="w-4 h-4" />
                  </IconButton>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}