import React from "react";
import { useAppContext } from '../../../context/AppContext'; 
import { generateUUID } from '../../../utils/formatters';
import { 
  SplitSquareHorizontal, 
  X, 
  Wallet, 
  QrCode, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Receipt,
  Motorbike
} from "lucide-react";

const PaymentModal = () => {
  const { paymentModal, setPaymentModal, getTotal, getRoundedTotal, getRoundingAdjustment, formatRupiah, activeCustomer, pointsToRedeem, customers, setCustomers, claimsHistory, setClaimsHistory, getPointDiscount, manualDiscount, setManualDiscount, getManualDiscountAmount, customerName, orderType, cart, getSubtotal, getDiscount, getTaxAmount, getServiceChargeAmount, deliveryFee, salesHistory, setSalesHistory, setIsCartOpen, setCart, setCustomerName, setAppliedVoucher, setVoucherInputCode, setPointsToRedeem, setReceiptModal, storeSettings, triggerAlert, setCurrentView } = useAppContext();

  if (!paymentModal.isOpen) return null;

  const originalTotal = getTotal();
  const total = getRoundedTotal();
  const roundingAdjustment = getRoundingAdjustment();
  const { isSplitMode, splitPayments, method, amountPaid, status, ojolName, orderNumber } = paymentModal;

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
      setClaimsHistory([{ id: `cl-${generateUUID()}`, customerName: activeCustomer.name, rewardName: `Potongan Belanja ${formatRupiah(getPointDiscount())}`, pointsUsed: pointsToRedeem, date: new Date() }, ...claimsHistory]);
    }

    const newOrder = {
      id: `ORD-${generateUUID().split('-')[0].toUpperCase()}`, date: new Date(), customerName: customerName || 'Tanpa Nama', orderType, items: [...cart],
      subtotal: getSubtotal(), discount: getDiscount(), pointDiscount: getPointDiscount(),
      manualDiscountAmount: getManualDiscountAmount(),
      taxAmount: getTaxAmount(), serviceAmount: getServiceChargeAmount(),
      deliveryFee, total,
      originalTotal,
      roundingAdjustment,
      paymentMethod: isSplitMode ? 'Split Payment' : method,
      ojolName: method === 'Ojol' ? ojolName : null,             // <- BARIS BARU
      orderNumber: method === 'Ojol' ? orderNumber : null,
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

    setCurrentView('kasir');

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
            {orderType !== 'Ojol' && (
              !isSplitMode ? (
                <button onClick={() => setPaymentModal({ ...paymentModal, isSplitMode: true })} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-xs font-bold flex items-center gap-1"><SplitSquareHorizontal className="w-4 h-4" /> Split</button>
              ) : (
                <button onClick={() => setPaymentModal({ ...paymentModal, isSplitMode: false, splitPayments: [], amountPaid: '' })} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors text-xs font-bold">Batal Split</button>
              )
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
                {roundingAdjustment !== 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Pembulatan: {formatRupiah(roundingAdjustment)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {(orderType === 'Ojol'
                  ? [
                    { id: 'Ojol', icon: Motorbike }
                  ]
                  : [
                    { id: 'Tunai', icon: Wallet },
                    { id: 'QRIS', icon: QrCode },
                    { id: 'Transfer', icon: CreditCard }
                  ]
                ).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPaymentModal({ ...paymentModal, method: opt.id, status: 'pending' })}
                    className={`flex flex-col items-center justify-center p-3 w-24 md:w-28 rounded-2xl border-2 transition-all duration-200 ${method === opt.id
                      ? 'border-orange-600 bg-orange-600 text-white shadow-md -translate-y-1'
                      : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                      }`}
                  >
                    <opt.icon className="w-6 h-6 mb-2" />
                    <span className="text-[11px] md:text-xs font-bold text-center leading-tight">{opt.id}</span>
                  </button>
                ))}
              </div>

              {/* Logika input tambahan untuk metode Ojol */}
              {method === 'Ojol' && (
                <div className="mb-6 p-4 border border-orange-200 bg-orange-50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Aplikasi Ojol</label>
                  <div className="flex gap-2 mb-4">
                    {['Shopeefood', 'Grabfood', 'Gofood'].map((ojol) => (
                      <button key={ojol} onClick={() => setPaymentModal({ ...paymentModal, ojolName: ojol })} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${ojolName === ojol ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        {ojol}
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Nomor Order</label>
                  <input type="text" placeholder="Masukkan nomor order..." value={orderNumber || ''} onChange={(e) => setPaymentModal({ ...paymentModal, orderNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-600 bg-white text-sm font-bold transition-colors" />
                </div>
              )}

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

export default PaymentModal;