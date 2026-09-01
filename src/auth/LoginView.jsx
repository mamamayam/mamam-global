import { useState, useEffect, useCallback } from 'react';
import { UserRound, ChevronLeft, Store, ShieldCheck } from 'lucide-react';
import { Card, Input, Button } from '../components/ui';

// SENGAJA dynamic import (bukan `import { getSupabaseClient } from
// '../storage/syncClient'` di atas) -- syncClient.js sudah di-import
// dynamic di banyak tempat lain (App.jsx, dst) supaya @supabase/supabase-js
// tetap kepisah ke chunk-nya sendiri, bukan numpuk ke chunk view manapun.
const loadSupabase = () => import('../storage/syncClient').then(m => m.getSupabaseClient());

/**
 * LoginView — gerbang masuk aplikasi. Ditampilkan App.jsx kalau belum ada
 * employee yang dipilih (App.jsx: currentEmployee === null).
 *
 * SEMENTARA TANPA VERIFIKASI PIN (atas permintaan Agung, 1 Sep 2026) -- tap
 * nama langsung masuk lewat prop onLogin(employee), gak ada pengecekan PIN
 * sama sekali di sini. Ini stub sengaja disederhanain biar gampang
 * dicustomisasi ulang nanti. Yang perlu tau:
 *   - PinPad.jsx, dan Edge Function create-employee / reset-employee-pin
 *     TETEP ada & tetep jalan (dipanggil AccountView.jsx buat bikin/reset
 *     akun) -- yang dicabut cuma pengecekan PIN pas LOGIN, di file ini.
 *   - Bikin akun baru MASIH lewat create-employee (masih insert baris
 *     auth.users beneran, karena employees.id di-FK ke auth.users di
 *     migration SQL-nya) -- form bootstrap admin pertama di bawah masih
 *     manggil Edge Function itu, cuma PIN-nya di-generate random & gak
 *     ditampilin/ditanya ke user (toh gak dicek lagi pas login).
 *   - Buat pasang lagi verifikasi PIN pas login: render <PinPad> dulu
 *     sebelum manggil onLogin() di tombol nama, baru panggil onLogin()
 *     setelah PIN dicocokin (lihat git history file ini buat versi lama
 *     yang pakai supabase.auth.signInWithPassword).
 *
 * props:
 *   onLogin(employee) — dipanggil begitu ada employee yang "masuk".
 *     employee: {id, name, role, is_active}
 */
const LoginView = ({ onLogin }) => {
    const [employees, setEmployees] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [listError, setListError] = useState('');

    // ── Bootstrap admin pertama (cuma muncul kalau employees kosong) ─────
    const [showBootstrap, setShowBootstrap] = useState(false);
    const [bootstrapName, setBootstrapName] = useState('');
    const [creatingBootstrap, setCreatingBootstrap] = useState(false);
    const [bootstrapError, setBootstrapError] = useState('');

    const fetchEmployees = useCallback(async () => {
        setLoadingList(true);
        setListError('');
        try {
            const supabase = await loadSupabase();
            if (!supabase) {
                setListError('Supabase belum dikonfigurasi.');
                return;
            }
            const { data, error } = await supabase
                .from('employees')
                .select('id, name, role, is_active')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            setEmployees(data || []);
        } catch (err) {
            console.warn('[LoginView] gagal ambil daftar karyawan:', err.message);
            setListError('Gagal memuat daftar akun. Cek koneksi internet.');
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!cancelled) await fetchEmployees();
        })();
        return () => { cancelled = true; };
    }, [fetchEmployees]);

    const handleCreateBootstrapAdmin = async () => {
        if (!bootstrapName.trim()) {
            setBootstrapError('Nama wajib diisi.');
            return;
        }
        setCreatingBootstrap(true);
        setBootstrapError('');
        try {
            const supabase = await loadSupabase();
            // PIN throwaway -- cuma buat isi password auth.users, gak pernah
            // ditampilin/dicek lagi selama versi tanpa-PIN ini masih dipakai.
            const throwawayPin = String(Math.floor(100000 + Math.random() * 900000));
            const { data, error } = await supabase.functions.invoke('create-employee', {
                body: { name: bootstrapName.trim(), pin: throwawayPin, role: 'admin' },
            });
            if (error || data?.error) {
                setBootstrapError(data?.error || error.message || 'Gagal membuat akun admin');
                return;
            }
            onLogin({ id: data.id, name: bootstrapName.trim(), role: 'admin', is_active: true });
        } catch (err) {
            console.warn('[LoginView] create-employee (bootstrap) error:', err.message);
            setBootstrapError('Gagal terhubung ke server, coba lagi');
        } finally {
            setCreatingBootstrap(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center mb-6 shadow-lg shadow-accent-500/20">
                <Store className="w-8 h-8 text-white" />
            </div>

            <Card variant="elevated" padding="lg" className="w-full max-w-sm">
                {!showBootstrap ? (
                    <>
                        <h1 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-1">
                            Siapa yang masuk?
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6">
                            Pilih nama akun kamu
                        </p>

                        {loadingList && (
                            <p className="text-sm text-slate-400 text-center py-6">Memuat daftar akun...</p>
                        )}
                        {!loadingList && listError && (
                            <p className="text-sm text-accent-500 text-center py-6">{listError}</p>
                        )}
                        {!loadingList && !listError && employees.length === 0 && (
                            <div className="text-center py-2">
                                <p className="text-sm text-slate-400 mb-4">
                                    Belum ada akun terdaftar sama sekali.
                                </p>
                                <Button
                                    variant="dark"
                                    size="sm"
                                    icon={<ShieldCheck className="w-4 h-4" />}
                                    onClick={() => { setShowBootstrap(true); setBootstrapError(''); }}
                                >
                                    Buat akun admin pertama
                                </Button>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {employees.map(emp => (
                                <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => onLogin(emp)}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all duration-200 text-left"
                                >
                                    <span className="w-9 h-9 rounded-full bg-accent-100 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
                                        <UserRound className="w-4.5 h-4.5" />
                                    </span>
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{emp.name}</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => { setShowBootstrap(false); setBootstrapError(''); }}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-4 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Kembali
                        </button>
                        <h1 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-1">
                            Bikin akun admin pertama
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6">
                            Ini cuma bisa dilakukan sekali, sebelum ada admin lain
                        </p>
                        <div className="mb-5">
                            <Input
                                label="Nama"
                                placeholder="mis. Budi"
                                value={bootstrapName}
                                onChange={e => { setBootstrapName(e.target.value); setBootstrapError(''); }}
                                error={bootstrapError}
                            />
                        </div>
                        <Button
                            variant="dark"
                            size="full"
                            loading={creatingBootstrap}
                            onClick={handleCreateBootstrapAdmin}
                        >
                            Buat & Masuk
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
};

export default LoginView;
