import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, Plus, Ticket, Award, CheckCircle2, Info } from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatRupiah } from '../utils/formatters';

const CustomerView = () => {
  const { customers, setCustomers, vouchers, setVouchers, claimsHistory, triggerAlert, formatRupiah } = useAppContext();
  
  const [customerSubTab, setCustomerSubTab] = useState('manage');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustNamePhone] = useState('');
  const [newVoucherCode, setNewVoucherCode] = useState('');
  const [newVoucherDiscount, setNewVoucherDiscount] = useState('');
  const [newVoucherType, setNewVoucherType] = useState('fixed');
  const [newVoucherMinPurchase, setNewVoucherMinPurchase] = useState('');

  const handleAddCustomer = () => {
    if(!newCustName) return triggerAlert('Nama pelanggan wajib diisi!');
    setCustomers([...customers, { id: `CUST-${Date.now()}`, name: newCustName, phone: newCustPhone, points: 0 }]);
    setNewCustName(''); setNewCustNamePhone(''); triggerAlert('Data Pelanggan berhasil ditambahkan!');
  };

  const handleAddVoucher = () => {
    if(!newVoucherCode || !newVoucherDiscount) return triggerAlert('Lengkapi data voucher!');
    setVouchers([...vouchers, { id: `VCH-${Date.now()}`, code: newVoucherCode.toUpperCase(), discountType: newVoucherType, discountValue: Number(newVoucherDiscount), minPurchase: Number(newVoucherMinPurchase) || 0 }]);
    setNewVoucherCode(''); setNewVoucherDiscount(''); setNewVoucherMinPurchase(''); triggerAlert('Voucher siap digunakan!');
  };

  const loyalCustomers = useMemo(() => [...customers].sort((a, b) => b.points - a.points), [customers]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 flex-1 flex flex-col min-h-0 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="shrink-0">
        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-6 h-6 text-orange-600" /> Pelanggan & Reward</h2>
        
        <div className="flex gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto hide-scrollbar">
          <button onClick={() => setCustomerSubTab('manage')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${customerSubTab === 'manage' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Kelola Pelanggan & Voucher</button>
          <button onClick={() => setCustomerSubTab('loyal')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${customerSubTab === 'loyal' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Loyal Customers</button>
          <button onClick={() => setCustomerSubTab('claims')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${customerSubTab === 'claims' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Riwayat Klaim</button>
          <button onClick={() => setCustomerSubTab('rules')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${customerSubTab === 'rules' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Aturan Poin</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-10">
        {customerSubTab === 'manage' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300 ease-out h-full">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
              <div className="p-4 border-b bg-slate-50 rounded-t-2xl font-bold text-slate-800 shrink-0">Data Pelanggan</div>
              <div className="p-4 space-y-3 border-b border-slate-100 bg-white shrink-0">
                <div className="flex gap-2">
                  <input type="text" placeholder="Nama Pelanggan" className="flex-1 p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-100 transition-colors" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
                  <input type="text" placeholder="No. Whatsapp" className="w-1/3 p-2.5 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-100 transition-colors" value={newCustPhone} onChange={e => setNewCustNamePhone(e.target.value)} />
                  <button onClick={handleAddCustomer} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 transition-colors text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 duration-300"><Plus className="w-5 h-5"/></button>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-50/30 custom-scrollbar">
                {customers.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-orange-200 transition-all duration-300">
                    <div>
                      <p className="font-bold text-sm text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{c.phone || 'Tanpa No. HP'}</p>
                    </div>
                    <span className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-100">{c.points} Poin</span>
                  </div>
                ))}
                {customers.length === 0 && <p className="text-center text-xs text-slate-400 mt-10">Belum ada pelanggan</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
              <div className="p-4 border-b bg-slate-50 rounded-t-2xl font-bold text-slate-800 shrink-0">Voucher Diskon Aktif</div>
              <div className="p-4 space-y-3 border-b border-slate-100 bg-white shrink-0">
                <input type="text" placeholder="KODE VOUCHER (Maks 10 huruf)" className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-orange-100 transition-colors" value={newVoucherCode} maxLength={10} onChange={e => setNewVoucherCode(e.target.value)} />
                <div className="flex gap-2">
                  <select className="w-1/3 p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold outline-none transition-colors focus:ring-2 focus:ring-orange-100" value={newVoucherType} onChange={e => setNewVoucherType(e.target.value)}>
                    <option value="fixed">Nominal (Rp)</option>
                    <option value="percent">Persen (%)</option>
                  </select>
                  <input type="number" placeholder="Nilai Potongan" className="flex-1 p-2.5 bg-slate-50 border rounded-xl text-sm outline-none font-bold text-orange-600 focus:ring-2 focus:ring-orange-100 transition-colors" value={newVoucherDiscount} onChange={e => setNewVoucherDiscount(e.target.value)} />
                </div>
                <input type="number" placeholder="Syarat Minimal Belanja (Opsional)" className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-100 transition-colors" value={newVoucherMinPurchase} onChange={e => setNewVoucherMinPurchase(e.target.value)} />
                <button onClick={handleAddVoucher} className="w-full py-3 mt-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"><Ticket className="w-4 h-4" /> Simpan Voucher</button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-50/30 custom-scrollbar">
                {vouchers.map(v => (
                  <div key={v.id} className="flex justify-between items-center p-3 bg-white border border-orange-100 rounded-xl shadow-sm relative overflow-hidden transition-shadow duration-300">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-600"></div>
                    <div className="pl-3">
                      <p className="font-black text-orange-600 tracking-wider text-sm">{v.code}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Min. Order: {formatRupiah(v.minPurchase)}</p>
                    </div>
                    <span className="font-bold text-sm text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">Diskon {v.discountType === 'percent' ? `${v.discountValue}%` : formatRupiah(v.discountValue)}</span>
                  </div>
                ))}
                {vouchers.length === 0 && <p className="text-center text-xs text-slate-400 mt-10">Belum ada voucher</p>}
              </div>
            </div>
          </div>
        )}

        {customerSubTab === 'loyal' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl ease-out">
            <h3 className="font-heading font-bold text-slate-800 text-base mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400" /> Peringkat Pelanggan Terloyal (Poin Terbanyak)</h3>
            <div className="space-y-3">
              {loyalCustomers.map((c, index) => (
                <div key={c.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl hover:border-yellow-400 hover:shadow-md bg-white transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-full shadow-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400' : index === 1 ? 'bg-slate-100 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
                    <div><h4 className="font-heading font-bold text-slate-800 text-sm">{c.name}</h4><p className="text-xs text-slate-400">{c.phone || 'Tanpa No. HP'}</p></div>
                  </div>
                  <div className="text-right"><span className="bg-yellow-50 text-yellow-700 font-black px-4 py-2 rounded-xl border border-yellow-200 text-sm shadow-sm">{c.points} Poin</span></div>
                </div>
              ))}
              {loyalCustomers.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Belum ada data pelanggan.</p>}
            </div>
          </div>
        )}

        {customerSubTab === 'claims' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl ease-out">
            <h3 className="font-heading font-bold text-slate-800 text-base mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Riwayat Klaim Reward & Tukar Poin</h3>
            <div className="space-y-3">
              {claimsHistory.map(claim => (
                <div key={claim.id} className="flex justify-between items-center p-3.5 border border-green-100 bg-green-50/20 rounded-2xl hover:bg-green-50/40 transition-colors duration-300">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{claim.customerName}</p>
                    <p className="text-[11px] text-slate-500 font-semibold">{claim.rewardName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(claim.date).toLocaleDateString('id-ID', { hour: '2-digit', minute:'2-digit' })}</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">Selesai Klaim (-{claim.pointsUsed} Pts)</span>
                </div>
              ))}
              {claimsHistory.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Belum ada riwayat klaim reward.</p>}
            </div>
          </div>
        )}

        {customerSubTab === 'rules' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl space-y-6 ease-out">
            <div className="flex items-center gap-2 border-b pb-3"><Info className="w-5 h-5 text-orange-600" /><h3 className="font-heading font-bold text-slate-800 text-base">Aturan Poin & Ketentuan Reward</h3></div>
            <div className="space-y-4">
              <div className="flex gap-3"><div className="w-6 h-6 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">1</div><div><h4 className="font-heading font-bold text-slate-800 text-sm mb-0.5">Cara Mendapatkan Poin</h4><p className="text-xs text-slate-500 leading-relaxed">Pelanggan terdaftar akan mendapatkan <strong className="text-orange-600">1 Poin untuk setiap transaksi kelipatan Rp 10.000</strong> dari total tagihan bersih (setelah diskon).</p></div></div>
              <div className="flex gap-3"><div className="w-6 h-6 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">2</div><div><h4 className="font-heading font-bold text-slate-800 text-sm mb-0.5">Nilai Tukar Poin</h4><p className="text-xs text-slate-500 leading-relaxed">Setiap <strong className="text-yellow-500">1 Poin bernilai Rp 100</strong> potongan belanja langsung. Poin dapat langsung dikurangi dari total tagihan pada keranjang belanja saat checkout.</p></div></div>
              <div className="flex gap-3"><div className="w-6 h-6 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">3</div><div><h4 className="font-heading font-bold text-slate-800 text-sm mb-0.5">Syarat Pelanggan & Member</h4><p className="text-xs text-slate-500 leading-relaxed">Pastikan nama pelanggan yang diinput pada saat transaksi di kasir sesuai dengan database member agar poin otomatis terhitung.</p></div></div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 shadow-sm"><p className="text-xs text-yellow-800 font-medium leading-relaxed"><strong>💡 Info Kasir:</strong> Anda dapat membantu pelanggan menukarkan poin mereka secara fleksibel melalui kolom "Klaim Poin" yang disediakan sejajar dengan voucher di keranjang pesanan.</p></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerView;