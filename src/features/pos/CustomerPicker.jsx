import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { activeOnly } from '../../utils/softDelete';
import { generateUUID } from '../../utils/formatters';
import { X, Search, UserPlus, Award, User } from 'lucide-react';

/**
 * CustomerPickerModal
 * ────────────────────
 * Satu-satunya pintu masuk untuk menentukan pelanggan transaksi.
 *
 * Kenapa ini dibikin sebagai modal terpisah (bukan input bebas di CartDrawer):
 * - Kolom "cari" di sini TIDAK PERNAH langsung jadi customerName tersimpan.
 *   Ketikan cuma dipakai buat filter list / munculin opsi "tambah baru".
 *   Yang beneran commit ke state cuma 3 aksi eksplisit: pilih dari list,
 *   tambah baru, atau pilih "Tamu". Ini nutup celah "ngetik tapi lupa klik"
 *   secara struktural, karena gak ada state "nanggung" yang bisa lolos ke checkout.
 * - Pilih customer selalu lewat object utuh (pakai ID), bukan re-match nama.
 *   Jadi gak ada resiko salah cocok gara-gara typo/spasi/duplikat nama.
 * - Tambah pelanggan baru langsung nge-set jadi pelanggan aktif di aksi yang
 *   sama (satu klik) — gak ada jeda di mana pelanggan baru dibuat tapi belum
 *   ke-attach ke transaksi.
 */
const CustomerPickerModal = ({ isOpen, onClose }) => {
  const {
    customers, setCustomers, setCustomerName, setSelectedCustomerId,
    activeCustomer, triggerAlert,
  } = useAppContext();

  const [query, setQuery] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const searchInputRef = useRef(null);

  // Fix: fokus ditunda sampe animasi modal (duration-200/300) beres, BUKAN
  // autoFocus langsung pas mount. Di Capacitor Android WebView, autoFocus
  // yang mancing keyboard muncul BARENGAN sama CSS transition slide-in bikin
  // dua proses rebutan (resize viewport buat keyboard vs animasi geser),
  // hasilnya jeda/jank ~1 detik pas modal dibuka. Nunda dikit lewat
  // setTimeout ngilangin race-nya sepenuhnya.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setQuery('');
    setNewPhone('');
    onClose();
  };

  const q = query.trim().toLowerCase();
  const activeCustomers = activeOnly(customers);
  const matches = q
    ? activeCustomers.filter(c =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(query.trim()))
      )
    : activeCustomers;

  const handleSelect = (customer) => {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    handleClose();
  };

  const handleGuest = () => {
    setCustomerName('');
    setSelectedCustomerId(null);
    handleClose();
  };

  const handleAddNew = () => {
    const name = query.trim();
    if (!name) return;

    // Cegah duplikat nama persis — kalau udah ada, arahkan pilih dari list
    // aja daripada bikin 2 record dengan nama sama (bikin matching ambigu lagi
    // di masa depan buat siapa pun yang masih ngandelin nama, misal laporan).
    const exists = activeCustomers.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      triggerAlert('Nama ini sudah terdaftar. Pilih dari daftar di atas, ya.');
      return;
    }

    const newCustomer = {
      id: `CUST-${generateUUID()}`, // UUID, bukan Date.now() — aman dari collision antar-device pas sync
      name,
      phone: newPhone.trim(),
      points: 0,
    };
    setCustomers([...customers, newCustomer]);
    handleSelect(newCustomer);
    triggerAlert('Pelanggan baru berhasil ditambahkan & langsung dipilih!');
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300"
      onClick={handleClose}
    >
      <div
        className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom md:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Pilih Pelanggan</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / no. HP..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-accent-500 dark:focus:border-accent-400 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 custom-scrollbar">
          <button
            onClick={handleGuest}
            className={`w-full flex items-center gap-2 p-3 rounded-xl border mb-2 text-left transition-colors ${
              !activeCustomer
                ? 'border-accent-300 bg-accent-50 dark:bg-accent-500/10 dark:border-accent-500/30'
                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
            }`}
          >
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Lanjut sebagai Tamu (tanpa poin)</span>
          </button>

          {matches.length > 0 ? (
            <div className="space-y-1.5">
              {matches.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                    activeCustomer?.id === c.id
                      ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10'
                      : 'border-slate-100 dark:border-slate-800 hover:border-accent-200 dark:hover:border-accent-500/30'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{c.phone || 'Tanpa No. HP'}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-md border border-yellow-200 dark:border-yellow-500/30 flex items-center gap-1 shrink-0 ml-2">
                    <Award className="w-3 h-3" /> {c.points} Pts
                  </span>
                </div>
              ))}
            </div>
          ) : q ? (
            <div className="text-center py-6 text-xs text-slate-400">Gak ada pelanggan cocok dengan "{query}"</div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">Belum ada pelanggan terdaftar</div>
          )}
        </div>

        {q && matches.length === 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-blue-50/50 dark:bg-blue-500/5">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Tambahkan "{query}" sebagai pelanggan baru
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="No. WhatsApp (opsional)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="flex-1 text-xs p-2.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
              >
                Tambah
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPickerModal;