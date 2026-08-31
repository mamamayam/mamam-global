import { useState, useEffect, useCallback } from 'react';
import { Plus, ShieldCheck, UserRound, Power, KeyRound } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Card, Button, Modal, Input, Select, Badge, EmptyState } from '../components/ui';
import PinPad from './PinPad';

// Lihat komentar sejenis di LoginView.jsx -- dynamic import sengaja, biar
// konsisten sama cara syncClient.js di-load di tempat lain (App.jsx, dst)
// dan gak numpuk @supabase/supabase-js ke chunk view yang salah.
const loadSupabase = () => import('../storage/syncClient').then(m => m.getSupabaseClient());

/**
 * AccountView — "Manajemen Akun" di sidebar. Admin-only (sudah digate lewat
 * visibleMenus di App.jsx berdasar isAdminMode, tapi dicek ulang di sini
 * juga sebagai lapis kedua kalau-kalau ke-akses langsung).
 *
 * Bikin akun baru LEWAT Edge Function `create-employee` (bukan insert
 * langsung ke tabel employees) -- karena bikin akun = harus bikin baris
 * auth.users juga (auth.admin.createUser, butuh service role key yang gak
 * boleh nempel di client). Ubah status aktif/nonaktif aman langsung lewat
 * client biasa (RLS: admin_update_employees).
 */
const AccountView = () => {
    const { currentEmployee, isAdminMode } = useAppContext();

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('staff');
    const [pinAttempt, setPinAttempt] = useState(0);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const [togglingId, setTogglingId] = useState(null);

    const [pinResetTarget, setPinResetTarget] = useState(null); // employee row yang lagi diubah PIN-nya
    const [pinResetAttempt, setPinResetAttempt] = useState(0);
    const [resettingPin, setResettingPin] = useState(false);
    const [pinResetError, setPinResetError] = useState('');

    // SENGAJA gak setLoading(true)/setLoadError('') di awal function ini --
    // itu bikin setState jalan SINKRON pas dipanggil langsung dari body
    // effect (useEffect(() => { loadEmployees(); }, ...) di bawah). State
    // awalnya (loading=true, loadError='') udah nutup kasus pertama kali
    // dipanggil (mount); setState yang beneran jalan cuma yang di
    // try/catch/finally, yaitu SETELAH await -- itu aman, gak sinkron lagi
    // relatif ke effect-nya.
    const loadEmployees = useCallback(async () => {
        try {
            const supabase = await loadSupabase();
            if (!supabase) { setLoadError('Supabase belum dikonfigurasi.'); return; }
            const { data, error } = await supabase
                .from('employees')
                .select('id, name, role, is_active, created_at')
                .order('created_at');
            if (error) throw error;
            setEmployees(data || []);
        } catch (err) {
            console.warn('[AccountView] gagal ambil daftar karyawan:', err.message);
            setLoadError('Gagal memuat daftar akun.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!cancelled) await loadEmployees();
        })();
        return () => { cancelled = true; };
    }, [loadEmployees]);

    const resetAddForm = () => {
        setNewName('');
        setNewRole('staff');
        setCreateError('');
        setPinAttempt(a => a + 1); // remount PinPad, kosongin digit
    };

    const handleCreate = async (pin) => {
        if (!newName.trim()) {
            setCreateError('Nama wajib diisi dulu sebelum masukin PIN');
            return;
        }
        setCreating(true);
        setCreateError('');
        try {
            const supabase = await loadSupabase();
            const { data, error } = await supabase.functions.invoke('create-employee', {
                body: { name: newName.trim(), pin, role: newRole },
            });
            // supabase-js gak selalu ngelempar `error` buat non-2xx response
            // dari Edge Function -- body-nya sendiri yang bawa pesan errornya.
            if (error || data?.error) {
                setCreateError(data?.error || error.message || 'Gagal membuat akun');
                setPinAttempt(a => a + 1);
                return;
            }
            setShowAddModal(false);
            resetAddForm();
            await loadEmployees();
        } catch (err) {
            console.warn('[AccountView] create-employee error:', err.message);
            setCreateError('Gagal terhubung ke server, coba lagi');
            setPinAttempt(a => a + 1);
        } finally {
            setCreating(false);
        }
    };

    const handleResetPin = async (newPin) => {
        if (!pinResetTarget) return;
        setResettingPin(true);
        setPinResetError('');
        try {
            const supabase = await loadSupabase();
            const { data, error } = await supabase.functions.invoke('reset-employee-pin', {
                body: { employeeId: pinResetTarget.id, newPin },
            });
            if (error || data?.error) {
                setPinResetError(data?.error || error.message || 'Gagal ubah PIN');
                setPinResetAttempt(a => a + 1);
                return;
            }
            setPinResetTarget(null);
        } catch (err) {
            console.warn('[AccountView] reset-employee-pin error:', err.message);
            setPinResetError('Gagal terhubung ke server, coba lagi');
            setPinResetAttempt(a => a + 1);
        } finally {
            setResettingPin(false);
        }
    };

    const toggleActive = async (emp) => {
        setTogglingId(emp.id);
        try {
            const supabase = await loadSupabase();
            const { error } = await supabase
                .from('employees')
                .update({ is_active: !emp.is_active })
                .eq('id', emp.id);
            if (error) throw error;
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e));
        } catch (err) {
            console.warn('[AccountView] toggle active gagal:', err.message);
        } finally {
            setTogglingId(null);
        }
    };

    if (!isAdminMode) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={<ShieldCheck className="w-10 h-10" />}
                    title="Khusus Admin"
                    description="Menu ini cuma bisa diakses akun dengan role Admin."
                />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-heading font-black text-lg text-slate-800 dark:text-slate-100">Manajemen Akun</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Kelola siapa aja yang bisa masuk ke aplikasi ini</p>
                </div>
                <Button variant="dark" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
                    Tambah
                </Button>
            </div>

            {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat...</p>}
            {!loading && loadError && <p className="text-sm text-accent-500 text-center py-8">{loadError}</p>}

            {!loading && !loadError && (
                <div className="flex flex-col gap-2">
                    {employees.map(emp => (
                        <Card key={emp.id} padding="sm" className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
                                <UserRound className="w-5 h-5" />
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">
                                    {emp.name}
                                    {emp.id === currentEmployee?.id && (
                                        <span className="text-slate-400 dark:text-slate-500 font-medium"> (kamu)</span>
                                    )}
                                </p>
                                <Badge variant={emp.role === 'admin' ? 'orange' : 'neutral'} size="sm">
                                    {emp.role === 'admin' ? 'Admin' : 'Kasir'}
                                </Badge>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setPinResetTarget(emp); setPinResetError(''); }}
                                title="Ubah PIN"
                                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                            >
                                <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleActive(emp)}
                                disabled={togglingId === emp.id || emp.id === currentEmployee?.id}
                                title={emp.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-30
                                    ${emp.is_active
                                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                        : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Power className="w-4 h-4" />
                            </button>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                isOpen={showAddModal}
                onClose={() => { setShowAddModal(false); resetAddForm(); }}
                title="Tambah Akun Baru"
                size="sm"
            >
                <div className="space-y-4">
                    <Input
                        label="Nama"
                        placeholder="mis. Budi"
                        value={newName}
                        onChange={e => { setNewName(e.target.value); setCreateError(''); }}
                    />
                    <Select label="Role" value={newRole} onChange={e => setNewRole(e.target.value)}>
                        <option value="staff">Kasir</option>
                        <option value="admin">Admin</option>
                    </Select>
                    <div className="pt-2">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 text-center">
                            PIN 6 digit buat akun ini
                        </p>
                        <PinPad
                            key={pinAttempt}
                            length={6}
                            onComplete={handleCreate}
                            error={createError}
                            disabled={creating}
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!pinResetTarget}
                onClose={() => setPinResetTarget(null)}
                title={`Ubah PIN — ${pinResetTarget?.name ?? ''}`}
                size="sm"
            >
                <div className="pt-2">
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-4">
                        Masukkan PIN baru 6 digit buat akun ini
                    </p>
                    <PinPad
                        key={pinResetAttempt}
                        length={6}
                        onComplete={handleResetPin}
                        error={pinResetError}
                        disabled={resettingPin}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default AccountView;
