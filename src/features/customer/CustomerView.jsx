import React from 'react';
import { useAppContext } from '../../context/AppContext';
// Menambahkan icon Save untuk mode edit pelanggan
import { Users, Plus, Ticket, Award, CheckCircle2, Info, Pencil, Trash2, Save, RotateCcw, X, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../utils/softDelete';
import { toLocalDateString, toLocalMonthString } from '../../utils/formatters';
import { Card, Input, Select, Button, EmptyState, BulkSelectBar } from '../../components/ui';
import { useBulkSelect } from '../../hook/useBulkSelect';

const CustomerView = () => {
  // Ambil triggerConfirm dari AppContext (pola yang sama seperti di EmployeesView)
  const { customers, setCustomers, vouchers, setVouchers, claimsHistory, triggerAlert, triggerConfirm, formatRupiah } = useAppContext();

  const [customerSubTab, setCustomerSubTab] = useState('manage');
  const [showTrashCustomers, setShowTrashCustomers] = useState(false);
  const [showTrashVouchers, setShowTrashVouchers] = useState(false);

  /* ── Filter Tanggal untuk Riwayat Klaim Reward (tab Loyalitas) ── */
  const [filterMode, setFilterMode] = useState('hari-ini'); // 'hari-ini' | 'kemarin' | 'bulan-ini' | 'semua' | 'tanggal-terpilih'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // State Search & Filter — Pelanggan
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSort, setCustomerSort] = useState('name'); // name | points-desc | points-asc
  const [isSelectingCustomers, setIsSelectingCustomers] = useState(false); // toggle mode "Pilih" utk bulk delete

  // State Search & Filter — Voucher
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherFilterType, setVoucherFilterType] = useState('all'); // all | fixed | percent
  const [isSelectingVouchers, setIsSelectingVouchers] = useState(false);

  // State Input Tambah Pelanggan Baru (form inline)
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustNamePhone] = useState('');

  // State Popup Edit Pelanggan (terpisah dari form tambah, supaya tidak bentrok)
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustPoints, setEditCustPoints] = useState('');

  // State Input & Edit Voucher
  const [newVoucherCode, setNewVoucherCode] = useState('');
  const [newVoucherDiscount, setNewVoucherDiscount] = useState('');
  const [newVoucherType, setNewVoucherType] = useState('fixed');
  const [newVoucherMinPurchase, setNewVoucherMinPurchase] = useState('');
  const [newVoucherQuota, setNewVoucherQuota] = useState('');
  const [editingVoucherId, setEditingVoucherId] = useState(null);


  // =========================================================================
  // LOGIKA: KELOLA PELANGGAN (Adaptasi Pola Manajemen Karyawan)
  // =========================================================================

  // 1. Fungsi untuk Menambah Pelanggan Baru (form inline)
  const handleSaveCustomer = () => {
    if (!newCustName) return triggerAlert('Nama pelanggan wajib diisi!');

    setCustomers([...customers, { id: `CUST-${Date.now()}`, name: newCustName, phone: newCustPhone, points: 0 }]);
    setNewCustName('');
    setNewCustNamePhone('');
    triggerAlert('Data Pelanggan berhasil ditambahkan!');
  };

  // 1b. Fungsi untuk Menyimpan Perubahan dari Popup Edit Pelanggan (termasuk poin manual)
  const handleUpdateCustomer = () => {
    if (!editCustName) return triggerAlert('Nama pelanggan wajib diisi!');

    setCustomers(customers.map(c => c.id === editingCustomerId ? {
      ...c,
      name: editCustName,
      phone: editCustPhone,
      points: Number(editCustPoints) || 0
    } : c));
    triggerAlert('Data Pelanggan berhasil diperbarui!');
    handleCancelEditCustomer();
  };

  // 2. Fungsi untuk Menghapus Pelanggan (DENGAN RE-FIX BINDING CALLBACK AGAR TIDAK LANGSUNG TERHAPUS)
  const handleDeleteCustomer = (id) => {
    // Membungkus aksi penghapusan dalam callback ()=>{} supaya hanya berjalan setelah tombol OK ditekan
    triggerConfirm('Pindahkan pelanggan ini ke Recycle Bin?', () => {
      setCustomers(customers.map(c => c.id === id ? markDeleted(c) : c));
      triggerAlert('Pelanggan dipindahkan ke Recycle Bin.');
      if (editingCustomerId === id) handleCancelEditCustomer();
    });
  };

  const handleRestoreCustomer = (id) => {
    setCustomers(customers.map(c => c.id === id ? restoreItem(c) : c));
    triggerAlert('Pelanggan berhasil dikembalikan.');
  };

  const handlePermanentDeleteCustomer = (id) => {
    triggerConfirm('Hapus PERMANEN pelanggan ini? Data riwayat poin mungkin kehilangan referensi nama. Tindakan ini tidak bisa dibatalkan.', () => {
      setCustomers(customers.filter(c => c.id !== id));
      triggerAlert('Pelanggan dihapus permanen.');
    });
  };

  // 3. Fungsi untuk Membuka Popup Edit Pelanggan
  const handleStartEditCustomer = (c) => {
    setEditingCustomerId(c.id);
    setEditCustName(c.name);
    setEditCustPhone(c.phone || '');
    setEditCustPoints(String(c.points ?? 0));
  };

  // 4. Fungsi untuk Menutup Popup Edit Pelanggan
  const handleCancelEditCustomer = () => {
    setEditingCustomerId(null);
    setEditCustName('');
    setEditCustPhone('');
    setEditCustPoints('');
  };


  // =========================================================================
  // LOGIKA: KELOLA VOUCHER (Diselaraskan menggunakan triggerConfirm)
  // =========================================================================

  const handleDeleteVoucher = (id) => {
    triggerConfirm('Pindahkan voucher ini ke Recycle Bin?', () => {
      setVouchers(vouchers.map(v => v.id === id ? markDeleted(v) : v));
      triggerAlert('Voucher dipindahkan ke Recycle Bin.');
      if (editingVoucherId === id) handleCancelEdit();
    });
  };

  const handleRestoreVoucher = (id) => {
    setVouchers(vouchers.map(v => v.id === id ? restoreItem(v) : v));
    triggerAlert('Voucher berhasil dikembalikan.');
  };

  const handlePermanentDeleteVoucher = (id) => {
    triggerConfirm('Hapus PERMANEN voucher ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setVouchers(vouchers.filter(v => v.id !== id));
      triggerAlert('Voucher dihapus permanen.');
    });
  };

  const handleStartEdit = (v) => {
    setEditingVoucherId(v.id);
    setNewVoucherCode(v.code);
    setNewVoucherType(v.discountType);
    setNewVoucherDiscount(v.discountValue);
    setNewVoucherMinPurchase(v.minPurchase);
    setNewVoucherQuota(v.quota);
  };

  const handleCancelEdit = () => {
    setEditingVoucherId(null);
    setNewVoucherCode('');
    setNewVoucherType('fixed');
    setNewVoucherDiscount('');
    setNewVoucherMinPurchase('');
    setNewVoucherQuota('');
  };

  const handleAddVoucher = () => {
    if (!newVoucherCode || !newVoucherDiscount || !newVoucherQuota) {
      return triggerAlert('Lengkapi data voucher termasuk kuota!');
    }

    if (editingVoucherId) {
      setVouchers(vouchers.map(v => v.id === editingVoucherId ? {
        ...v,
        code: newVoucherCode.toUpperCase(),
        discountType: newVoucherType,
        discountValue: Number(newVoucherDiscount),
        minPurchase: Number(newVoucherMinPurchase) || 0,
        quota: Number(newVoucherQuota)
      } : v));
      triggerAlert('Voucher berhasil diperbarui!');
      handleCancelEdit();
    } else {
      setVouchers([...vouchers, {
        id: `VCH-${Date.now()}`,
        code: newVoucherCode.toUpperCase(),
        discountType: newVoucherType,
        discountValue: Number(newVoucherDiscount),
        minPurchase: Number(newVoucherMinPurchase) || 0,
        quota: Number(newVoucherQuota)
      }]);
      setNewVoucherCode('');
      setNewVoucherDiscount('');
      setNewVoucherMinPurchase('');
      setNewVoucherQuota('');
      triggerAlert('Voucher siap digunakan!');
    }
  };

  const loyalCustomers = useMemo(() => [...activeOnly(customers)].sort((a, b) => b.points - a.points), [customers]);

  // Cek apakah tanggal klaim lolos filter aktif.
  // Perbandingan rentang tanggal pakai string "YYYY-MM-DD" langsung (toLocalDateString),
  // aman dibandingkan leksikografis tanpa perlu konversi ke Date/timestamp.
  const matchesDateFilter = (date) => {
    const d = toLocalDateString(date);
    if (filterMode === 'semua') return true;
    if (filterMode === 'hari-ini') return d === toLocalDateString();
    if (filterMode === 'kemarin') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return d === toLocalDateString(yesterday);
    }
    if (filterMode === 'bulan-ini') return toLocalMonthString(date) === toLocalMonthString();
    if (filterMode === 'tanggal-terpilih') {
      if (!filterStartDate) return true;
      // Hybrid: kalau filterEndDate kosong, otomatis single-day (= filterStartDate)
      const end = filterEndDate || filterStartDate;
      return d >= filterStartDate && d <= end;
    }
    return true;
  };

  const filteredClaimsHistory = useMemo(() => {
    return claimsHistory.filter(claim => matchesDateFilter(claim.date));
  }, [claimsHistory, filterMode, filterStartDate, filterEndDate]);

  // Daftar pelanggan & voucher yang sedang terlihat (sesuai mode Recycle Bin aktif)
  const visibleCustomers = showTrashCustomers ? trashedOnly(customers) : activeOnly(customers);
  const visibleVouchers = showTrashVouchers ? trashedOnly(vouchers) : activeOnly(vouchers);

  // Hasil filter search box + sort dropdown — Pelanggan
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    let list = q
      ? visibleCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q))
      : visibleCustomers;
    list = [...list];
    if (customerSort === 'points-desc') list.sort((a, b) => b.points - a.points);
    else if (customerSort === 'points-asc') list.sort((a, b) => a.points - b.points);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [visibleCustomers, customerSearch, customerSort]);

  // Hasil filter search box + filter tipe diskon — Voucher
  const filteredVouchers = useMemo(() => {
    const q = voucherSearch.trim().toLowerCase();
    let list = q ? visibleVouchers.filter(v => v.code.toLowerCase().includes(q)) : visibleVouchers;
    if (voucherFilterType !== 'all') list = list.filter(v => v.discountType === voucherFilterType);
    return list;
  }, [visibleVouchers, voucherSearch, voucherFilterType]);

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih" — Pelanggan (basis: hasil filter, bukan seluruh list)
  const { selectedIds: selectedCustomerIds, allSelected: allCustomersSelected, toggleOne: toggleSelectCustomer, toggleAll: toggleSelectAllCustomers, reset: resetCustomerSelection, count: customerSelectedCount } = useBulkSelect(filteredCustomers);

  const handleBulkSoftDeleteCustomers = () => {
    const ids = [...selectedCustomerIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} pelanggan terpilih ke Recycle Bin?`, () => {
      setCustomers(customers.map(c => selectedCustomerIds.has(c.id) ? markDeleted(c) : c));
      resetCustomerSelection();
      triggerAlert('Pelanggan terpilih dipindahkan ke Recycle Bin.');
    });
  };

  const handleBulkPermanentDeleteCustomers = () => {
    const ids = [...selectedCustomerIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} pelanggan terpilih? Data riwayat poin mungkin kehilangan referensi nama. Tindakan ini tidak bisa dibatalkan.`, () => {
      setCustomers(customers.filter(c => !selectedCustomerIds.has(c.id)));
      resetCustomerSelection();
      triggerAlert('Pelanggan terpilih dihapus permanen.');
    });
  };

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih" — Voucher (basis: hasil filter, bukan seluruh list)
  const { selectedIds: selectedVoucherIds, allSelected: allVouchersSelected, toggleOne: toggleSelectVoucher, toggleAll: toggleSelectAllVouchers, reset: resetVoucherSelection, count: voucherSelectedCount } = useBulkSelect(filteredVouchers);

  const handleBulkSoftDeleteVouchers = () => {
    const ids = [...selectedVoucherIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} voucher terpilih ke Recycle Bin?`, () => {
      setVouchers(vouchers.map(v => selectedVoucherIds.has(v.id) ? markDeleted(v) : v));
      resetVoucherSelection();
      triggerAlert('Voucher terpilih dipindahkan ke Recycle Bin.');
    });
  };

  const handleBulkPermanentDeleteVouchers = () => {
    const ids = [...selectedVoucherIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} voucher terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setVouchers(vouchers.filter(v => !selectedVoucherIds.has(v.id)));
      resetVoucherSelection();
      triggerAlert('Voucher terpilih dihapus permanen.');
    });
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col min-h-0 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="shrink-0">
        <div className="p-2 flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-6 overflow-x-auto hide-scrollbar">
          <Button
            variant={customerSubTab === 'manage' ? 'primary' : 'secondary'}
            onClick={() => setCustomerSubTab('manage')}
            className="whitespace-nowrap"
          >
            Kelola Pelanggan & Voucher
          </Button>

          <Button
            variant={customerSubTab === 'loyal' ? 'primary' : 'secondary'}
            onClick={() => setCustomerSubTab('loyal')}
            className="whitespace-nowrap"
          >
            Loyal Customers
          </Button>

          <Button
            variant={customerSubTab === 'voucher' ? 'primary' : 'secondary'}
            onClick={() => setCustomerSubTab('voucher')}
            className="whitespace-nowrap"
          >
            Voucher Diskon
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-10">

        {customerSubTab === 'manage' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300 ease-out h-full">

            {/* ========================================= */}
            {/* KOLOM 1: KELOLA PELANGGAN                 */}
            {/* ========================================= */}
            <Card padding="none" className="flex flex-col h-full min-h-[400px]">
              <div className="p-4 border-b bg-slate-50 dark:bg-slate-950 rounded-t-2xl font-bold text-slate-800 dark:text-slate-100 shrink-0 flex justify-between items-center">
                <span>{showTrashCustomers ? 'Recycle Bin' : 'Data Pelanggan'}</span>
                <button
                  onClick={() => { setShowTrashCustomers(v => !v); resetCustomerSelection(); setIsSelectingCustomers(false); }}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                >
                  {showTrashCustomers ? 'Kembali' : `Recycle Bin (${trashedOnly(customers).length})`}
                </button>
              </div>

              {/* Toolbar: Search + Sort + Toggle Mode Pilih (Bulk Delete) */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari nama / no. HP..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors text-slate-800 dark:text-slate-100"
                  />
                </div>
                <select
                  value={customerSort}
                  onChange={e => setCustomerSort(e.target.value)}
                  className="text-xs font-semibold px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none shrink-0 text-slate-600 dark:text-slate-300"
                >
                  <option value="name">Nama A-Z</option>
                  <option value="points-desc">Poin Tertinggi</option>
                  <option value="points-asc">Poin Terendah</option>
                </select>
                <button
                  onClick={() => { if (isSelectingCustomers) resetCustomerSelection(); setIsSelectingCustomers(v => !v); }}
                  className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors shrink-0 ${isSelectingCustomers ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-accent-600 dark:hover:text-accent-400'}`}
                >
                  {isSelectingCustomers ? 'Batal' : 'Pilih'}
                </button>
              </div>
              {!showTrashCustomers && (
                <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input variant="muted" type="text" placeholder="Nama Pelanggan" className="font-semibold" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
                    </div>
                    <div className="w-1/3">
                      <Input variant="muted" type="text" placeholder="No. Whatsapp" value={newCustPhone} onChange={e => setNewCustNamePhone(e.target.value)} />
                    </div>

                    {/* Form inline ini khusus TAMBAH pelanggan baru; edit pelanggan dilakukan lewat popup di bawah */}
                    <button
                      onClick={handleSaveCustomer}
                      className="px-4 py-2 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 duration-300 transition-colors flex items-center justify-center bg-accent-600 dark:bg-accent-500 hover:bg-accent-700 dark:hover:bg-accent-600"
                      title="Tambah Pelanggan"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-50 dark:bg-slate-950/30 custom-scrollbar">
                {isSelectingCustomers && filteredCustomers.length > 0 && (
                  <BulkSelectBar
                    count={customerSelectedCount}
                    total={filteredCustomers.length}
                    allSelected={allCustomersSelected}
                    onToggleAll={toggleSelectAllCustomers}
                    onDeleteSelected={showTrashCustomers ? handleBulkPermanentDeleteCustomers : handleBulkSoftDeleteCustomers}
                  />
                )}
                {filteredCustomers.map(c => (
                  <div key={c.id} className={`flex justify-between items-center p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm hover:border-accent-200 dark:hover:border-accent-500/30 transition-all duration-300 ${selectedCustomerIds.has(c.id) ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-start gap-2">
                      {isSelectingCustomers && (
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.has(c.id)}
                          onChange={() => toggleSelectCustomer(c.id)}
                          className="w-4 h-4 mt-0.5 rounded accent-orange-500 cursor-pointer shrink-0"
                        />
                      )}
                      <div>
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{c.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{c.phone || 'Tanpa No. HP'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-accent-100 dark:border-accent-500/20">{c.points} Poin</span>

                      {showTrashCustomers ? (
                        <>
                          <button
                            onClick={() => handleRestoreCustomer(c.id)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Kembalikan"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteCustomer(c.id)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Tambahan: Akses tombol Edit Pelanggan */}
                          <button
                            onClick={() => handleStartEditCustomer(c)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Edit Pelanggan"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Perbaikan Utama: onClick menggunakan Arrow Function agar tidak trigger instan */}
                          <button
                            onClick={() => handleDeleteCustomer(c.id)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors"
                            title="Hapus Pelanggan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <EmptyState size="sm" title={customerSearch ? 'Pelanggan tidak ditemukan.' : (showTrashCustomers ? 'Recycle bin kosong.' : 'Belum ada pelanggan')} />
                )}
              </div>
            </Card>

            {/* ========================================= */}
            {/* KOLOM 2: ATURAN POIN                      */}
            {/* ========================================= */}
            <Card padding="none" className="p-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl space-y-6 ease-out">
              <div className="flex items-center gap-2 border-b pb-3"><Info className="w-5 h-5 text-accent-600 dark:text-accent-400" /><h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base">Aturan Poin & Ketentuan Reward</h3></div>
              <div className="space-y-4">
                <div className="flex gap-3"><div className="w-6 h-6 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">1</div><div><h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-0.5">Cara Mendapatkan Poin</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Pelanggan terdaftar akan mendapatkan <strong className="text-accent-600 dark:text-accent-400">1 Poin untuk setiap transaksi kelipatan Rp 10.000</strong> dari total tagihan bersih (setelah diskon).</p></div></div>
                <div className="flex gap-3"><div className="w-6 h-6 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">2</div><div><h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-0.5">Nilai Tukar Poin</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Setiap <strong className="text-yellow-500 dark:text-yellow-400">1 Poin bernilai Rp 100</strong> potongan belanja langsung. Poin dapat langsung dikurangi dari total tagihan pada keranjang belanja saat checkout.</p></div></div>
                <div className="flex gap-3"><div className="w-6 h-6 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">3</div><div><h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm mb-0.5">Syarat Pelanggan & Member</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Pastikan nama pelanggan yang diinput pada saat transaksi di kasir sesuai dengan database member agar poin otomatis terhitung.</p></div></div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-500/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-500/20 shadow-sm"><p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium leading-relaxed"><strong>💡 Info Kasir:</strong> Anda dapat membantu pelanggan menukarkan poin mereka secara fleksibel melalui kolom "Klaim Poin" yang disediakan sejajar dengan voucher di keranjang pesanan.</p></div>
            </Card>

          </div>
        )}

        {customerSubTab === 'loyal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300 ease-out h-full">

            <Card padding="lg" className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl ease-out">
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400 dark:text-yellow-400" /> Peringkat Pelanggan Terloyal (Poin Terbanyak)</h3>
              <div className="space-y-3">
                {loyalCustomers.map((c, index) => (
                  <div key={c.id} className="flex justify-between items-center p-4 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-yellow-400 dark:hover:border-yellow-500/50 hover:shadow-md bg-white dark:bg-slate-900 transition-all duration-300 hover:-translate-y-0.5">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-full shadow-sm ${index === 0 ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-400 dark:ring-yellow-500' : index === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : index === 2 ? 'bg-accent-100 dark:bg-accent-500/15 text-accent-700 dark:text-accent-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{index + 1}</span>
                      <div><h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">{c.name}</h4><p className="text-xs text-slate-400 dark:text-slate-500">{c.phone || 'Tanpa No. HP'}</p></div>
                    </div>
                    <div className="text-right"><span className="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-black px-4 py-2 rounded-xl border border-yellow-200 dark:border-yellow-500/30 text-sm shadow-sm">{c.points} Poin</span></div>
                  </div>
                ))}
                {loyalCustomers.length === 0 && <EmptyState size="sm" title="Belum ada data pelanggan." />}
              </div>
            </Card>

            <Card padding="lg" className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl ease-out">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" /> Riwayat Klaim Reward & Tukar Poin</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={filterMode}
                    onChange={e => setFilterMode(e.target.value)}
                    className="py-1.5 px-2 text-xs font-bold"
                  >
                    <option value="hari-ini">Hari Ini</option>
                    <option value="kemarin">Kemarin</option>
                    <option value="bulan-ini">Bulan Ini</option>
                    <option value="semua">Semua</option>
                    <option value="tanggal-terpilih">Tanggal Terpilih</option>
                  </Select>

                  {filterMode === 'tanggal-terpilih' && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                        max={filterEndDate || undefined}
                        className="py-1.5 px-2 text-xs font-bold"
                      />
                      <span className="text-xs text-slate-400">-</span>
                      <Input
                        type="date"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                        min={filterStartDate || undefined}
                        className="py-1.5 px-2 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {filteredClaimsHistory.map(claim => (
                  <div key={claim.id} className="flex justify-between items-center p-3.5 border border-green-100 dark:border-green-500/20 bg-green-50 dark:bg-green-500/20 rounded-2xl hover:bg-green-50 dark:hover:bg-green-500/40 transition-colors duration-300">
                    <div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{claim.customerName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{claim.rewardName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{new Date(claim.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-500/30 shadow-sm">Selesai Klaim (-{claim.pointsUsed} Pts)</span>
                  </div>
                ))}
                {filteredClaimsHistory.length === 0 && <EmptyState size="sm" title="Belum ada riwayat klaim reward pada periode ini." />}
              </div>
            </Card>

          </div>
        )}

        {customerSubTab === 'voucher' && (

          <Card padding="none" className="flex flex-col h-full min-h-[400px]">
            <div
              className="p-4 border-b bg-slate-50 dark:bg-slate-950 rounded-t-2xl font-bold text-slate-800 dark:text-slate-100 shrink-0 flex justify-between items-center">
              <span>{showTrashVouchers ? 'Recycle Bin' : 'Voucher Diskon Aktif'}</span>
              <button onClick={() => { setShowTrashVouchers(v => !v); resetVoucherSelection(); setIsSelectingVouchers(false); }}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400
      transition-colors"
              >
                {showTrashVouchers ? 'Kembali' : `Recycle Bin (${trashedOnly(vouchers).length})`}
              </button>
            </div>

            {/* Toolbar: Search + Filter Tipe Diskon + Toggle Mode Pilih (Bulk Delete) */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari kode voucher..."
                  value={voucherSearch}
                  onChange={e => setVoucherSearch(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors uppercase text-slate-800 dark:text-slate-100"
                />
              </div>
              <select
                value={voucherFilterType}
                onChange={e => setVoucherFilterType(e.target.value)}
                className="text-xs font-semibold px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none shrink-0 text-slate-600 dark:text-slate-300"
              >
                <option value="all">Semua Tipe</option>
                <option value="fixed">Nominal (Rp)</option>
                <option value="percent">Persen (%)</option>
              </select>
              <button
                onClick={() => { if (isSelectingVouchers) resetVoucherSelection(); setIsSelectingVouchers(v => !v); }}
                className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors shrink-0 ${isSelectingVouchers ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-accent-600 dark:hover:text-accent-400'}`}
              >
                {isSelectingVouchers ? 'Batal' : 'Pilih'}
              </button>
            </div>

            {!showTrashVouchers && (
              <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <Input type="text" placeholder="KODE VOUCHER (Maks 10 huruf)" variant="muted"
                  className="uppercase tracking-wider font-bold" value={newVoucherCode} maxLength={10} onChange={e =>
                    setNewVoucherCode(e.target.value)}
                />

                <div className="flex gap-2">
                  <div className="w-1/3">
                    <Select variant="muted" className="font-semibold" value={newVoucherType} onChange={e =>
                      setNewVoucherType(e.target.value)}
                    >
                      <option value="fixed">Nominal (Rp)</option>
                      <option value="percent">Persen (%)</option>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Input type="number" placeholder="Nilai Potongan" variant="muted"
                      className="font-bold text-accent-600 dark:text-accent-400" value={newVoucherDiscount} onChange={e =>
                        setNewVoucherDiscount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input type="number" placeholder="Syarat Minimal Belanja (Opsional)" variant="muted"
                      value={newVoucherMinPurchase} onChange={e => setNewVoucherMinPurchase(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3">
                    <Input type="number" placeholder="Kuota" variant="muted" value={newVoucherQuota} onChange={e =>
                      setNewVoucherQuota(e.target.value)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button onClick={handleAddVoucher} className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-md
        transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 ${editingVoucherId
                      ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                      : 'bg-accent-600 dark:bg-accent-500 hover:bg-accent-700 dark:hover:bg-accent-600'}`}>
                    <Ticket className="w-4 h-4" />
                    {editingVoucherId ? 'Perbarui Voucher' : 'Simpan Voucher'}
                  </button>

                  {editingVoucherId && (
                    <Button variant="secondary" onClick={handleCancelEdit}>
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-50 dark:bg-slate-950/30 custom-scrollbar">
              {isSelectingVouchers && filteredVouchers.length > 0 && (
                <BulkSelectBar
                  count={voucherSelectedCount}
                  total={filteredVouchers.length}
                  allSelected={allVouchersSelected}
                  onToggleAll={toggleSelectAllVouchers}
                  onDeleteSelected={showTrashVouchers ? handleBulkPermanentDeleteVouchers : handleBulkSoftDeleteVouchers}
                />
              )}
              {filteredVouchers.map(v => (
                <div key={v.id}
                  className={`flex justify-between items-center p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm relative overflow-hidden transition-shadow duration-300 ${selectedVoucherIds.has(v.id) ? 'border-orange-500 ring-1 ring-orange-500' : 'border-accent-100 dark:border-accent-500/20'}`}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-accent-600 dark:bg-accent-500"></div>
                  <div className="flex items-start gap-2 pl-3">
                    {isSelectingVouchers && (
                      <input
                        type="checkbox"
                        checked={selectedVoucherIds.has(v.id)}
                        onChange={() => toggleSelectVoucher(v.id)}
                        className="w-4 h-4 mt-0.5 rounded accent-orange-500 cursor-pointer shrink-0"
                      />
                    )}
                    <div>
                      <p className="font-black text-accent-600 dark:text-accent-400 tracking-wider text-sm">{v.code}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Min. Order: {formatRupiah(v.minPurchase)} &bull; Sisa Kuota: <span
                          className="font-bold text-accent-600 dark:text-accent-400">{v.quota || 0}x</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold text-sm text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      Diskon {v.discountType === 'percent' ? `${v.discountValue}%` : formatRupiah(v.discountValue)}
                    </span>

                    {showTrashVouchers ? (
                      <>
                        <button onClick={() => handleRestoreVoucher(v.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400
            hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Kembalikan"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePermanentDeleteVoucher(v.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400
            hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors"
                          title="Hapus Permanen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(v)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400
            hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Voucher"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button onClick={() => handleDeleteVoucher(v.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400
            hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors"
                          title="Hapus Voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredVouchers.length === 0 && (
                <EmptyState size="sm" title={voucherSearch ? 'Voucher tidak ditemukan.' : (showTrashVouchers ? 'Recycle bin kosong.' : 'Belum ada voucher')} />
              )}
            </div>
          </Card>

        )}

      </div>

      {/* ========================================= */}
      {/* POPUP: EDIT DATA PELANGGAN (termasuk edit poin manual) */}
      {/* ========================================= */}
      {editingCustomerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCancelEditCustomer}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base">Edit Data Pelanggan</h3>
              <button
                onClick={handleCancelEditCustomer}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nama Pelanggan</label>
                <Input variant="muted" type="text" placeholder="Nama Pelanggan" value={editCustName} onChange={e => setEditCustName(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">No. Whatsapp</label>
                <Input variant="muted" type="text" placeholder="No. Whatsapp" value={editCustPhone} onChange={e => setEditCustPhone(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Poin (bisa diedit manual)</label>
                <Input variant="muted" type="number" placeholder="Poin" value={editCustPoints} onChange={e => setEditCustPoints(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={handleCancelEditCustomer} className="flex-1">
                Batal
              </Button>
              <button
                onClick={handleUpdateCustomer}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 duration-300 transition-colors flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Save className="w-4 h-4" />
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerView;