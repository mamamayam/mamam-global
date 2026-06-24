import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { activeOnly } from "../../utils/softDelete";
import {
  ShoppingCart,
  Trash2,
  X,
  Save,
  Award,
  Info,
  Truck,
  Edit3,
  Minus,
  Plus,
  Ticket,
  ChevronRight
} from 'lucide-react';

const CartDrawer = () => {
  // Tambahan: Destructure 'setCustomers' dari appContext
  const { menus, setSelectedMenuForVariant, setVariantSelectedOptions, setEditingCartItemId,
    setCurrentView, isCartOpen, setIsCartOpen, cart, setCart, savedBills, triggerConfirm, formatRupiah, activeCustomer, customerName, setCustomerName, isCustomerDropdownMode, setIsCustomerDropdownMode, customers, setCustomers, orderType, setOrderType, deliveryFee, setDeliveryFee, customDeliveryFee, setCustomDeliveryFee, updateCartQty, updateCartItemNote, voucherInputCode, setVoucherInputCode, vouchers, appliedVoucher, setAppliedVoucher, getSubtotal, triggerAlert, pointsToRedeem, setPointsToRedeem, getPointDiscount, manualDiscount, setManualDiscount, getManualDiscountAmount, storeSettings, getDiscount, getTaxAmount, getServiceChargeAmount, getTotal, handleOpenBill, setPaymentModal, loadSavedBill } = useAppContext();

  // Tambahan: Local state untuk input nomor HP pelanggan baru via Kasir
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const handleEditVariant = (cartItem) => {
    const originalMenu = menus.find(m => m.id === cartItem.menuId);
    if (originalMenu) {
      setSelectedMenuForVariant(originalMenu);
      setVariantSelectedOptions(cartItem.variantSelectedOptions || {});
      setEditingCartItemId(cartItem.cartItemId);
      setIsCartOpen(false);
    }
  };

  if (!isCartOpen) return null;

  setCurrentView('kasir');

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 bg-slate-500/30 dark:bg-slate-800/40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsCartOpen(false)} />
      <div className="w-full md:w-[420px] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300 ease-out">

        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <h2 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-800 dark:text-slate-100" /> Keranjang Pesanan
          </h2>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={() => triggerConfirm('Hapus semua isi keranjang?', () => setCart([]))} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors" title="Kosongkan Keranjang">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20 text-slate-400 dark:text-slate-500" />
              <p className="text-slate-400 dark:text-slate-500 mb-6">Keranjang masih kosong</p>
              {savedBills.length > 0 && (
                <div className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
                  <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3 text-sm">
                    <Save className="w-4 h-4 text-orange-600 dark:text-orange-400" /> Bill Tersimpan ({savedBills.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedBills.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center p-3 border border-orange-100 dark:border-orange-500/20 rounded-xl bg-orange-50 dark:bg-orange-500/30">
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{bill.customerName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{bill.cart.length} Item • {bill.date.toLocaleTimeString('id-ID')}</p>
                        </div>
                        <button onClick={() => loadSavedBill(bill)} className="px-3 py-1.5 bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-500/20 transition-colors">
                          Lanjut
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* --- CUSTOMER INPUT --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nama Pelanggan</label>
                  <div className="flex items-center gap-2">
                    {activeCustomer ? (
                      <span className="text-[10px] font-bold bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400 px-2 py-0.5 rounded-md border border-green-200 dark:border-green-500/30 flex items-center gap-1 animate-in fade-in duration-300">
                        <Award className="w-3 h-3" /> <span className="hidden md:inline">Terdaftar</span> ({activeCustomer.points} Pts)
                      </span>
                    ) : customerName.trim() !== '' && !isCustomerDropdownMode ? (
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 italic hidden md:block">Guest</span>
                    ) : null}

                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Daftar</span>
                      <button
                        onClick={() => {
                          setIsCustomerDropdownMode(!isCustomerDropdownMode);
                          if (!activeCustomer) setCustomerName('');
                        }}
                        className={`w-7 h-4 rounded-full relative transition-colors duration-300 ${isCustomerDropdownMode ? 'bg-orange-600 dark:bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <div className={`w-3 h-3 bg-white dark:bg-slate-900 rounded-full absolute top-0.5 transition-transform duration-300 ${isCustomerDropdownMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {isCustomerDropdownMode ? (
                  <select
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border-b-2 border-slate-100 dark:border-slate-800 focus:border-orange-600 dark:focus:border-orange-500 pb-2 focus:outline-none bg-transparent transition-colors font-semibold text-slate-800 dark:text-slate-100 text-sm cursor-pointer"
                  >
                    <option value="">-- Pilih Pelanggan (Guest) --</option>
                    {activeOnly(customers).map(c => (
                      <option key={c.id} value={c.name}>{c.name} - {c.phone || 'Tanpa HP'} ({c.points} Pts)</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ketik nama / no. HP pelanggan..." className="w-full border-b-2 border-slate-100 dark:border-slate-800 focus:border-orange-600 dark:focus:border-orange-500 pb-2 focus:outline-none bg-transparent transition-colors font-semibold text-slate-800 dark:text-slate-100 text-sm" />
                )}

                {/* Fix Suggestion logic: Includes Phone numbers as well */}
                {!isCustomerDropdownMode && customerName.trim() !== '' && !activeCustomer && activeOnly(customers).filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || (c.phone && c.phone.includes(customerName))).length > 0 && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 bg-orange-50 dark:bg-orange-500/50 border border-orange-100 dark:border-orange-500/20 p-2 rounded-xl">
                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> Maksud Anda pelanggan ini?</p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                      {activeOnly(customers).filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || (c.phone && c.phone.includes(customerName))).map(sc => (
                        <div key={sc.id} onClick={() => setCustomerName(sc.name)} className="flex justify-between items-center bg-white dark:bg-slate-900 border border-orange-100 dark:border-orange-500/20 p-2 rounded-lg cursor-pointer hover:border-orange-300 dark:hover:border-orange-500/40 hover:shadow-sm transition-all">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{sc.name}</span>
                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{sc.phone || 'Tidak ada No. HP'}</span>
                          </div>
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-500/30">Pilih</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- TAMBAH PELANGGAN BARU JIKA TIDAK DITEMUKAN --- */}
                {!isCustomerDropdownMode && customerName.trim() !== '' && !activeCustomer && activeOnly(customers).filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || (c.phone && c.phone.includes(customerName))).length === 0 && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3 rounded-xl">
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Pelanggan belum terdaftar
                    </p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="No. Whatsapp (Opsional)"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors"
                      />
                      <button
                        onClick={() => {
                          const newCustomer = {
                            id: `CUST-${Date.now()}`,
                            name: customerName,
                            phone: newCustomerPhone,
                            points: 0
                          };
                          setCustomers([...customers, newCustomer]);
                          setNewCustomerPhone('');
                          triggerAlert('Pelanggan berhasil ditambahkan & langsung aktif!');
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors flex justify-center items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3 h-3" /> Tambahkan ke Database
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* --- ORDER TYPE --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Tipe Pesanan</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Takeaway', 'Dine-in', 'Delivery', 'Ojol'].map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setOrderType(type);
                        if (type !== 'Delivery') setDeliveryFee(0);

                        // RESET DISKON, POIN, DAN VOUCHER JIKA PILIH OJOL
                        if (type === 'Ojol') {
                          setAppliedVoucher(null);
                          setPointsToRedeem(0);
                          setManualDiscount({ type: 'fixed', value: 0 });
                        }
                      }}
                      className={`py-2 px-3 text-sm rounded-xl font-bold transition-all duration-200 ${orderType === type
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === 'Delivery' && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-500/20 animate-in slide-in-from-top-3 duration-300">
                  <label className="block text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1"><Truck className="w-3 h-3" /> Biaya Pengiriman</label>
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
                    {[0, 3000, 5000].map(fee => (
                      <button key={fee} onClick={() => { setDeliveryFee(fee); setCustomDeliveryFee(''); }} className={`snap-center shrink-0 py-2 px-4 rounded-xl border font-bold text-sm transition-all whitespace-nowrap ${deliveryFee === fee && !customDeliveryFee ? 'bg-orange-600 dark:bg-orange-500 text-white border-orange-600 dark:border-orange-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950'}`}>
                        {fee === 0 ? 'Gratis' : formatRupiah(fee)}
                      </button>
                    ))}
                    <div className="snap-center shrink-0 flex items-center gap-2 border rounded-xl px-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[140px]">
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold pl-2">Rp</span>
                      <input type="number" placeholder="Custom" className="w-full py-2 bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-slate-200" value={customDeliveryFee} onChange={(e) => { setCustomDeliveryFee(e.target.value); setDeliveryFee(Number(e.target.value) || 0); }} />
                    </div>
                  </div>
                </div>
              )}

              {/* --- CART ITEMS --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Daftar Pesanan</label>
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-slate-50 dark:border-slate-900 pb-3 last:border-0 last:pb-0 animate-in fade-in duration-300">
                    <div className="flex-1 pr-2">
                      <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{item.name}</h4>
                      {item.variantName && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {item.variantName}
                          </p>
                          <button
                            onClick={() => handleEditVariant(item)}
                            className="p-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                            title="Edit Varian"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}                      
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-1">{formatRupiah(item.price)}</p>
                      <div className="w-full mt-2 flex items-center gap-1.5">
                        <Edit3 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => updateCartItemNote(item.cartItemId, e.target.value)}
                          placeholder="Catatan pesanan (opsional)..."
                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 outline-none pb-0.5 text-slate-600 dark:text-slate-300 transition-colors"
                        />
                      </div>
                    </div>
                    {/* --- REVISI INPUT KUANTITAS CUSTOM --- */}
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 rounded-lg p-1 border border-slate-100 dark:border-slate-800">
                      <button onClick={() => updateCartQty(item.cartItemId, -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-900 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors shrink-0"><Minus className="w-3 h-3" /></button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.qty}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, ''); // Cuma menerima angka
                          if (val === '') {
                            // Menahan nilai ke 1 jika input dihapus kosong, agar item tidak sengaja terhapus.
                            updateCartQty(item.cartItemId, 1 - item.qty);
                          } else {
                            const newQty = parseInt(val, 10);
                            // Logika ini mengirimkan selisih angkanya yang membuat fungsinya langsung presisi
                            updateCartQty(item.cartItemId, newQty - item.qty);
                          }
                        }}
                        className="w-8 text-center font-bold text-sm bg-transparent outline-none focus:ring-2 focus:ring-orange-500/20 rounded transition-colors"
                      />

                      <button onClick={() => updateCartQty(item.cartItemId, 1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-900 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-green-500 dark:hover:text-green-400 transition-colors shrink-0"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* --- DISCOUNTS & REWARDS --- */}
              {orderType !== 'Ojol' && (
                <div className="flex flex-col space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Kode Voucher</span>
                      <div className="flex items-center gap-1.5">
                        <input type="text" placeholder="VOUCHER" value={voucherInputCode} onChange={(e) => setVoucherInputCode(e.target.value.toUpperCase())} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none uppercase" />
                        <button onClick={() => {
                          if (!voucherInputCode) return;
                          const validVoucher = activeOnly(vouchers).find(v => v.code === voucherInputCode);
                          if (validVoucher) {
                            if (getSubtotal() >= validVoucher.minPurchase) { setAppliedVoucher(validVoucher); triggerAlert(`Voucher ${validVoucher.code} berhasil dipasang!`); }
                            else { triggerAlert(`Minimal belanja untuk voucher ini: ${formatRupiah(validVoucher.minPurchase)}`); }
                          } else { triggerAlert('Voucher tidak ditemukan.'); }
                        }}
                          className="px-2.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0"
                        >Pasang</button>
                      </div>
                      {appliedVoucher && <span className="text-[10px] text-green-500 dark:text-green-400 font-bold flex items-center gap-0.5 animate-in fade-in">Aktif: -{appliedVoucher.discountType === 'percent' ? `${appliedVoucher.discountValue}%` : formatRupiah(appliedVoucher.discountValue)}</span>}
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><Award className="w-3.5 h-3.5 text-yellow-400 dark:text-yellow-400" /> Klaim Poin</span>
                      {activeCustomer ? (
                        <div className="space-y-1.5 animate-in fade-in">
                          <div className="flex items-center gap-1.5">
                            <input type="number" min="0" max={activeCustomer.points} placeholder={`Max ${activeCustomer.points}`} value={pointsToRedeem || ''} onChange={(e) => { setPointsToRedeem(Math.min(activeCustomer.points, Math.max(0, Number(e.target.value) || 0))); }} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none" />
                            <button onClick={() => { setPointsToRedeem(activeCustomer.points); }} className="px-2.5 py-2 bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-500 dark:hover:bg-yellow-500 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0">Semua</button>
                          </div>
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">Diskon: {formatRupiah(getPointDiscount())} (1 Poin = Rp100)</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-center h-full">Masukkan member terdaftar untuk poin.</div>
                      )}
                    </div>
                  </div>

                  {/* --- DISKON MANUAL --- */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Diskon Tambahan Manual</span>
                    <div className="flex items-center gap-1.5">
                      <select className="w-20 text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors" value={manualDiscount.type} onChange={e => setManualDiscount({ ...manualDiscount, type: e.target.value })}>
                        <option value="fixed">Rp</option>
                        <option value="percent">%</option>
                      </select>
                      <input type="number" min="0" placeholder="Nominal Diskon Tambahan..." value={manualDiscount.value || ''} onChange={(e) => setManualDiscount({ ...manualDiscount, value: Number(e.target.value) || 0 })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors" />
                    </div>
                    {getManualDiscountAmount() > 0 && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block animate-in fade-in">Potongan: -{formatRupiah(getManualDiscountAmount())}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- CHECKOUT SUMMARY --- */}
        {cart.length > 0 && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] animate-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="font-semibold">{formatRupiah(getSubtotal())}</span></div>

              {appliedVoucher && <div className="flex justify-between text-green-500 dark:text-green-400"><span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Diskon ({appliedVoucher.code})</span><span className="font-semibold">-{formatRupiah(getDiscount())}</span></div>}
              {pointsToRedeem > 0 && <div className="flex justify-between text-yellow-500 dark:text-yellow-400"><span className="flex items-center gap-1"><Award className="w-3 h-3" /> Diskon Poin ({pointsToRedeem} Pts)</span><span className="font-semibold">-{formatRupiah(getPointDiscount())}</span></div>}
              {getManualDiscountAmount() > 0 && <div className="flex justify-between text-blue-500 dark:text-blue-400"><span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Diskon Tambahan</span><span className="font-semibold">-{formatRupiah(getManualDiscountAmount())}</span></div>}

              {storeSettings.taxRate > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Pajak ({storeSettings.taxRate}%)</span><span className="font-semibold">{formatRupiah(getTaxAmount())}</span></div>
              )}
              {storeSettings.serviceCharge > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Service Chg ({storeSettings.serviceCharge}%)</span><span className="font-semibold">{formatRupiah(getServiceChargeAmount())}</span></div>
              )}

              {orderType === 'Delivery' && <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>Ongkir</span><span className="font-semibold">{formatRupiah(deliveryFee)}</span></div>}
              <div className="flex justify-between text-lg font-black text-slate-800 dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2"><span>Total Tagihan</span><span className="text-orange-600 dark:text-orange-400">{formatRupiah(getTotal())}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleOpenBill} className="flex-1 py-3.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-200 dark:border-orange-500/30 shadow-sm hover:bg-orange-100 dark:hover:bg-orange-500/15 transition-all flex items-center justify-center gap-2 text-sm"><Save className="w-4 h-4" /> Simpan Bill</button>
              <button
                onClick={() => setPaymentModal({
                  isOpen: true,
                  isSplitMode: false,
                  splitPayments: [],
                  method: orderType === 'Ojol' ? 'Ojol' : 'Tunai',
                  amountPaid: '',
                  status: 'pending'
                })}
                className="flex-[1.5] py-3.5 rounded-xl bg-orange-600 dark:bg-orange-500 text-white font-bold shadow-lg hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                Bayar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
