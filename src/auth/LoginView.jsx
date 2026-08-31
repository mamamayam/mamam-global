import { useState, useEffect } from 'react';
import { UserRound, ChevronLeft, Store } from 'lucide-react';
import { Card } from '../components/ui';
import PinPad from './PinPad';

// SENGAJA dynamic import (bukan `import { getSupabaseClient } from
// '../storage/syncClient'` di atas) -- syncClient.js sudah di-import
// dynamic di banyak tempat lain (App.jsx, dst) supaya @supabase/supabase-js
// tetap kepisah ke chunk-nya sendiri, bukan numpuk ke chunk view manapun.
// Kalau di sini pakai static import, Rollup kebingungan nge-split-nya dan
// bisa nge-gembungin chunk view yang gak nyambung sama sekali (kejadian:
// bikin chunk EmployeesView.jsx melonjak ke >1.5MB).
const loadSupabase = () => import('../storage/syncClient').then(m => m.getSupabaseClient());

/**
 * LoginView — gerbang masuk aplikasi. Ditampilkan App.jsx kalau belum ada
 * sesi employee ASLI yang login (lihat effect auth di App.jsx: device
 * SELALU punya sesi anonim otomatis dari getSupabaseClient()/ensureAuthSession
 * di syncClient.js buat keperluan sync -- itu SENGAJA tidak dianggap
 * "sudah login" di sini, yang dicek App.jsx adalah user.is_anonymous === false).
 *
 * Alurnya 2 langkah (pilih nama -> baru PIN), bukan 1 form nama+PIN
 * sekaligus: di kasir yang dipegang gantian, milih dari daftar jauh lebih
 * cepat daripada ngetik nama tiap kali.
 */
const LoginView = () => {
    const [employees, setEmployees] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [listError, setListError] = useState('');
    const [selected, setSelected] = useState(null); // { id, name }
    const [signingIn, setSigningIn] = useState(false);
    const [pinError, setPinError] = useState('');
    const [pinAttempt, setPinAttempt] = useState(0); // ganti key PinPad biar remount bersih tiap percobaan

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const supabase = await loadSupabase();
                if (!supabase) {
                    if (!cancelled) setListError('Supabase belum dikonfigurasi.');
                    return;
                }
                const { data, error } = await supabase
                    .from('employees')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('name');
                if (error) throw error;
                if (!cancelled) setEmployees(data || []);
            } catch (err) {
                console.warn('[LoginView] gagal ambil daftar karyawan:', err.message);
                if (!cancelled) setListError('Gagal memuat daftar akun. Cek koneksi internet.');
            } finally {
                if (!cancelled) setLoadingList(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handlePinComplete = async (pin) => {
        if (!selected) return;
        setSigningIn(true);
        setPinError('');
        try {
            const supabase = await loadSupabase();
            const { error } = await supabase.auth.signInWithPassword({
                email: `${selected.id}@mamam.internal`,
                password: pin,
            });
            if (error) {
                setPinError('PIN salah, coba lagi');
                setPinAttempt(a => a + 1);
                return;
            }
            // Sukses -> App.jsx nangkep perubahan sesi lewat onAuthStateChange,
            // gak perlu callback manual di sini.
        } catch (err) {
            console.warn('[LoginView] signInWithPassword error:', err.message);
            setPinError('Gagal terhubung ke server, coba lagi');
            setPinAttempt(a => a + 1);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center mb-6 shadow-lg shadow-accent-500/20">
                <Store className="w-8 h-8 text-white" />
            </div>

            <Card variant="elevated" padding="lg" className="w-full max-w-sm">
                {!selected ? (
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
                            <p className="text-sm text-slate-400 text-center py-6">
                                Belum ada akun terdaftar. Minta admin untuk membuatkan akun di menu Manajemen Akun.
                            </p>
                        )}

                        <div className="flex flex-col gap-2">
                            {employees.map(emp => (
                                <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => { setSelected(emp); setPinError(''); }}
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
                            onClick={() => { setSelected(null); setPinError(''); }}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-4 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Ganti akun
                        </button>
                        <h1 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-1">
                            Halo, {selected.name}
                        </h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6">
                            Masukkan PIN 6 digit kamu
                        </p>
                        <PinPad
                            key={pinAttempt}
                            length={6}
                            onComplete={handlePinComplete}
                            error={pinError}
                            disabled={signingIn}
                        />
                    </>
                )}
            </Card>
        </div>
    );
};

export default LoginView;
