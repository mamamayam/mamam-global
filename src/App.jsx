import React, { useState, useMemo, useEffect, createContext, useContext, useRef } from 'react';
import { loadData, saveData } from './storage/localStorage';
import { INITIAL_MENUS, INITIAL_VARIANT_GROUPS, INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from './data/initialData';
import { AppContext, useAppContext } from './context/AppContext';
import { formatRupiah } from './utils/formatters';
import CustomerView from './features/CustomerView';
import AccountView from './features/AccountView';
import ExpenseView from './features/ExpenseView';
import EmployeesView from './features/EmployeesView';
import HppView from './features/HppView';
import IncomeView from './features/IncomeView';
import PinModal from './features/PinModal';
import PosView from './features/PosView';
import ReportsView from './features/ReportsView';
import SettingsView from './features/SettingsView';
import ShiftView from './features/ShiftView';
import {
  AlertCircle,
  ArrowDownCircle,
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Clock,
  Coffee,
  Copy,
  CreditCard,
  DollarSign,
  Edit3,
  FileText,
  History,
  Info,
  List,
  Menu as MenuIcon,
  Minus,
  MoreHorizontal,
  Package,
  Pencil,
  PieChart,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingCart,
  SplitSquareHorizontal,
  Store,
  Ticket,
  Trash2,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X
} from 'lucide-react';

const CartDrawer = () => {
  const { isCartOpen, setIsCartOpen, cart, setCart, savedBills, triggerConfirm, formatRupiah, activeCustomer, customerName, setCustomerName, isCustomerDropdownMode, setIsCustomerDropdownMode, customers, orderType, setOrderType, deliveryFee, setDeliveryFee, customDeliveryFee, setCustomDeliveryFee, updateCartQty, updateCartItemNote, voucherInputCode, setVoucherInputCode, vouchers, appliedVoucher, setAppliedVoucher, getSubtotal, triggerAlert, pointsToRedeem, setPointsToRedeem, getPointDiscount, manualDiscount, setManualDiscount, getManualDiscountAmount, storeSettings, getDiscount, getTaxAmount, getServiceChargeAmount, getTotal, handleOpenBill, setPaymentModal, loadSavedBill } = useAppContext();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsCartOpen(false)} />
      <div className="w-full md:w-[420px] bg-white h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300 ease-out">

        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-800" /> Keranjang Pesanan
          </h2>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={() => triggerConfirm('Hapus semua isi keranjang?', () => setCart([]))} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Kosongkan Keranjang">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20 text-slate-400" />
              <p className="text-slate-400 mb-6">Keranjang masih kosong</p>
              {savedBills.length > 0 && (
                <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                  <h3 className="font-heading font-bold text-slate-800 flex items-center gap-2 mb-3 text-sm">
                    <Save className="w-4 h-4 text-orange-600" /> Bill Tersimpan ({savedBills.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedBills.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center p-3 border border-orange-100 rounded-xl bg-orange-50/30">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{bill.customerName}</p>
                          <p className="text-[10px] text-slate-500">{bill.cart.length} Item • {bill.date.toLocaleTimeString('id-ID')}</p>
                        </div>
                        <button onClick={() => loadSavedBill(bill)} className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors">
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
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Pelanggan</label>
                  <div className="flex items-center gap-2">
                    {activeCustomer ? (
                      <span className="text-[10px] font-bold bg-green-50 text-green-500 px-2 py-0.5 rounded-md border border-green-200 flex items-center gap-1 animate-in fade-in duration-300">
                        <Award className="w-3 h-3" /> <span className="hidden md:inline">Terdaftar</span> ({activeCustomer.points} Pts)
                      </span>
                    ) : customerName.trim() !== '' && !isCustomerDropdownMode ? (
                      <span className="text-[10px] font-semibold text-slate-400 italic hidden md:block">Guest</span>
                    ) : null}

                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Daftar</span>
                      <button
                        onClick={() => {
                          setIsCustomerDropdownMode(!isCustomerDropdownMode);
                          if (!activeCustomer) setCustomerName('');
                        }}
                        className={`w-7 h-4 rounded-full relative transition-colors duration-300 ${isCustomerDropdownMode ? 'bg-orange-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-300 ${isCustomerDropdownMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {isCustomerDropdownMode ? (
                  <select
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border-b-2 border-slate-100 focus:border-orange-600 pb-2 focus:outline-none bg-transparent transition-colors font-semibold text-slate-800 text-sm cursor-pointer"
                  >
                    <option value="">-- Pilih Pelanggan (Guest) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.name}>{c.name} - {c.phone || 'Tanpa HP'} ({c.points} Pts)</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ketik nama / no. HP pelanggan..." className="w-full border-b-2 border-slate-100 focus:border-orange-600 pb-2 focus:outline-none bg-transparent transition-colors font-semibold text-slate-800 text-sm" />
                )}

                {/* Fix Suggestion logic: Includes Phone numbers as well */}
                {!isCustomerDropdownMode && customerName.trim() !== '' && !activeCustomer && customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || (c.phone && c.phone.includes(customerName))).length > 0 && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-300 bg-orange-50/50 border border-orange-100 p-2 rounded-xl">
                    <p className="text-[10px] font-bold text-orange-600 mb-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> Maksud Anda pelanggan ini?</p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                      {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || (c.phone && c.phone.includes(customerName))).map(sc => (
                        <div key={sc.id} onClick={() => setCustomerName(sc.name)} className="flex justify-between items-center bg-white border border-orange-100 p-2 rounded-lg cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-700">{sc.name}</span>
                            <span className="text-[9px] font-medium text-slate-500">{sc.phone || 'Tidak ada No. HP'}</span>
                          </div>
                          <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-md border border-orange-200">Pilih</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* --- ORDER TYPE --- */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tipe Pesanan</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Dine-in', 'Takeaway', 'Delivery', 'Lainnya'].map(type => (
                    <button key={type} onClick={() => { setOrderType(type); if (type !== 'Delivery') setDeliveryFee(0); }} className={`py-2 px-3 text-sm rounded-xl font-bold transition-all duration-200 ${orderType === type ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm' : 'bg-slate-50 text-slate-500 border border-transparent hover:bg-slate-100'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === 'Delivery' && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 animate-in slide-in-from-top-3 duration-300">
                  <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-3 flex items-center gap-1"><Truck className="w-3 h-3" /> Biaya Pengiriman</label>
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
                    {[0, 3000, 5000].map(fee => (
                      <button key={fee} onClick={() => { setDeliveryFee(fee); setCustomDeliveryFee(''); }} className={`snap-center shrink-0 py-2 px-4 rounded-xl border font-bold text-sm transition-all whitespace-nowrap ${deliveryFee === fee && !customDeliveryFee ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        {fee === 0 ? 'Gratis' : formatRupiah(fee)}
                      </button>
                    ))}
                    <div className="snap-center shrink-0 flex items-center gap-2 border rounded-xl px-2 bg-white border-slate-200 min-w-[140px]">
                      <span className="text-slate-400 text-xs font-bold pl-2">Rp</span>
                      <input type="number" placeholder="Custom" className="w-full py-2 bg-transparent outline-none text-sm font-bold text-slate-700" value={customDeliveryFee} onChange={(e) => { setCustomDeliveryFee(e.target.value); setDeliveryFee(Number(e.target.value) || 0); }} />
                    </div>
                  </div>
                </div>
              )}

              {/* --- CART ITEMS --- */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Daftar Pesanan</label>
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0 animate-in fade-in duration-300">
                    <div className="flex-1 pr-2">
                      <h4 className="font-heading font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                      {item.variantName && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.variantName}</p>}
                      <p className="text-sm font-bold text-orange-600 mt-1">{formatRupiah(item.price)}</p>
                      <div className="w-full mt-2 flex items-center gap-1.5">
                        <Edit3 className="w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => updateCartItemNote(item.cartItemId, e.target.value)}
                          placeholder="Catatan pesanan (opsional)..."
                          className="flex-1 text-[11px] bg-transparent border-b border-slate-200 focus:border-orange-500 outline-none pb-0.5 text-slate-600 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-100">
                      <button onClick={() => updateCartQty(item.cartItemId, -1)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-orange-600 transition-colors"><Minus className="w-3 h-3" /></button>
                      <span className="font-bold w-4 text-center text-sm">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.cartItemId, 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-green-500 transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* --- DISCOUNTS & REWARDS --- */}
              <div className="flex flex-col space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Kode Voucher</span>
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="VOUCHER" value={voucherInputCode} onChange={(e) => setVoucherInputCode(e.target.value.toUpperCase())} className="w-full text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-200 outline-none uppercase" />
                      <button onClick={() => {
                        if (!voucherInputCode) return;
                        const validVoucher = vouchers.find(v => v.code === voucherInputCode);
                        if (validVoucher) {
                          if (getSubtotal() >= validVoucher.minPurchase) { setAppliedVoucher(validVoucher); triggerAlert(`Voucher ${validVoucher.code} berhasil dipasang!`); }
                          else { triggerAlert(`Minimal belanja untuk voucher ini: ${formatRupiah(validVoucher.minPurchase)}`); }
                        } else { triggerAlert('Voucher tidak ditemukan.'); }
                      }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0"
                      >Pasang</button>
                    </div>
                    {appliedVoucher && <span className="text-[10px] text-green-500 font-bold flex items-center gap-0.5 animate-in fade-in">Aktif: -{appliedVoucher.discountType === 'percent' ? `${appliedVoucher.discountValue}%` : formatRupiah(appliedVoucher.discountValue)}</span>}
                  </div>

                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Award className="w-3.5 h-3.5 text-yellow-400" /> Klaim Poin</span>
                    {activeCustomer ? (
                      <div className="space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" max={activeCustomer.points} placeholder={`Max ${activeCustomer.points}`} value={pointsToRedeem || ''} onChange={(e) => { setPointsToRedeem(Math.min(activeCustomer.points, Math.max(0, Number(e.target.value) || 0))); }} className="w-full text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-200 outline-none" />
                          <button onClick={() => { setPointsToRedeem(activeCustomer.points); }} className="px-2.5 py-2 bg-yellow-400 hover:bg-yellow-500 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0">Semua</button>
                        </div>
                        <span className="text-[10px] text-orange-600 font-bold block">Diskon: {formatRupiah(getPointDiscount())} (1 Poin = Rp100)</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center h-full">Masukkan member terdaftar untuk poin.</div>
                    )}
                  </div>
                </div>

                {/* --- DISKON MANUAL --- */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-blue-500" /> Diskon Tambahan Manual</span>
                  <div className="flex items-center gap-1.5">
                    <select className="w-20 text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 transition-colors" value={manualDiscount.type} onChange={e => setManualDiscount({ ...manualDiscount, type: e.target.value })}>
                      <option value="fixed">Rp</option>
                      <option value="percent">%</option>
                    </select>
                    <input type="number" min="0" placeholder="Nominal Diskon Tambahan..." value={manualDiscount.value || ''} onChange={(e) => setManualDiscount({ ...manualDiscount, value: Number(e.target.value) || 0 })} className="w-full text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  {getManualDiscountAmount() > 0 && <span className="text-[10px] text-blue-600 font-bold block animate-in fade-in">Potongan: -{formatRupiah(getManualDiscountAmount())}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- CHECKOUT SUMMARY --- */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] animate-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-semibold">{formatRupiah(getSubtotal())}</span></div>

              {appliedVoucher && <div className="flex justify-between text-green-500"><span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Diskon ({appliedVoucher.code})</span><span className="font-semibold">-{formatRupiah(getDiscount())}</span></div>}
              {pointsToRedeem > 0 && <div className="flex justify-between text-yellow-500"><span className="flex items-center gap-1"><Award className="w-3 h-3" /> Diskon Poin ({pointsToRedeem} Pts)</span><span className="font-semibold">-{formatRupiah(getPointDiscount())}</span></div>}
              {getManualDiscountAmount() > 0 && <div className="flex justify-between text-blue-500"><span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Diskon Tambahan</span><span className="font-semibold">-{formatRupiah(getManualDiscountAmount())}</span></div>}

              {storeSettings.taxRate > 0 && (
                <div className="flex justify-between text-slate-500"><span>Pajak ({storeSettings.taxRate}%)</span><span className="font-semibold">{formatRupiah(getTaxAmount())}</span></div>
              )}
              {storeSettings.serviceCharge > 0 && (
                <div className="flex justify-between text-slate-500"><span>Service Chg ({storeSettings.serviceCharge}%)</span><span className="font-semibold">{formatRupiah(getServiceChargeAmount())}</span></div>
              )}

              {orderType === 'Delivery' && <div className="flex justify-between text-orange-600"><span>Ongkir</span><span className="font-semibold">{formatRupiah(deliveryFee)}</span></div>}
              <div className="flex justify-between text-lg font-black text-slate-800 border-t border-slate-100 pt-2 mt-2"><span>Total Tagihan</span><span className="text-orange-600">{formatRupiah(getTotal())}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleOpenBill} className="flex-1 py-3.5 rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-sm hover:bg-orange-100 transition-all flex items-center justify-center gap-2 text-sm"><Save className="w-4 h-4" /> Simpan Bill</button>
              <button onClick={() => setPaymentModal({ isOpen: true, isSplitMode: false, splitPayments: [], method: 'Tunai', amountPaid: '', status: 'pending' })} className="flex-[1.5] py-3.5 rounded-xl bg-orange-600 text-white font-bold shadow-lg hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">Bayar <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PayslipModal = () => {
  const { payslipModal, setPayslipModal, formatRupiah } = useAppContext();
  if (!payslipModal.isOpen || !payslipModal.data) return null;
  const { data, month } = payslipModal;

  const aggAdditions = {};
  const aggDeductions = {};

  data.records.forEach(rec => {
    rec.additions.forEach(a => { aggAdditions[a.category] = (aggAdditions[a.category] || 0) + a.amount; });
    rec.deductions.forEach(d => { aggDeductions[d.category] = (aggDeductions[d.category] || 0) + d.amount; });
  });

  const basicPay = data.totalHours * data.employee.hourlyRate;
  const printPayslip = () => window.print();

  const monthLabel = new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          #payslip-content, #payslip-content * { visibility: visible; }
          #payslip-content { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 0; box-shadow: none; font-family: monospace; }
          @page { margin: 0; }
        }
      `}} />

      <div className="bg-white rounded-md w-full max-w-[350px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out print:shadow-none print:w-[80mm]" id="payslip-content">
        <div className="p-6 print:p-4">
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800 mb-1 print:text-lg">SLIP GAJI</h2>
            <p className="text-[10px] text-slate-500 font-bold print:text-black">MAMAM OUTLET</p>
            <p className="text-[10px] text-slate-500 mt-2 print:mt-1 print:text-black">Periode: {monthLabel}</p>
          </div>

          <div className="mb-4 text-xs space-y-1.5 print:mb-3 print:text-black">
            <div className="flex justify-between"><span>Nama:</span> <span className="font-bold">{data.employee.name}</span></div>
            <div className="flex justify-between"><span>Posisi/Rate:</span> <span className="font-bold">{formatRupiah(data.employee.hourlyRate)}/Jam</span></div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 pt-3 pb-3 print:text-black text-xs">
            <h3 className="font-bold mb-2 uppercase text-[10px]">PENGHASILAN</h3>
            <div className="flex justify-between mb-1">
              <span>Gaji Pokok ({data.totalHours} Jam)</span>
              <span>{formatRupiah(basicPay)}</span>
            </div>
            {Object.entries(aggAdditions).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between mb-1">
                <span>+ {cat}</span> <span>{formatRupiah(amt)}</span>
              </div>
            ))}
          </div>

          {Object.keys(aggDeductions).length > 0 && (
            <div className="border-t-2 border-dashed border-slate-300 pt-3 pb-3 print:text-black text-xs">
              <h3 className="font-bold mb-2 uppercase text-[10px]">POTONGAN</h3>
              {Object.entries(aggDeductions).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between mb-1 text-red-500 print:text-black">
                  <span>- {cat}</span> <span>{formatRupiah(amt)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t-2 border-solid border-slate-800 pt-3 mt-1 print:border-black text-sm">
            <div className="flex justify-between font-black uppercase">
              <span>TOTAL DITERIMA</span> <span>{formatRupiah(data.netPay)}</span>
            </div>
          </div>

          <div className="text-center mt-10 text-[10px] text-slate-500 print:mt-8 print:text-black">
            <p>Penerima,</p>
            <br /><br /><br />
            <p className="font-bold underline">({data.employee.name})</p>
          </div>
        </div>

        <div className="absolute -bottom-16 left-0 right-0 flex gap-2 print:hidden">
          <button onClick={printPayslip} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" /> Cetak/Kirim
          </button>
          <button onClick={() => setPayslipModal({ isOpen: false, data: null })} className="flex-1 py-3 rounded-xl bg-white text-slate-800 font-bold shadow-lg hover:bg-slate-100 text-sm transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

const VariantSelectionModal = () => {
  const { selectedMenuForVariant, setSelectedMenuForVariant, variantGroups, formatRupiah, addToCart, variantSelectedOptions, setVariantSelectedOptions } = useAppContext();

  if (!selectedMenuForVariant) return null;
  const menuVariants = variantGroups.filter(vg => selectedMenuForVariant.variantGroupIds.includes(vg.id));

  const handleToggleOption = (groupId, optionId, maxSelection) => {
    setVariantSelectedOptions(prev => {
      const currentGroupSelections = prev[groupId] || [];
      if (currentGroupSelections.includes(optionId)) return { ...prev, [groupId]: currentGroupSelections.filter(id => id !== optionId) };
      else {
        if (maxSelection === 1) return { ...prev, [groupId]: [optionId] };
        else if (currentGroupSelections.length < maxSelection) return { ...prev, [groupId]: [...currentGroupSelections, optionId] };
        else return prev;
      }
    });
  };

  const isSelectionValid = menuVariants.every(vg => {
    if (vg.isRequired) return (variantSelectedOptions[vg.id] || []).length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white w-full md:w-[450px] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300 ease-out max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h3 className="font-heading font-bold text-slate-800 text-lg leading-tight">{selectedMenuForVariant.name}</h3>
            <p className="text-sm font-bold text-orange-600">{formatRupiah(selectedMenuForVariant.price)}</p>
          </div>
          <button onClick={() => setSelectedMenuForVariant(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {menuVariants.length === 0 && <p className="text-sm text-slate-500 italic text-center py-4">Tidak ada variasi untuk menu ini.</p>}

          {menuVariants.map(vg => {
            const currentSelections = variantSelectedOptions[vg.id] || [];
            const isMaxReached = currentSelections.length >= vg.maxSelection;

            return (
              <div key={vg.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-heading font-bold text-slate-800 text-sm">{vg.name}</h4>
                    <p className="text-[11px] text-slate-500">Pilih maksimal {vg.maxSelection}</p>
                  </div>
                  {vg.isRequired ? <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-md uppercase tracking-wider">Wajib</span> : <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-md uppercase tracking-wider">Opsional</span>}
                </div>
                <div className="p-2">
                  {vg.options.map(opt => {
                    const isSelected = currentSelections.includes(opt.id);
                    const isDisabled = !isSelected && isMaxReached;
                    return (
                      <label key={opt.id} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-orange-50 border border-orange-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-orange-600 border-orange-600' : 'bg-white border-slate-300'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white animate-in zoom-in" />}
                          </div>
                          <span className={`font-semibold text-sm ${isSelected ? 'text-orange-600' : 'text-slate-700'}`}>{opt.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500">{opt.extraPrice > 0 ? `+${formatRupiah(opt.extraPrice)}` : 'Gratis'}</span>
                        <input type="checkbox" className="hidden" checked={isSelected} disabled={isDisabled} onChange={() => handleToggleOption(vg.id, opt.id, vg.maxSelection)} />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-slate-100 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button onClick={() => isSelectionValid && addToCart(selectedMenuForVariant, variantSelectedOptions)} disabled={!isSelectionValid} className="w-full py-3.5 rounded-xl bg-orange-600 text-white font-bold disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-orange-700 hover:shadow-lg transition-all duration-300">
            {isSelectionValid ? 'Tambah ke Keranjang' : 'Lengkapi Pilihan Wajib'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentModal = () => {
  const { paymentModal, setPaymentModal, getTotal, formatRupiah, activeCustomer, pointsToRedeem, customers, setCustomers, claimsHistory, setClaimsHistory, getPointDiscount, manualDiscount, setManualDiscount, getManualDiscountAmount, customerName, orderType, cart, getSubtotal, getDiscount, getTaxAmount, getServiceChargeAmount, deliveryFee, salesHistory, setSalesHistory, setIsCartOpen, setCart, setCustomerName, setAppliedVoucher, setVoucherInputCode, setPointsToRedeem, setReceiptModal, storeSettings, triggerAlert } = useAppContext();

  if (!paymentModal.isOpen) return null;

  const total = getTotal();
  const { isSplitMode, splitPayments, method, amountPaid, status } = paymentModal;

  // Hitungan untuk Single Payment
  const kembalian = method === 'Tunai' && !isSplitMode ? (Number(amountPaid) - total) : 0;
  const isReadyToPay = method === 'Tunai' && !isSplitMode ? (Number(amountPaid) >= total) : true;

  // Hitungan untuk Split Payment
  const totalSplitPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const splitRemaining = total - totalSplitPaid;
  const splitKembalian = totalSplitPaid > total ? totalSplitPaid - total : 0;
  const isSplitReadyToPay = splitRemaining <= 0;

  const handleProcessPayment = () => {
    if (!isSplitMode) {
      if (!isReadyToPay && method === 'Tunai') return;
      if (method !== 'Tunai' && status === 'pending') { setPaymentModal({ ...paymentModal, status: 'completed' }); return; }
    } else {
      if (!isSplitReadyToPay) return triggerAlert('Pembayaran belum lunas!');
    }

    if (activeCustomer && pointsToRedeem > 0) {
      setCustomers(customers.map(c => c.id === activeCustomer.id ? { ...c, points: c.points - pointsToRedeem } : c));
      setClaimsHistory([{ id: `cl-${Date.now()}`, customerName: activeCustomer.name, rewardName: `Potongan Belanja ${formatRupiah(getPointDiscount())}`, pointsUsed: pointsToRedeem, date: new Date() }, ...claimsHistory]);
    }

    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`, date: new Date(), customerName: customerName || 'Tanpa Nama', orderType, items: [...cart],
      subtotal: getSubtotal(), discount: getDiscount(), pointDiscount: getPointDiscount(),
      manualDiscountAmount: getManualDiscountAmount(),
      taxAmount: getTaxAmount(), serviceAmount: getServiceChargeAmount(),
      deliveryFee, total,
      paymentMethod: isSplitMode ? 'Split Payment' : method,
      splitDetails: isSplitMode ? splitPayments : [],
      hppTotal: cart.reduce((sum, item) => sum + (item.hpp * item.qty), 0)
    };

    const pointsEarned = Math.floor(total / 10000);
    if (pointsEarned > 0) {
      const latestCustomersList = activeCustomer && pointsToRedeem > 0 ? customers.map(c => c.id === activeCustomer.id ? { ...c, points: c.points - pointsToRedeem } : c) : customers;
      const registeredCustomer = latestCustomersList.find(c => c.name.toLowerCase() === newOrder.customerName.toLowerCase());
      if (registeredCustomer) setCustomers(latestCustomersList.map(c => c.id === registeredCustomer.id ? { ...c, points: c.points + pointsEarned } : c));
    }

    setSalesHistory([newOrder, ...salesHistory]);
    setPaymentModal({ isOpen: false, isSplitMode: false, splitPayments: [], method: 'Tunai', amountPaid: '', status: 'pending' });
    setIsCartOpen(false); setCart([]); setCustomerName(''); setAppliedVoucher(null); setVoucherInputCode(''); setPointsToRedeem(0); setManualDiscount({ type: 'fixed', value: 0 });

    setReceiptModal({ isOpen: true, data: newOrder, kembalian: isSplitMode ? splitKembalian : (method === 'Tunai' ? kembalian : 0) });

    if (storeSettings.autoPrint) { setTimeout(() => window.print(), 500); }
  };

  const quickCashOptions = [total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  // Split Payment Handlers
  const handleAddSplitPayment = () => {
    if (!amountPaid || Number(amountPaid) <= 0) return triggerAlert('Masukkan nominal pembayaran.');
    setPaymentModal({
      ...paymentModal,
      splitPayments: [...splitPayments, { method, amount: Number(amountPaid) }],
      amountPaid: '',
      method: 'Tunai' // reset default after add
    });
  };

  const removeSplitPayment = (index) => {
    const newSplits = [...splitPayments];
    newSplits.splice(index, 1);
    setPaymentModal({ ...paymentModal, splitPayments: newSplits });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity duration-300">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 ease-out">
        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-800">Pembayaran</h2>
            {isSplitMode && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Mode Multi Payment</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isSplitMode ? (
              <button onClick={() => setPaymentModal({ ...paymentModal, isSplitMode: true })} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-xs font-bold flex items-center gap-1"><SplitSquareHorizontal className="w-4 h-4" /> Split</button>
            ) : (
              <button onClick={() => setPaymentModal({ ...paymentModal, isSplitMode: false, splitPayments: [], amountPaid: '' })} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors text-xs font-bold">Batal Split</button>
            )}
            <button onClick={() => setPaymentModal({ ...paymentModal, isOpen: false })} className="p-2 bg-white rounded-full shadow-sm text-slate-500 hover:bg-slate-100 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
          {!isSplitMode ? (
            <>
              {/* --- SINGLE PAYMENT MODE --- */}
              <div className="text-center mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Tagihan</p>
                <h1 className="font-heading text-4xl font-black text-slate-900">{formatRupiah(total)}</h1>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[{ id: 'Tunai', icon: Wallet }, { id: 'QRIS', icon: QrCode }, { id: 'Transfer', icon: CreditCard }].map(opt => (
                  <button key={opt.id} onClick={() => setPaymentModal({ ...paymentModal, method: opt.id, status: 'pending' })} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${method === opt.id ? 'border-orange-600 bg-orange-600 text-white shadow-md -translate-y-1' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-200'}`}>
                    <opt.icon className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold">{opt.id}</span>
                  </button>
                ))}
              </div>

              {method === 'Tunai' && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Uang Diterima</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                      <input type="number" className="w-full pl-12 pr-4 py-3 text-lg font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 bg-white transition-colors" value={amountPaid} onChange={(e) => setPaymentModal({ ...paymentModal, amountPaid: e.target.value })} placeholder="0" />
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    {quickCashOptions.map((amt, idx) => (
                      <button key={idx} onClick={() => setPaymentModal({ ...paymentModal, amountPaid: amt.toString() })} className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 transition-all">
                        {amt === total ? 'Uang Pas' : formatRupiah(amt)}
                      </button>
                    ))}
                  </div>

                  <div className={`p-4 rounded-xl border transition-colors duration-300 ${kembalian >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-xs font-bold text-slate-500 mb-1">Kembalian</p>
                    <p className={`text-2xl font-black ${kembalian >= 0 ? 'text-green-500' : 'text-red-500'}`}>{kembalian >= 0 ? formatRupiah(kembalian) : 'Uang Kurang'}</p>
                  </div>
                </div>
              )}

              {method !== 'Tunai' && (
                <div className="text-center bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                  {status === 'pending' ? (
                    <>
                      <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3 animate-pulse" />
                      <h3 className="font-heading font-bold text-slate-800 mb-2">Menunggu Pembayaran {method}</h3>
                      <p className="text-sm text-slate-500 mb-5">Pastikan pelanggan sudah transfer/scan sebelum menyelesaikan pesanan.</p>
                      <button onClick={handleProcessPayment} className="w-full py-3.5 bg-white border-2 border-orange-600 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-sm">Konfirmasi Pembayaran Diterima</button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <h3 className="font-heading font-bold text-slate-800 mb-2">Pembayaran Terverifikasi</h3>
                      <p className="text-sm text-slate-500">Anda dapat mencetak struk sekarang.</p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* --- SPLIT PAYMENT MODE --- */}
              <div className="bg-slate-800 p-4 rounded-2xl shadow-sm text-white mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Tagihan</span>
                  <span className="font-bold text-lg">{formatRupiah(total)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-600 pt-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{splitRemaining > 0 ? 'Sisa Pembayaran' : 'Kembalian'}</span>
                  <span className={`font-black text-2xl ${splitRemaining > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {splitRemaining > 0 ? formatRupiah(splitRemaining) : formatRupiah(Math.abs(splitRemaining))}
                  </span>
                </div>
              </div>

              {splitPayments.length > 0 && (
                <div className="mb-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pembayaran Masuk</h4>
                  {splitPayments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl animate-in slide-in-from-left-2 duration-300">
                      <div className="flex items-center gap-2">
                        <span className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded">{p.method}</span>
                        <span className="font-bold text-sm text-slate-800">{formatRupiah(p.amount)}</span>
                      </div>
                      <button onClick={() => removeSplitPayment(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {splitRemaining > 0 && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tambah Pembayaran</h4>
                  <div className="flex gap-2">
                    {['Tunai', 'QRIS', 'Transfer'].map(m => (
                      <button key={m} onClick={() => setPaymentModal({ ...paymentModal, method: m })} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${method === m ? 'bg-orange-50 border-orange-600 text-orange-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{m}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                      <input type="number" className="w-full pl-9 pr-3 py-2.5 text-sm font-bold rounded-xl border border-slate-200 focus:outline-none focus:border-slate-800 bg-white transition-colors" value={amountPaid} onChange={(e) => setPaymentModal({ ...paymentModal, amountPaid: e.target.value })} placeholder={splitRemaining.toString()} />
                    </div>
                    <button onClick={handleAddSplitPayment} className="px-4 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors">Tambah</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPaymentModal({ ...paymentModal, amountPaid: splitRemaining.toString() })} className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200">Uang Pas Sisa</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          {!isSplitMode ? (
            (method === 'Tunai' || status === 'completed' ? (
              <button onClick={handleProcessPayment} disabled={!isReadyToPay && method === 'Tunai'} className="w-full py-4 rounded-xl bg-orange-600 text-white font-bold text-lg shadow-lg hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none disabled:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2">
                {method === 'Tunai' ? 'Selesai & Lanjutkan' : 'Selesaikan Transaksi'}
                <Receipt className="w-5 h-5" />
              </button>
            ) : null)
          ) : (
            <button onClick={handleProcessPayment} disabled={!isSplitReadyToPay} className="w-full py-4 rounded-xl bg-orange-600 text-white font-bold text-lg shadow-lg hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 disabled:bg-slate-300 disabled:shadow-none disabled:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2">
              Selesaikan Transaksi <Receipt className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = () => {
  const { receiptModal, setReceiptModal, storeSettings, formatRupiah, printReceipt } = useAppContext();
  if (!receiptModal.isOpen || !receiptModal.data) return null;
  const { data, kembalian } = receiptModal;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 print:bg-white print:p-0">

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-content, #receipt-content * { visibility: visible; }
          #receipt-content { position: absolute; left: 0; top: 0; width: ${storeSettings.paperSize === '80mm' ? '80mm' : '58mm'}; margin: 0; padding: 0; box-shadow: none; }
          @page { margin: 0; }
        }
      `}} />

      <div className="bg-white rounded-md w-full max-w-[320px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out print:shadow-none print:w-[58mm]" id="receipt-content">
        <div className="p-6 print:p-2">
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
            {storeSettings.printLogo && <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800 mb-1 print:text-lg">MAMAM KASIR</h2>}
            <p className="text-[10px] text-slate-500 print:text-black">Jl. Teknologi No. 1</p>
            <p className="text-[10px] text-slate-500 mt-2 print:mt-1 print:text-black">{data.date.toLocaleString('id-ID')}</p>
            <p className="text-[10px] text-slate-500 print:text-black">ID: {data.id} | Kasir: Admin</p>
          </div>

          <div className="mb-4 text-[11px] space-y-1 print:mb-2 print:text-black">
            <div className="flex justify-between"><span>Pelanggan:</span> <span className="font-bold">{data.customerName}</span></div>
            <div className="flex justify-between"><span>Tipe Pesanan:</span> <span className="font-bold">{data.orderType}</span></div>
          </div>

          <div className="border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2 print:text-black">
            <table className="w-full text-[11px]">
              <tbody>
                {data.items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr><td colSpan="3" className="font-bold pt-2">{item.name}</td></tr>
                    {item.variantName && <tr><td colSpan="3" className="pl-2 pb-1 text-slate-500 print:text-black">- {item.variantName}</td></tr>}
                    {item.note && <tr><td colSpan="3" className="pl-2 pb-1 italic text-slate-500 print:text-black">* {item.note}</td></tr>}
                    <tr>
                      <td className="w-8">{item.qty}x</td>
                      <td className="text-right pr-2">{formatRupiah(item.price)}</td>
                      <td className="text-right font-bold">{formatRupiah(item.price * item.qty)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 text-[11px] print:text-black border-b-2 border-dashed border-slate-300 pb-4 mb-4 print:pb-2 print:mb-2">
            <div className="flex justify-between"><span>Subtotal</span> <span>{formatRupiah(data.subtotal)}</span></div>
            {data.discount > 0 && <div className="flex justify-between"><span>Diskon Voucher</span> <span>-{formatRupiah(data.discount)}</span></div>}
            {data.pointDiscount > 0 && <div className="flex justify-between"><span>Potongan Poin</span> <span>-{formatRupiah(data.pointDiscount)}</span></div>}
            {data.manualDiscountAmount > 0 && <div className="flex justify-between"><span>Diskon Manual</span> <span>-{formatRupiah(data.manualDiscountAmount)}</span></div>}

            {data.taxAmount > 0 && <div className="flex justify-between"><span>Pajak</span> <span>{formatRupiah(data.taxAmount)}</span></div>}
            {data.serviceAmount > 0 && <div className="flex justify-between"><span>Service Chg</span> <span>{formatRupiah(data.serviceAmount)}</span></div>}
            {data.deliveryFee > 0 && <div className="flex justify-between"><span>Ongkir</span> <span>{formatRupiah(data.deliveryFee)}</span></div>}

            <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-200 print:border-black">
              <span>TOTAL</span> <span>{formatRupiah(data.total)}</span>
            </div>
          </div>

          <div className="space-y-1 text-[11px] print:text-black">
            <div className="flex justify-between font-bold mb-1"><span>Pembayaran</span></div>
            {data.paymentMethod === 'Split Payment' ? (
              <>
                {data.splitDetails.map((p, i) => (
                  <div key={i} className="flex justify-between"><span>- {p.method}</span> <span>{formatRupiah(p.amount)}</span></div>
                ))}
              </>
            ) : (
              <div className="flex justify-between"><span>- {data.paymentMethod}</span> <span>{formatRupiah(data.total)}</span></div>
            )}

            {kembalian > 0 && (
              <div className="flex justify-between mt-2 font-bold"><span>Kembalian</span> <span>{formatRupiah(kembalian)}</span></div>
            )}
          </div>

          <div className="text-center mt-8 text-[10px] text-slate-500 print:mt-4 print:text-black">
            <p>Terima kasih atas kunjungan Anda!</p>
          </div>
        </div>

        <div className="absolute -bottom-16 left-0 right-0 flex gap-2 print:hidden">
          <button onClick={printReceipt} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" /> Cetak
          </button>
          <button onClick={() => setReceiptModal({ isOpen: false, data: null })} className="flex-1 py-3 rounded-xl bg-white text-slate-800 font-bold shadow-lg hover:bg-slate-100 text-sm transition-colors">
            Tutup Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

const VariantManagement = () => {
  const { variantGroups, setVariantGroups, menus, setMenus, triggerAlert, formatRupiah } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', isRequired: false, maxSelection: 1, options: [] });
  const [newOption, setNewOption] = useState({ name: '', extraPrice: '' });

  const handleSave = () => {
    if (formData.options.length === 0) { triggerAlert("Tambahkan minimal 1 opsi varian."); return; }
    if (formData.id) setVariantGroups(variantGroups.map(vg => vg.id === formData.id ? formData : vg));
    else setVariantGroups([...variantGroups, { ...formData, id: `vg${Date.now()}` }]);
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    setVariantGroups(variantGroups.filter(vg => vg.id !== id));
    setMenus(menus.map(m => ({ ...m, variantGroupIds: m.variantGroupIds.filter(vid => vid !== id) })));
  };

  const handleAddOption = () => {
    if (!newOption.name) return;
    setFormData({ ...formData, options: [...formData.options, { id: `opt${Date.now()}`, name: newOption.name, extraPrice: Number(newOption.extraPrice) || 0 }] });
    setNewOption({ name: '', extraPrice: '' });
  };

  const handleRemoveOption = (optId) => setFormData({ ...formData, options: formData.options.filter(o => o.id !== optId) });

  if (isEditing) {
    return (
      <div className="p-4 md:p-6 bg-white flex-1 animate-in fade-in slide-in-from-right-4 duration-300 h-full overflow-y-auto ease-out">
        <button onClick={() => setIsEditing(false)} className="mb-4 text-slate-500 flex items-center gap-2 hover:text-slate-800 font-medium transition-colors">
          <ChevronLeft className="w-5 h-5" /> Kembali
        </button>
        <h2 className="font-heading text-2xl font-bold mb-6 text-slate-800">{formData.id ? 'Edit Kategori Varian' : 'Tambah Kategori Varian'}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl pb-20">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 border-b pb-2">Pengaturan Kategori</h3>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Nama Kategori Varian</label>
              <input type="text" className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Topping, Level Pedas" />
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input type="checkbox" id="isRequired" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.isRequired} onChange={e => setFormData({ ...formData, isRequired: e.target.checked })} />
              <label htmlFor="isRequired" className="font-bold text-sm text-slate-700 cursor-pointer flex-1">Wajib Dipilih (Required)</label>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Maksimal Pilihan Diizinkan</label>
              <input type="number" min="1" className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none transition-colors" value={formData.maxSelection} onChange={e => setFormData({ ...formData, maxSelection: Math.max(1, Number(e.target.value)) })} />
              <p className="text-xs text-slate-400 mt-1">Isi 1 jika hanya boleh pilih salah satu (Radio Button).</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 border-b pb-2">Daftar Pilihan (Opsi)</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nama Opsi" className="p-2 border rounded-lg text-sm outline-none focus:border-orange-600 transition-colors" value={newOption.name} onChange={e => setNewOption({ ...newOption, name: e.target.value })} />
                <input type="number" placeholder="Harga (+)" className="p-2 border rounded-lg text-sm outline-none focus:border-orange-600 transition-colors" value={newOption.extraPrice} onChange={e => setNewOption({ ...newOption, extraPrice: e.target.value })} />
              </div>
              <button onClick={handleAddOption} className="w-full py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-300 transition-colors">Tambah Opsi</button>
            </div>

            <div className="space-y-2">
              {formData.options.length === 0 && <p className="text-sm text-slate-500 italic">Belum ada opsi ditambahkan.</p>}
              {formData.options.map(opt => (
                <div key={opt.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl animate-in fade-in slide-in-from-left-2 duration-300">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{opt.name}</p>
                    <p className="text-xs font-semibold text-slate-500">+{formatRupiah(opt.extraPrice)}</p>
                  </div>
                  <button onClick={() => handleRemoveOption(opt.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 right-0 left-0 md:left-64 p-4 bg-white border-t border-slate-100 z-10 flex justify-end">
          <button onClick={handleSave} className="w-full md:w-auto px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">Simpan Kategori Varian</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800">Library Varian</h2>
        <button onClick={() => { setFormData({ id: '', name: '', isRequired: false, maxSelection: 1, options: [] }); setIsEditing(true); }} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 hover:shadow-md transition-all duration-300">
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {variantGroups.map((vg) => (
          <div key={vg.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative hover:shadow-md transition-shadow duration-300 group">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-heading font-bold text-slate-800 text-lg leading-tight group-hover:text-orange-600 transition-colors">{vg.name}</h4>
                <div className="flex gap-2 mt-1">
                  {vg.isRequired ? <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded">WAJIB</span> : <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">OPSIONAL</span>}
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">MAX: {vg.maxSelection}</span>
                </div>
              </div>
              <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onClick={() => { setFormData(vg); setIsEditing(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(vg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-2">
              <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Daftar Opsi ({vg.options.length})</p>
              <div className="flex flex-wrap gap-2">
                {vg.options.map(opt => (
                  <div key={opt.id} className="text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex gap-2 items-center hover:border-slate-300 transition-colors">
                    <span className="font-semibold text-slate-700">{opt.name}</span><span className="text-slate-400">|</span><span className="font-bold text-slate-500">+{opt.extraPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {variantGroups.length === 0 && <div className="col-span-full p-8 text-center text-slate-400">Belum ada data varian</div>}
      </div>
    </div>
  );
};

const MenuManagement = () => {
  const { menus, setMenus, variantGroups, formatRupiah, triggerAlert } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', price: 0, hpp: 0, category: 'Makanan', variantGroupIds: [] });

  const handleSave = () => {
    if (!formData.name || formData.price <= 0) { triggerAlert("Nama dan harga menu harus diisi dengan benar."); return; }
    if (formData.id) setMenus(menus.map(m => m.id === formData.id ? formData : m));
    else setMenus([...menus, { ...formData, id: `m${Date.now()}` }]);
    setIsEditing(false);
  };

  const handleDelete = (id) => setMenus(menus.filter(m => m.id !== id));

  const toggleVariantGroup = (vgId) => {
    setFormData(prev => {
      const has = prev.variantGroupIds.includes(vgId);
      return { ...prev, variantGroupIds: has ? prev.variantGroupIds.filter(id => id !== vgId) : [...prev.variantGroupIds, vgId] };
    });
  };

  const groupedMenus = useMemo(() => {
    const groups = {};
    menus.forEach(menu => { if (!groups[menu.category]) groups[menu.category] = []; groups[menu.category].push(menu); });
    return groups;
  }, [menus]);

  if (isEditing) {
    return (
      <div className="p-4 md:p-6 bg-white flex-1 animate-in fade-in slide-in-from-right-4 duration-300 h-full overflow-y-auto ease-out">
        <button onClick={() => setIsEditing(false)} className="mb-4 text-slate-500 flex items-center gap-2 hover:text-slate-800 font-medium transition-colors">
          <ChevronLeft className="w-5 h-5" /> Kembali
        </button>
        <h2 className="font-heading text-2xl font-bold mb-6 text-slate-800">{formData.id ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl pb-20">
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 border-b pb-2">Informasi Dasar</h3>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Nama Menu</label>
              <input type="text" className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Misal: Ayam Geprek" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Kategori</label>
              <select className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none bg-white transition-colors" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="Makanan">Makanan</option><option value="Minuman">Minuman</option><option value="Cemilan">Cemilan</option><option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Harga Jual (Rp)</label>
                <input type="number" className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none transition-colors" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">HPP / Modal (Rp)</label>
                <input type="number" className="w-full p-3 border rounded-xl focus:border-orange-600 outline-none transition-colors" value={formData.hpp} onChange={e => setFormData({ ...formData, hpp: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-heading font-bold text-slate-800 border-b pb-2">Varian Terkait</h3>
            <p className="text-xs text-slate-500 mb-2">Pilih kategori varian yang berlaku untuk menu ini.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {variantGroups.length === 0 ? (
                <p className="text-sm italic text-slate-400">Belum ada grup varian. Tambahkan di menu Library Varian.</p>
              ) : (
                variantGroups.map(vg => (
                  <label key={vg.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${formData.variantGroupIds.includes(vg.id) ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-slate-50 hover:bg-slate-100'}`}>
                    <input type="checkbox" className="w-5 h-5 accent-orange-600 cursor-pointer" checked={formData.variantGroupIds.includes(vg.id)} onChange={() => toggleVariantGroup(vg.id)} />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800">{vg.name}</p>
                      <p className="text-[10px] text-slate-500">{vg.options.map(o => o.name).join(', ')}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 right-0 left-0 md:left-64 p-4 bg-white border-t border-slate-100 z-10 flex justify-end">
          <button onClick={handleSave} className="w-full md:w-auto px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">Simpan Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800">Manajemen Menu</h2>
        <button onClick={() => { setFormData({ id: '', name: '', price: 0, hpp: 0, category: 'Makanan', variantGroupIds: [] }); setIsEditing(true); }} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-orange-700 hover:-translate-y-0.5 transition-all duration-300">
          <Plus className="w-4 h-4" /> Tambah Menu
        </button>
      </div>

      <div className="space-y-8 pb-10">
        {Object.keys(groupedMenus).map(category => (
          <div key={category} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <span className="font-heading text-lg font-black text-slate-800 tracking-tight">{category}</span>
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">{groupedMenus[category].length} Item</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedMenus[category].map((menu) => (
                <div key={menu.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col relative group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{menu.category}</span>
                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button onClick={() => { setFormData(menu); setIsEditing(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(menu.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-slate-800 text-base leading-tight mb-1 group-hover:text-orange-600 transition-colors">{menu.name}</h3>
                  <p className="text-orange-600 font-bold mb-3">{formatRupiah(menu.price)}</p>

                  <div className="mt-auto pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">VARIAN TERKAIT:</p>
                    <div className="flex flex-wrap gap-1">
                      {menu.variantGroupIds.length === 0 ? <span className="text-[10px] text-gray-400 italic">Tidak ada varian</span> : (
                        menu.variantGroupIds.map(vid => {
                          const vg = variantGroups.find(v => v.id === vid);
                          return vg ? <span key={vid} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100 transition-colors hover:bg-orange-100">{vg.name}</span> : null;
                        })
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {menus.length === 0 && <div className="p-8 text-center text-slate-400 animate-in fade-in">Belum ada data menu</div>}
      </div>
    </div>
  );
};

export default function App() {

  const { isAdminMode, setIsAdminMode } = useAppContext();
  const [showPinModal, setShowPinModal] = useState(false);

  const handleAdminLogin = () => {
    setIsAdminMode(true);
  };

  const [currentView, setCurrentView] = useState('shift');
  const [activeTab, setActiveTab] = useState('materials');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- DATABASE STATES ---
  const [variantGroups, setVariantGroups] = useState(() => loadData('variantGroups', INITIAL_VARIANT_GROUPS));
  const [menus, setMenus] = useState(() => loadData('menus', INITIAL_MENUS));
  const [salesHistory, setSalesHistory] = useState(() => loadData('salesHistory', []));
  const [hppLibrary, setHppLibrary] = useState(() => loadData('hppLibrary', []));
  const [savedBills, setSavedBills] = useState(() => loadData('savedBills', []));

  // --- HPP & BAHAN BAKU ---
  const [rawMaterials, setRawMaterials] = useState(() => loadData('rawMaterials', INITIAL_RAW_MATERIALS));
  const [semiFinished, setSemiFinished] = useState(() => loadData('semiFinished', []));
  const [categories, setCategories] = useState(() => loadData('categories', INITIAL_CATEGORIES));
  const [editingRecipe, setEditingRecipe] = useState(null);

  // --- KEUANGAN ---
  const [expenseCategories, setExpenseCategories] = useState(() => loadData('expenseCategories', ['Belanja', 'Biaya', 'Kasbon Karyawan', 'Lain-lain']));
  const [expenses, setExpenses] = useState(() => loadData('expenses', []));
  const [incomeCategories, setIncomeCategories] = useState(() => loadData('incomeCategories', ['Modal Tambahan', 'Pendapatan Lain', 'Titipan Uang']));
  const [incomes, setIncomes] = useState(() => loadData('incomes', []));

  // --- SHIFT ---
  const [currentShift, setCurrentShift] = useState(() => loadData('currentShift', null));
  const [shiftHistory, setShiftHistory] = useState(() => loadData('shiftHistory', []));

  // --- PELANGGAN ----
  const [customers, setCustomers] = useState(() => loadData('customers', [
    { id: 'c1', name: 'Budi Santoso', phone: '08123456789', points: 120 },
    { id: 'c2', name: 'Siti Rahma', phone: '08571234567', points: 250 },
    { id: 'c3', name: 'Andi Wijaya', phone: '08998765432', points: 45 }
  ]));
  const [vouchers, setVouchers] = useState(() => loadData('vouchers', [
    { id: 'v1', code: 'MAMAMKENYANG', discountType: 'fixed', discountValue: 5000, minPurchase: 30000 }
  ]));
  const [claimsHistory, setClaimsHistory] = useState(() => loadData('claimsHistory', []));

  // --- PAYROLL STATES ---
  const [employees, setEmployees] = useState(() => loadData('employees', [
    { id: 'EMP-001', name: 'Budi Pekerja', phone: '0812345678', address: 'Jl. Melati', hourlyRate: 15000, startDate: '2023-01-10' }
  ]));
  const [employeeDailyRecords, setEmployeeDailyRecords] = useState(() => loadData('employeeDailyRecords', []));
  const [additionCategories, setAdditionCategories] = useState(() => loadData('additionCategories', ['Ongkir', 'Lembur', 'Bonus', 'Potongin Ayam']));
  const [deductionCategories, setDeductionCategories] = useState(() => loadData('deductionCategories', ['Kasbon', 'Denda', 'Ganti Rugi']));


  // --- SETTINGS ---
  const [storeSettings, setStoreSettings] = useState(() => loadData('storeSettings', {
    autoPrint: false, paperSize: '58mm', printLogo: true, taxRate: 0, serviceCharge: 0
  }));

  // --- SIMPAN PERUBAHAN KE "DATABASE" (localStorage) ---
  useEffect(() => { saveData('variantGroups', variantGroups); }, [variantGroups]);
  useEffect(() => { saveData('menus', menus); }, [menus]);
  useEffect(() => { saveData('salesHistory', salesHistory); }, [salesHistory]);
  useEffect(() => { saveData('hppLibrary', hppLibrary); }, [hppLibrary]);
  useEffect(() => { saveData('savedBills', savedBills); }, [savedBills]);
  useEffect(() => { saveData('expenseCategories', expenseCategories); }, [expenseCategories]);
  useEffect(() => { saveData('expenses', expenses); }, [expenses]);
  useEffect(() => { saveData('incomeCategories', incomeCategories); }, [incomeCategories]);
  useEffect(() => { saveData('incomes', incomes); }, [incomes]);
  useEffect(() => { saveData('currentShift', currentShift); }, [currentShift]);
  useEffect(() => { saveData('shiftHistory', shiftHistory); }, [shiftHistory]);
  useEffect(() => { saveData('customers', customers); }, [customers]);
  useEffect(() => { saveData('vouchers', vouchers); }, [vouchers]);
  useEffect(() => { saveData('claimsHistory', claimsHistory); }, [claimsHistory]);
  useEffect(() => { saveData('storeSettings', storeSettings); }, [storeSettings]);
  useEffect(() => { saveData('rawMaterials', rawMaterials); }, [rawMaterials]);
  useEffect(() => { saveData('semiFinished', semiFinished); }, [semiFinished]);
  useEffect(() => { saveData('categories', categories); }, [categories]);
  useEffect(() => { saveData('employees', employees); }, [employees]);
  useEffect(() => { saveData('employeeDailyRecords', employeeDailyRecords); }, [employeeDailyRecords]);
  useEffect(() => { saveData('additionCategories', additionCategories); }, [additionCategories]);
  useEffect(() => { saveData('deductionCategories', deductionCategories); }, [deductionCategories]);

  // --- STATES APLIKASI ---
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherInputCode, setVoucherInputCode] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [manualDiscount, setManualDiscount] = useState({ type: 'fixed', value: 0 });
  const [isCustomerDropdownMode, setIsCustomerDropdownMode] = useState(false);

  const getBulanIniStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).toISOString().split('T')[0];
  };
  const [reportDateRange, setReportDateRange] = useState({ start: getBulanIniStart(), end: new Date().toISOString().split('T')[0] });
  const [activePreset, setActivePreset] = useState('bulan_ini');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [selectedMenuForVariant, setSelectedMenuForVariant] = useState(null);
  const [variantSelectedOptions, setVariantSelectedOptions] = useState({});

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [paymentModal, setPaymentModal] = useState({ isOpen: false, isSplitMode: false, splitPayments: [], method: 'Tunai', amountPaid: '', status: 'pending' });
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, data: null });
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

  const [payslipModal, setPayslipModal] = useState({ isOpen: false, data: null, month: '' });

  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Dine-in');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customDeliveryFee, setCustomDeliveryFee] = useState('');

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

  const activeCustomer = useMemo(() => {
    if (!customerName) return null;
    return customers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
  }, [customerName, customers]);

  useEffect(() => {
    if (!activeCustomer || cart.length === 0) setPointsToRedeem(0);
  }, [activeCustomer, cart.length]);

  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const getDiscount = () => {
    if (!appliedVoucher) return 0;
    const subtotal = getSubtotal();
    if (subtotal < appliedVoucher.minPurchase) return 0;
    if (appliedVoucher.discountType === 'percent') return subtotal * (appliedVoucher.discountValue / 100);
    return appliedVoucher.discountValue;
  };

  const getPointDiscount = () => pointsToRedeem * 100;

  const getManualDiscountAmount = () => {
    if (!manualDiscount || !manualDiscount.value) return 0;
    if (manualDiscount.type === 'percent') return (getSubtotal() * manualDiscount.value) / 100;
    return manualDiscount.value;
  };

  const getTaxableAmount = () => Math.max(0, getSubtotal() - getDiscount() - getPointDiscount() - getManualDiscountAmount());
  const getTaxAmount = () => getTaxableAmount() * (storeSettings.taxRate / 100);
  const getServiceChargeAmount = () => getTaxableAmount() * (storeSettings.serviceCharge / 100);

  const getTotal = () => Math.max(0, getTaxableAmount() + getTaxAmount() + getServiceChargeAmount() + (orderType === 'Delivery' ? deliveryFee : 0));

  const triggerAlert = (message) => setCustomAlert({ isOpen: true, message });
  const triggerConfirm = (message, onConfirm) => setConfirmModal({ isOpen: true, message, onConfirm });

  const applyDatePreset = (preset) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    setActivePreset(preset);

    if (preset === 'hari_ini') setReportDateRange({ start: todayStr, end: todayStr });
    else if (preset === 'minggu_ini') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).toISOString().split('T')[0], end: todayStr });
    else if (preset === 'bulan_ini') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).toISOString().split('T')[0], end: todayStr });
    else if (preset === 'bulan_berjalan') setReportDateRange({ start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], end: todayStr });
  };

  const addToCart = (menu, selectedOptions = {}) => {
    let extraPriceTotal = 0, variantNames = [], selectedVariantDetails = [];

    Object.entries(selectedOptions).forEach(([groupId, optionIds]) => {
      const group = variantGroups.find(g => g.id === groupId);
      if (group) {
        optionIds.forEach(optId => {
          const opt = group.options.find(o => o.id === optId);
          if (opt) { extraPriceTotal += opt.extraPrice; variantNames.push(opt.name); selectedVariantDetails.push({ groupId, optionId: opt.id, name: opt.name, price: opt.extraPrice }); }
        });
      }
    });

    const price = menu.price + extraPriceTotal;
    const variantNameStr = variantNames.join(', ');
    const optionKeys = selectedVariantDetails.map(v => v.optionId).sort().join('-');
    const cartItemId = optionKeys ? `${menu.id}-${optionKeys}` : menu.id;

    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    if (existingItem) setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: item.qty + 1 } : item));
    else setCart([...cart, { cartItemId, menuId: menu.id, name: menu.name, variantName: variantNameStr, price, qty: 1, hpp: menu.hpp, note: '' }]);
    setSelectedMenuForVariant(null);
  };

  const updateCartQty = (cartItemId, delta) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const updateCartItemNote = (cartItemId, note) => {
    setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, note } : item));
  };

  const handleOpenBill = () => {
    if (cart.length === 0) return;
    const bill = { id: `BILL-${Date.now().toString().slice(-4)}`, customerName: customerName || 'Tanpa Nama', cart, orderType, date: new Date() };
    setSavedBills([...savedBills, bill]);
    triggerAlert('Bill disimpan sebagai Open Bill!');
    setCart([]); setCustomerName(''); setAppliedVoucher(null); setPointsToRedeem(0); setManualDiscount({ type: 'fixed', value: 0 }); setIsCartOpen(false);
  };

  const loadSavedBill = (bill) => {
    setCart(bill.cart); setCustomerName(bill.customerName); setOrderType(bill.orderType);
    setSavedBills(savedBills.filter(b => b.id !== bill.id));
    triggerAlert('Bill berhasil dimuat!');
  };

  const printReceipt = () => window.print();

  // LIVE MATERIALS POOL (RAW + PREP)
  const availableMaterials = useMemo(() => {
    const prepsAsMaterials = semiFinished.map(prep => {
      // 1. Hitung total biaya bahan mentah yang masuk ke Prep berdasarkan harga pasar live
      const totalIngCost = prep.ingredients.reduce((sum, ing) => {
        const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
        const currentPrice = rm ? rm.price : (ing.snapshotPrice || 0);
        return sum + (currentPrice * ing.qtyUsedFraction);
      }, 0);

      // 2. Tambahkan cost labor & overhead dari Prep
      const totalBatchCost = totalIngCost + (Number(prep.laborCost) || 0) + (Number(prep.overheadCost) || 0);

      // 3. Bagi dengan yield untuk dapat Harga per Satuan
      const costPerUnit = totalBatchCost / Math.max(1, Number(prep.yieldQty) || 1);

      return {
        id: prep.id,
        name: `${prep.name} [Prep]`, // Kasih penanda
        unit: prep.resultUnit,
        price: costPerUnit,
        isPrep: true,
        lastUpdated: prep.lastUpdated || new Date()
      };
    });

    return [...rawMaterials, ...prepsAsMaterials];
  }, [rawMaterials, semiFinished]);

  // Membungkus semua props di Context Value
  const contextValue = {
    // POS / Cart

    isAdminMode,
    cart, setCart,
    addToCart,
    updateCartQty,
    updateCartItemNote,
    isCartOpen, setIsCartOpen,
    menus, setMenus,
    selectedMenuForVariant, setSelectedMenuForVariant,
    variantGroups, setVariantGroups,
    variantSelectedOptions, setVariantSelectedOptions,

    vouchers, setVouchers,
    savedBills, setSavedBills,
    storeSettings, setStoreSettings,

    // Payment / Discount
    appliedVoucher, setAppliedVoucher,
    manualDiscount, setManualDiscount,
    voucherInputCode, setVoucherInputCode,
    getDiscount,
    getManualDiscountAmount,
    getPointDiscount,

    // Order / Checkout
    customerName, setCustomerName,
    orderType, setOrderType,
    deliveryFee, setDeliveryFee,
    customDeliveryFee, setCustomDeliveryFee,

    // Customer
    activeCustomer,
    customers, setCustomers,
    isCustomerDropdownMode, setIsCustomerDropdownMode,
    pointsToRedeem, setPointsToRedeem,

    // Employee / Payroll
    employees, setEmployees,
    employeeDailyRecords, setEmployeeDailyRecords,
    additionCategories, setAdditionCategories,
    deductionCategories, setDeductionCategories,
    payslipModal, setPayslipModal,

    // Inventory / HPP / Materials
    availableMaterials,
    editingRecipe, setEditingRecipe,
    hppLibrary, setHppLibrary,
    rawMaterials, setRawMaterials,
    semiFinished, setSemiFinished,

    // Categories
    categories, setCategories,
    expenseCategories, setExpenseCategories,
    incomeCategories, setIncomeCategories,
    selectedCategory, setSelectedCategory,

    // Finance / History / Report
    claimsHistory, setClaimsHistory,
    expenses, setExpenses,
    incomes, setIncomes,
    reportDateRange, setReportDateRange,
    salesHistory, setSalesHistory,
    shiftHistory, setShiftHistory,

    // Shift
    currentShift, setCurrentShift,

    // UI State
    activeTab, setActiveTab,
    activePreset, setActivePreset,
    searchQuery, setSearchQuery,

    paymentModal, setPaymentModal,
    receiptModal, setReceiptModal,
    customAlert, setCustomAlert,
    confirmModal, setConfirmModal,
    isCategoryModalOpen, setIsCategoryModalOpen,

    // Helpers / Calculations
    getSubtotal,
    getTaxableAmount,
    getTaxAmount,
    getServiceChargeAmount,
    getTotal,
    formatRupiah,

    // Actions
    applyDatePreset,
    handleOpenBill,
    loadSavedBill,
    printReceipt,
    triggerAlert,
    triggerConfirm,
  };

  const menuItems = [

    { id: 'shift', icon: Clock, label: 'Shift Kasir' },
    { id: 'pos', icon: ShoppingCart, label: 'Kasir Utama' },
    { id: 'incomes', icon: TrendingUp, label: 'Pemasukan' },
    { id: 'expenses', icon: TrendingDown, label: 'Pengeluaran' },
    { id: 'reports', icon: PieChart, label: 'Laporan & Profit' },
    { id: 'employees', icon: Briefcase, label: 'Manajemen Pegawai' },
    { id: 'menu-mgt', icon: List, label: 'Manajemen Menu' },
    { id: 'variant-mgt', icon: Layers, label: 'Manajemen Varian' },
    { id: 'hpp-calc', icon: Calculator, label: 'Manajemen HPP' },
    { id: 'customers', icon: Users, label: 'Pelanggan & Voucher' },
    { id: 'settings', icon: Settings, label: 'Pengaturan Sistem' },
    { id: 'account', icon: UserCog, label: 'Manajemen Akun' }
  ];

  const visibleMenus = isAdminMode
    ? menuItems
    : menuItems.filter(item =>
      ['shift', 'pos', 'expenses', 'incomes'].includes(item.id)
    );



  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-slate-50 font-body text-slate-800 overflow-hidden w-full relative">
        <style dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'Inter', sans-serif; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
        `}} />

        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
        )}

        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl md:shadow-none border-r border-slate-100 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-6 bg-slate-800 text-white flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-heading font-black text-2xl tracking-wide flex items-center gap-2"><UtensilsCrossed className="w-6 h-6 text-orange-600" /> MAMAM AYAM</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold">Ecosystem</p>
            </div>
            <button className="md:hidden p-1.5 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors" onClick={() => setIsSidebarOpen(false)}><X className="w-4 h-4" /></button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            {visibleMenus.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold text-sm ${currentView === item.id
                  ? 'bg-slate-100 text-slate-900 shadow-sm translate-x-1'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-1'
                  }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors duration-300 ${currentView === item.id
                    ? 'text-slate-900'
                    : 'text-slate-400'
                    }`}
                />
                {item.label}
              </button>
            ))}

            <div className="p-3 border-t">
              {!isAdminMode ? (
                <button
                  onClick={() => setShowPinModal(true)}
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold"
                >
                  Login Admin
                </button>
              ) : (
                <button
                  onClick={() =>
                    triggerConfirm(
                      'Yakin ingin keluar dari mode admin?',
                      () => setIsAdminMode(false)
                    )
                  }
                  className="w-full bg-red-500 text-white py-3 rounded-xl font-bold"
                >
                  Keluar Admin
                </button>
              )}
            </div>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 relative">
          <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-4 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-100 rounded-lg md:hidden text-slate-600 transition-colors" onClick={() => setIsSidebarOpen(true)}><MenuIcon className="w-6 h-6" /></button>
              <div><h2 className="font-heading font-black text-slate-900 text-xl tracking-tight capitalize">{currentView.replace('-', ' ')}</h2></div>
            </div>
            <div className="flex items-center gap-3">
              {currentShift && <span className="hidden md:inline-block bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100"><Clock className="w-3 h-3 inline-block mr-1 mb-0.5" /> Shift Aktif</span>}
              <div className="flex items-center bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-[10px] md:text-xs font-bold border border-slate-200 whitespace-nowrap">{today}</div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative print:overflow-visible flex flex-col">
            {currentView === 'shift' && <ShiftView />}
            {currentView === 'pos' && <PosView />}
            {currentView === 'menu-mgt' && <MenuManagement />}
            {currentView === 'variant-mgt' && <VariantManagement />}
            {currentView === 'hpp-calc' && <HppView />}
            {currentView === 'incomes' && <IncomeView />}
            {currentView === 'expenses' && <ExpenseView />}
            {currentView === 'customers' && <CustomerView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'employees' && <EmployeesView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'account' && <AccountView />}
          </div>
        </main>

        {customAlert.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><CheckCircle2 className="w-6 h-6" /></div>
              <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">Pemberitahuan</h3>
              <p className="text-slate-500 text-sm mb-6">{customAlert.message}</p>
              <button onClick={() => setCustomAlert({ isOpen: false, message: '' })} className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors">Tutup</button>
            </div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><AlertCircle className="w-6 h-6" /></div>
              <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">Konfirmasi Tindakan</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Batal</button>
                <button onClick={() => { if (confirmModal.onConfirm) confirmModal.onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">Ya</button>
              </div>
            </div>
          </div>
        )}

        {/* Global Modals */}
        <CartDrawer />
        <VariantSelectionModal />
        <PaymentModal />
        <ReceiptModal />
        <PayslipModal />

        <PinModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setIsAdminMode(true);
            setShowPinModal(false);
          }}
          triggerAlert={triggerAlert}
        />

      </div>
    </AppContext.Provider >
  );
}

function Layers(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 12 12 17 22 12"></polyline>
      <polyline points="2 17 12 22 22 17"></polyline>
    </svg>
  );
}