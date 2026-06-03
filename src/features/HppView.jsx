import React, { useState, useMemo, useEffect } from 'react';
import { getIngredientCost } from '../utils/hppUtils';
import { AppContext, useAppContext } from '../context/AppContext';
import { formatRupiah } from '../utils/formatters';
import { 
  MenuIcon, X, Plus, Trash2, CheckCircle2, ChevronRight, Calculator, PieChart, 
  Save, AlertCircle, Edit3, BookOpen, Package, Layers, Clock, Search, TrendingDown, HelpCircle, Beaker 
} from 'lucide-react';

// =========================================================================
// SUB-KOMPONEN TAMPILAN
// =========================================================================

const BahanBakuView = () => {
  const { rawMaterials, setRawMaterials, triggerAlert, triggerConfirm } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', unit: '', price: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const handleSave = () => {
    if (!formData.name || !formData.unit || !formData.price) {
      return triggerAlert('Semua kolom (Nama, Satuan, Harga) wajib diisi!');
    }
    
    if (formData.id) {
      const existing = rawMaterials.find(rm => rm.id === formData.id);
      const isPriceChanged = existing && existing.price !== Number(formData.price);
      
      setRawMaterials(rawMaterials.map(rm => 
        rm.id === formData.id 
          ? { ...formData, price: Number(formData.price), lastUpdated: isPriceChanged ? new Date() : rm.lastUpdated } 
          : rm
      ));
      triggerAlert('Data bahan baku berhasil diperbarui!');
    } else {
      setRawMaterials([...rawMaterials, { 
        ...formData, 
        id: `rm-${Date.now()}`, 
        price: Number(formData.price), 
        lastUpdated: new Date() 
      }]);
      triggerAlert('Bahan baku baru berhasil ditambahkan!');
    }
    
    setFormData({ id: '', name: '', unit: '', price: '' });
    setIsEditing(false);
  };

  const handleDelete = (id) => {
    triggerConfirm('Yakin ingin menghapus bahan baku ini? Kalkulasi HPP dan Bahan Setengah Jadi yang menggunakan bahan ini mungkin akan terpengaruh.', () => {
      setRawMaterials(rawMaterials.filter(rm => rm.id !== id));
    });
  };

  const filteredMaterials = rawMaterials.filter(rm => rm.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-heading text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-600" /> Database Bahan Baku Pasar
          </h3>
          <p className="text-xs text-slate-500 mt-1">Kelola acuan harga bahan baku dasar murni dari pasar disini.</p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="bg-orange-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-orange-700 transition-all shadow-md">
            <Plus className="w-4 h-4"/> Tambah Bahan Baku
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h4 className="font-heading font-bold text-slate-800 text-sm">{formData.id ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}</h4>
            <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Bahan Baku</label>
              <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700 transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Contoh: Ayam Potong" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Satuan Pembelian</label>
              <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700 transition-colors" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="Contoh: Ekor, Kg, Liter, Gram" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Harga Beli Saat Ini (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                <input type="number" className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-800 transition-colors" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-xs">Batal</button>
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-sm flex items-center gap-1.5 transition-colors text-xs"><Save className="w-4 h-4"/> Simpan</button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center">
          <Search className="w-4 h-4 text-slate-400 ml-3 mr-2" />
          <input type="text" placeholder="Cari bahan baku..." className="flex-1 p-1 outline-none text-xs font-semibold bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">Nama Bahan</th>
                <th className="p-4 font-bold">Satuan</th>
                <th className="p-4 font-bold">Harga Pasar Saat Ini</th>
                <th className="p-4 font-bold">Log Update Terakhir</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMaterials.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Belum ada data bahan baku</td></tr>
              ) : (
                filteredMaterials.map((rm) => {
                  const isUpdatedToday = rm.lastUpdated.toDateString() === new Date().toDateString();
                  return (
                    <tr key={rm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{rm.name}</td>
                      <td className="p-4 font-semibold text-slate-600">{rm.unit}</td>
                      <td className="p-4 font-black text-orange-600">{formatRupiah(rm.price)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${isUpdatedToday ? 'text-green-500' : 'text-slate-400'}`} />
                          <span className={`text-[11px] font-semibold ${isUpdatedToday ? 'text-green-600' : 'text-slate-500'}`}>
                            {rm.lastUpdated.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setFormData(rm); setIsEditing(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(rm.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BahanSetengahJadiView = () => {
  const { rawMaterials, semiFinished, setSemiFinished, triggerAlert, triggerConfirm, availableMaterials } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [prepId, setPrepId] = useState('');
  const [prepName, setPrepName] = useState('');
  const [resultUnit, setResultUnit] = useState('');
  const [yieldQty, setYieldQty] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [overheadCost, setOverheadCost] = useState('');
  const [ingredients, setIngredients] = useState([
    { id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }
  ]);

  const handleAddIngredient = () => setIngredients([...ingredients, { id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
  const handleRemoveIngredient = (id) => setIngredients(ingredients.length > 1 ? ingredients.filter(ing => ing.id !== id) : [{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
  
  const handleIngredientChange = (id, field, value) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));
  };

  const handleEdit = (prep) => {
    setPrepId(prep.id);
    setPrepName(prep.name);
    setResultUnit(prep.resultUnit);
    setYieldQty(String(prep.yieldQty));
    setLaborCost(prep.laborCost ? String(prep.laborCost) : '');
    setOverheadCost(prep.overheadCost ? String(prep.overheadCost) : '');

    const mappedIngredients = prep.ingredients.map((ing, idx) => {
      const dbMaterial = rawMaterials.find(r => r.id === ing.rawMaterialId);
      return {
        id: Date.now() + idx,
        name: dbMaterial ? dbMaterial.name : 'Bahan',
        unit: dbMaterial ? dbMaterial.unit : ing.unit,
        price: dbMaterial ? String(dbMaterial.price) : String(ing.snapshotPrice),
        qtyUsed: ing.recipeQtyUsed !== undefined ? String(ing.recipeQtyUsed) : '1',
        recipeUnit: ing.recipeUnit || ing.unit
      };
    });
    setIngredients(mappedIngredients.length > 0 ? mappedIngredients : [{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
    setIsEditing(true);
  };

  const resetForm = () => {
    setPrepId(''); setPrepName(''); setResultUnit(''); setYieldQty('');
    setLaborCost(''); setOverheadCost('');
    setIngredients([{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!prepName.trim()) return triggerAlert('Nama Bahan Prep wajib diisi!');
    if (!resultUnit.trim()) return triggerAlert('Satuan Hasil wajib diisi! (Misal: Gram, Porsi)');
    if (!yieldQty || Number(yieldQty) <= 0) return triggerAlert('Jumlah Hasil harus lebih dari 0!');
    
    const hasEmptyIngredient = ingredients.some(ing => !ing.name.trim() || !ing.price || Number(ing.price) < 0);
    if (hasEmptyIngredient) return triggerAlert('Lengkapi data seluruh Bahan Baku yang digunakan!');

    const newPrep = {
      id: prepId || `prep-${Date.now()}`,
      name: prepName,
      resultUnit,
      yieldQty: Number(yieldQty),
      laborCost: Number(laborCost) || 0,
      overheadCost: Number(overheadCost) || 0,
      ingredients: ingredients.map(ing => {
        const match = rawMaterials.find(r => r.name.toLowerCase() === ing.name.toLowerCase());
        const cost = getIngredientCost(ing);
        const basePrice = Number(ing.price) || 0;
        const qtyFraction = basePrice > 0 ? (cost / basePrice) : 0;

        return {
          rawMaterialId: match ? match.id : `rm-custom-${Date.now()}`,
          qtyUsedFraction: qtyFraction, 
          snapshotPrice: basePrice,
          recipeQtyUsed: Number(ing.qtyUsed) || 1,
          recipeUnit: ing.recipeUnit || ing.unit,
          unit: ing.unit
        };
      }),
      lastUpdated: new Date()
    };

    if (prepId) {
      setSemiFinished(semiFinished.map(sf => sf.id === prepId ? newPrep : sf));
      triggerAlert(`Bahan Prep "${prepName}" berhasil diperbarui!`);
    } else {
      setSemiFinished([...semiFinished, newPrep]);
      triggerAlert(`Bahan Prep "${prepName}" berhasil ditambahkan!`);
    }
    resetForm();
  };

  const handleDelete = (id) => {
    triggerConfirm('Yakin ingin menghapus bahan prep ini? Kalkulasi HPP produk yang menggunakan bahan ini mungkin akan terpengaruh.', () => {
      setSemiFinished(semiFinished.filter(sf => sf.id !== id));
    });
  };

  const totalIngredientCost = useMemo(() => {
    return ingredients.reduce((sum, item) => sum + getIngredientCost(item), 0);
  }, [ingredients]);

  const livePrepCostPerUnit = (totalIngredientCost + (Number(laborCost)||0) + (Number(overheadCost)||0)) / Math.max(1, Number(yieldQty)||1);

  const filteredPreps = availableMaterials.filter(m => m.isPrep && m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-heading text-xl font-bold text-slate-800 flex items-center gap-2">
            <Beaker className="w-6 h-6 text-orange-600" /> Bahan Setengah Jadi (Prep)
          </h3>
          <p className="text-xs text-slate-500 mt-1">Buat bahan olahan (misal: Bumbu Dasar, Ayam Ungkep) untuk dipakai di Kalkulator HPP.</p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="bg-orange-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-orange-700 transition-all shadow-md">
            <Plus className="w-4 h-4"/> Tambah Bahan Prep
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in slide-in-from-top-2">
          {/* KOLOM KIRI: FORM PREP */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <h4 className="font-heading font-bold text-slate-800 text-sm">{prepId ? 'Edit Bahan Setengah Jadi' : 'Form Bahan Setengah Jadi Baru'}</h4>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Prep</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700 transition-colors" value={prepName} onChange={e => setPrepName(e.target.value)} placeholder="Contoh: Bumbu Dasar Merah" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Satuan Hasil</label>
                  <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700 transition-colors" value={resultUnit} onChange={e => setResultUnit(e.target.value)} placeholder="Contoh: Gram, Liter, Porsi" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jumlah Hasil</label>
                  <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700 transition-colors" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-2">Bahan Baku Mentah Yang Dipakai:</label>
                
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {ingredients.map((ing, index) => (
                    <div key={ing.id} className="grid grid-cols-12 gap-2 items-center border-b border-slate-200 pb-4 md:pb-0 md:border-none last:border-0 last:pb-0">
                      <div className="col-span-12 md:col-span-3">
                        {index === 0 && <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Nama Bahan Mentah</label>}
                        <select 
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-orange-500 text-xs text-slate-700 font-medium" 
                          value={ing.name} 
                          onChange={e => {
                            const val = e.target.value;
                            const matched = rawMaterials.find(r => r.name === val);
                            if (matched) {
                              setIngredients(ingredients.map(i => i.id === ing.id ? { ...i, name: val, unit: matched.unit, price: String(matched.price), recipeUnit: matched.unit, qtyUsed: '1' } : i));
                            } else {
                              handleIngredientChange(ing.id, 'name', val);
                            }
                          }}
                        >
                          <option value="" disabled>-- Pilih Bahan Mentah --</option>
                          {rawMaterials.map(rm => <option key={rm.id} value={rm.name}>{rm.name}</option>)}
                          {ing.name && !rawMaterials.find(r => r.name === ing.name) && <option value={ing.name}>{ing.name}</option>}
                        </select>
                      </div>
                      
                      <div className="col-span-12 sm:col-span-4 md:col-span-3">
                        {index === 0 && <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Harga Beli</label>}
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                            <input type="number" className="w-full p-2.5 pl-7 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs text-slate-600 font-bold" value={ing.price} readOnly placeholder="Harga" title="Harga dasar dari database" />
                          </div>
                          <input type="text" className="w-14 p-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs text-slate-500 font-semibold text-center" value={ing.unit} readOnly placeholder="Sat" title="Satuan dasar dari database" />
                        </div>
                      </div>

                      <div className="col-span-6 sm:col-span-2 md:col-span-1">
                        {index === 0 && <label className="block text-[10px] font-bold text-slate-500 mb-1.5 text-center uppercase">Jumlah</label>}
                        <input type="number" step="any" className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-orange-500 text-xs text-slate-800 font-bold text-center" value={ing.qtyUsed} onChange={e => handleIngredientChange(ing.id, 'qtyUsed', e.target.value)} placeholder="1" />
                      </div>

                      <div className="col-span-6 sm:col-span-2 md:col-span-2">
                        {index === 0 && <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Satuan Pakai</label>}
                        <select className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-orange-500 text-xs text-slate-700 font-semibold cursor-pointer" value={ing.recipeUnit || ing.unit} onChange={e => handleIngredientChange(ing.id, 'recipeUnit', e.target.value)}>
                          <option value={ing.unit}>{ing.unit || 'Satuan'}</option>
                          {ing.unit?.toLowerCase() === 'kg' && <option value="Gram">Gram</option>}
                          {ing.unit?.toLowerCase() === 'liter' && <option value="ml">ml</option>}
                          {ing.unit?.toLowerCase() === 'ekor' && <option value="Potong">Potong</option>}
                          <option value="Gram">Gram</option><option value="ml">ml</option><option value="Pcs">Pcs</option><option value="Sdm">Sdm</option><option value="Sdt">Sdt</option>
                        </select>
                      </div>

                      <div className="col-span-10 sm:col-span-3 md:col-span-2">
                        {index === 0 && <label className="block text-[10px] font-bold text-slate-500 mb-1.5 text-center uppercase">Biaya</label>}
                        <div className="p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-900 font-black text-center truncate">
                          {formatRupiah(getIngredientCost(ing))}
                        </div>
                      </div>

                      <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-5' : ''}`}>
                        <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Bahan"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-center md:justify-start">
                  <button onClick={handleAddIngredient} className="flex items-center gap-1.5 px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-bold rounded-xl transition-all">
                    <Plus className="w-3.5 h-3.5"/> Tambah Bahan Mentah
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Total Biaya Tenaga Kerja (1 Resep Prep)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                    <input type="number" className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-800" value={laborCost} onChange={e => setLaborCost(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Total Biaya Overhead Gas/Dll (1 Resep Prep)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                    <input type="number" className="w-full p-2.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-800" value={overheadCost} onChange={e => setOverheadCost(e.target.value)} placeholder="0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-5 text-white space-y-4">
            <h4 className="font-heading font-black text-sm text-slate-100 border-b border-slate-800 pb-2">SIMULASI HPP PREP</h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total Biaya Bahan Baku:</span>
                <span className="font-bold text-slate-100">{formatRupiah(totalIngredientCost)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Biaya Produksi:</span>
                <span className="font-bold text-slate-100">{formatRupiah(Number(laborCost) + Number(overheadCost))}</span>
              </div>
              <div className="h-px bg-slate-800 my-2"></div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Total Keseluruhan (1 Batch):</span>
                <span className="font-bold text-orange-400">{formatRupiah(totalIngredientCost + Number(laborCost) + Number(overheadCost))}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Menghasilkan (Yield):</span>
                <span className="font-bold text-orange-400">{yieldQty || 0} {resultUnit || 'Unit'}</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 text-center mt-4">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">HPP Prep per {resultUnit || 'Satuan'}</span>
              <span className="block text-2xl font-black text-green-400 mt-1">{formatRupiah(livePrepCostPerUnit)}</span>
            </div>
            
            <p className="text-[10px] text-slate-500 text-center italic mt-2">Bahan Prep ini akan muncul di dropdown tab Kalkulator HPP secara otomatis.</p>

            <button onClick={handleSave} className="w-full py-3 mt-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg text-xs">
              <Save className="w-4 h-4" /> {prepId ? 'Update Bahan Prep' : 'Simpan Bahan Prep'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center mb-4">
            <Search className="w-4 h-4 text-slate-400 ml-3 mr-2" />
            <input type="text" placeholder="Cari bahan setengah jadi..." className="flex-1 p-1 outline-none text-xs font-semibold bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4 font-bold">Nama Bahan Prep</th>
                    <th className="p-4 font-bold">Satuan Hasil</th>
                    <th className="p-4 font-bold">HPP Live per Satuan</th>
                    <th className="p-4 font-bold">Log Update (Komposisi)</th>
                    <th className="p-4 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPreps.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Belum ada data bahan setengah jadi</td></tr>
                  ) : (
                    filteredPreps.map((prep) => {
                      const originalPrep = semiFinished.find(s => s.id === prep.id);
                      return (
                        <tr key={prep.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-800">{prep.name.replace(' [Prep]', '')} <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded font-black ml-1">PREP</span></td>
                          <td className="p-4 font-semibold text-slate-600">{prep.unit}</td>
                          <td className="p-4 font-black text-green-600">{formatRupiah(prep.price)}</td>
                          <td className="p-4 text-slate-500 font-medium">
                            {prep.lastUpdated.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <button onClick={() => handleEdit(originalPrep)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(prep.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const KalkulatorHppView = () => {
  const { 
    rawMaterials,
    availableMaterials,
    hppLibrary, 
    setHppLibrary, 
    categories,
    setIsCategoryModalOpen,
    triggerAlert, 
    triggerConfirm,
    editingRecipe,
    setEditingRecipe,
    setActiveTab
  } = useAppContext();
  
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Uncategorized');
  const [yieldQty, setYieldQty] = useState('');
  const [ingredients, setIngredients] = useState([
    { id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }
  ]);
  const [laborCost, setLaborCost] = useState('');
  const [overheadCost, setOverheadCost] = useState('');
  const [marginPercent, setMarginPercent] = useState(35);
  const [manualPrice, setManualPrice] = useState('');
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (editingRecipe) {
      setProductName(editingRecipe.name);
      setCategory(editingRecipe.category || categories[0] || 'Uncategorized');
      setYieldQty(String(editingRecipe.yieldQty || ''));
      setLaborCost(editingRecipe.laborCost ? String(editingRecipe.laborCost) : '');
      setOverheadCost(editingRecipe.overheadCost ? String(editingRecipe.overheadCost) : '');
      setMarginPercent(editingRecipe.marginPercent || 35);
      setManualPrice(editingRecipe.finalPrice ? String(editingRecipe.finalPrice) : '');
      
      const mappedIngredients = editingRecipe.ingredients.map((ing, idx) => {
        const dbMaterial = availableMaterials.find(r => r.id === ing.rawMaterialId);
        const storedQty = ing.recipeQtyUsed !== undefined ? String(ing.recipeQtyUsed) : String(ing.qtyUsed);
        const storedRecipeUnit = ing.recipeUnit || (dbMaterial ? dbMaterial.unit : 'Unit');

        return {
          id: Date.now() + idx,
          name: dbMaterial ? dbMaterial.name : 'Bahan',
          unit: dbMaterial ? dbMaterial.unit : (ing.unit || 'Unit'),
          price: dbMaterial ? String(dbMaterial.price) : String(ing.snapshotPrice),
          qtyUsed: storedQty,
          recipeUnit: storedRecipeUnit
        };
      });
      setIngredients(mappedIngredients.length > 0 ? mappedIngredients : [{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
      setShowResult(true);
    }
  }, [editingRecipe, availableMaterials, categories]);

  const handleAddIngredient = () => setIngredients([...ingredients, { id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
  const handleRemoveIngredient = (id) => setIngredients(ingredients.length > 1 ? ingredients.filter(ing => ing.id !== id) : [{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
  
  const handleIngredientChange = (id, field, value) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));
  };

  const handleReset = () => { 
    setProductName(''); 
    setCategory(categories[0] || 'Uncategorized'); 
    setIngredients([{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]); 
    setLaborCost(''); 
    setOverheadCost(''); 
    setYieldQty(''); 
    setMarginPercent(35); 
    setManualPrice('');
    setEditingRecipe(null);
    setShowResult(false);
  };

  const handleCalculate = () => {
    if (!productName.trim()) return triggerAlert('Nama Produk wajib diisi!');
    const hasEmptyIngredient = ingredients.some(ing => !ing.name.trim() || !ing.price || Number(ing.price) < 0);
    if (hasEmptyIngredient) return triggerAlert('Lengkapi data seluruh Bahan!');
    if (!yieldQty || Number(yieldQty) <= 0) return triggerAlert('Jumlah Produk (Unit) yang dihasilkan harus lebih besar dari 0!');

    setShowResult(true);
  };

  const totalWeight = useMemo(() => {
    return ingredients.reduce((sum, item) => {
      let qty = Number(item.qtyUsed) || 0;
      let unit = (item.recipeUnit || item.unit || '').toLowerCase().trim();
      if (unit === 'kg') qty *= 1000;
      if (unit === 'liter' || unit === 'l') qty *= 1000;
      if (unit === 'sdm') qty *= 15; 
      if (unit === 'sdt') qty *= 5;  
      return sum + qty;
    }, 0);
  }, [ingredients]);

  const totalIngredientCost = useMemo(() => {
    return ingredients.reduce((sum, item) => sum + getIngredientCost(item), 0);
  }, [ingredients]);

  const yld = Math.max(1, Number(yieldQty) || 1); 
  const materialCostPerUnit = totalIngredientCost / yld;
  const lbrCost = Number(laborCost) || 0;
  const ovhCost = Number(overheadCost) || 0;
  const totalHppPerUnit = materialCostPerUnit + lbrCost + ovhCost;
  
  const recommendedPrice = totalHppPerUnit > 0 ? totalHppPerUnit / (1 - (marginPercent / 100)) : 0;
  const roundedRecommendedPrice = Math.ceil(recommendedPrice / 100) * 100;

  const finalPriceValue = manualPrice !== '' ? Number(manualPrice) : roundedRecommendedPrice;
  const actualProfitValue = finalPriceValue - totalHppPerUnit;
  const actualProfitPercent = finalPriceValue > 0 ? (actualProfitValue / finalPriceValue) * 100 : 0;

  const handleSaveToLibrary = () => {
    const saveAction = () => {
      const newRecipe = {
        id: editingRecipe ? editingRecipe.id : `hpp-${Date.now()}`,
        name: productName,
        category,
        ingredients: ingredients.map(ing => {
          const match = availableMaterials.find(r => r.name.toLowerCase() === ing.name.toLowerCase());
          const cost = getIngredientCost(ing);
          const basePrice = Number(ing.price) || 0;
          const qtyFraction = basePrice > 0 ? (cost / basePrice) : 0;

          return {
            rawMaterialId: match ? match.id : `rm-custom-${Date.now()}`,
            qtyUsed: qtyFraction, 
            snapshotPrice: basePrice,
            recipeQtyUsed: Number(ing.qtyUsed) || 1,
            recipeUnit: ing.recipeUnit || ing.unit,
            unit: ing.unit 
          };
        }),
        laborCost: lbrCost,
        overheadCost: ovhCost,
        yieldQty: yld,
        marginPercent,
        suggestedPrice: roundedRecommendedPrice,
        finalPrice: finalPriceValue,
        date: new Date()
      };

      if (editingRecipe) {
        setHppLibrary(hppLibrary.map(item => item.id === editingRecipe.id ? newRecipe : item));
        triggerAlert(`Berhasil memperbarui resep "${productName}"!`);
        setEditingRecipe(null);
      } else {
        const isDuplicate = hppLibrary.some(item => item.name.toLowerCase() === productName.toLowerCase());
        if (isDuplicate) {
          triggerConfirm(`Menu dengan nama "${productName}" sudah ada. Timpa dengan hitungan baru?`, () => {
            setHppLibrary(hppLibrary.map(item => item.name.toLowerCase() === productName.toLowerCase() ? { ...newRecipe, id: item.id } : item));
            triggerAlert(`Resep "${productName}" berhasil di-update!`);
            handleReset();
            setActiveTab('library');
          });
          return;
        }
        setHppLibrary([...hppLibrary, newRecipe]);
        triggerAlert(`Resep "${productName}" berhasil disimpan ke Library!`);
      }
      handleReset();
      setActiveTab('library');
    };

    saveAction();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="font-heading text-sm font-bold text-slate-800">Informasi Produk</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nama Produk Final</label>
                <input type="text" className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs font-medium text-slate-800 transition-colors" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Contoh: Es Teh, Nasi Goreng, Bakso" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-500">Kategori</label>
                  <button onClick={() => setIsCategoryModalOpen(true)} className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Edit3 className="w-3 h-3"/> Kelola Kategori
                  </button>
                </div>
                <select className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs font-medium text-slate-800 transition-colors cursor-pointer" value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                  {!categories.includes(category) && category && <option value={category}>{category}</option>}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🛒</span> Komposisi Bahan & Satuan Pakai
            </h4>
            
            <div className="space-y-4">
              {ingredients.map((ing, index) => (
                <div key={ing.id} className="grid grid-cols-12 gap-2 items-center animate-in slide-in-from-left-2 border-b border-slate-100 pb-3 md:pb-0 md:border-none">
                  <div className="col-span-12 md:col-span-3">
                    {index === 0 && <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Nama Bahan</label>}
                    <select 
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs text-slate-700 font-medium" 
                      value={ing.name} 
                      onChange={e => {
                        const val = e.target.value;
                        const matched = availableMaterials.find(r => r.name === val);
                        if (matched) {
                          setIngredients(ingredients.map(i => i.id === ing.id ? { ...i, name: val, unit: matched.unit, price: String(matched.price), recipeUnit: matched.unit, qtyUsed: '1' } : i));
                        } else {
                          handleIngredientChange(ing.id, 'name', val);
                        }
                      }}
                    >
                      <option value="" disabled>-- Pilih Bahan --</option>
                      <optgroup label="Bahan Baku Pasar">
                        {availableMaterials.filter(m => !m.isPrep).map(rm => <option key={rm.id} value={rm.name}>{rm.name}</option>)}
                      </optgroup>
                      <optgroup label="Bahan Setengah Jadi (Prep)">
                        {availableMaterials.filter(m => m.isPrep).map(prep => <option key={prep.id} value={prep.name}>{prep.name}</option>)}
                      </optgroup>
                      {ing.name && !availableMaterials.find(r => r.name === ing.name) && <option value={ing.name}>{ing.name}</option>}
                    </select>
                  </div>
                  
                  <div className="col-span-12 sm:col-span-4 md:col-span-3">
                    {index === 0 && <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Harga & Satuan</label>}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Rp</span>
                        <input type="number" className="w-full p-2.5 pl-7 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs text-slate-600 font-bold" value={ing.price} readOnly placeholder="Harga" />
                      </div>
                      <input type="text" className="w-14 p-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs text-slate-500 font-semibold text-center" value={ing.unit} readOnly placeholder="Sat" />
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 md:col-span-1">
                    {index === 0 && <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 text-center">Jumlah</label>}
                    <input type="number" step="any" className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs text-slate-800 font-bold text-center" value={ing.qtyUsed} onChange={e => handleIngredientChange(ing.id, 'qtyUsed', e.target.value)} placeholder="1" />
                  </div>

                  <div className="col-span-6 sm:col-span-2 md:col-span-2">
                    {index === 0 && <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Satuan Pakai</label>}
                    <select className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs text-slate-700 font-semibold cursor-pointer" value={ing.recipeUnit || ing.unit} onChange={e => handleIngredientChange(ing.id, 'recipeUnit', e.target.value)}>
                      <option value={ing.unit}>{ing.unit || 'Satuan'}</option>
                      {ing.unit?.toLowerCase() === 'kg' && <option value="Gram">Gram</option>}
                      {ing.unit?.toLowerCase() === 'liter' && <option value="ml">ml</option>}
                      {ing.unit?.toLowerCase() === 'ekor' && <option value="Potong">Potong</option>}
                      <option value="Gram">Gram</option><option value="ml">ml</option><option value="Pcs">Pcs</option><option value="Sdm">Sdm</option><option value="Sdt">Sdt</option>
                    </select>
                  </div>

                  <div className="col-span-10 sm:col-span-3 md:col-span-2">
                    {index === 0 && <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 text-center">Biaya Komposisi</label>}
                    <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 font-black text-center truncate">{formatRupiah(getIngredientCost(ing))}</div>
                  </div>

                  <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-6' : ''}`}>
                    <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              <button onClick={handleAddIngredient} className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"><Plus className="w-3.5 h-3.5"/> Tambah Komposisi</button>
            </div>
            
            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 flex flex-col gap-2.5 text-xs mt-4">
              <div className="flex justify-between items-center border-b border-blue-100/60 pb-2">
                <span className="text-blue-700 font-bold">Total Estimasi Berat / Volume:</span>
                <span className="text-sm font-black text-blue-900">{totalWeight} <span className="text-[10px] text-blue-700 font-semibold">Gram/ml/pcs</span></span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-100/60 pb-2">
                <span className="text-blue-700 font-bold">Total Biaya Komposisi Bahan (Murni):</span>
                <span className="text-sm font-black text-blue-900">{formatRupiah(totalIngredientCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-black">HPP Bahan per Gram/ml:</span>
                <span className="text-sm font-black text-orange-600">{formatRupiah(totalWeight > 0 ? totalIngredientCost / totalWeight : 0)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2"><span>📦</span> Jumlah Produk yang Dihasilkan</h4>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jumlah Produk (Unit)</label>
              <input type="number" className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 text-xs font-bold text-slate-800" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="Contoh: 10, 50, 100" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button onClick={handleCalculate} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"><Calculator className="w-4 h-4"/> Hitung HPP Final</button>
            <button onClick={handleReset} className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all">Reset</button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
          {showResult ? (
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-5 text-white space-y-5 animate-in zoom-in-95 duration-200">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-heading font-black text-sm text-slate-100 tracking-wider">HASIL ANALISA & HARGA JUAL</h4>
                  <p className="text-[10px] text-slate-400">Atur simulasi margin & harga akhir toko Anda.</p>
                </div>
                <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Bahan / Porsi:</span>
                  <span className="font-bold text-slate-100">{formatRupiah(materialCostPerUnit)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tenaga Kerja / Porsi:</span>
                  <span className="font-bold text-slate-100">{formatRupiah(lbrCost)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Overhead / Kemasan:</span>
                  <span className="font-bold text-slate-100">{formatRupiah(ovhCost)}</span>
                </div>
                <div className="h-px bg-slate-800 my-2"></div>
                <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-bold text-slate-300 text-[10px] uppercase">TOTAL HPP PER PORSI</span>
                  <span className="text-base font-black text-orange-500">{formatRupiah(totalHppPerUnit)}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 mt-3 space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Total HPP (Satu Resep Penuh):</span>
                  <span className="font-bold text-slate-200">{formatRupiah(totalHppPerUnit * yld)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="font-bold">Total HPP per Gram/ml/Pcs:</span>
                  <span className="font-black text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                    {formatRupiah((totalHppPerUnit * yld) / (totalWeight || 1))}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800 mt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">Target Profit Margin (%)</span>
                  <span className="font-black text-orange-500 text-sm bg-orange-950 px-2 py-0.5 rounded border border-orange-900">{marginPercent}%</span>
                </div>
                <input type="range" min="5" max="95" className="w-full accent-orange-600 cursor-pointer" value={marginPercent} onChange={e => setMarginPercent(Number(e.target.value))} />
                <div className="grid grid-cols-4 gap-1.5">
                  {[20, 35, 50, 70].map(m => <button key={m} onClick={() => setMarginPercent(m)} className={`py-1 rounded text-[10px] font-bold transition-all ${marginPercent === m ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-750'}`}>{m}%</button>)}
                </div>
              </div>

              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800 space-y-1 text-center">
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Rekomendasi Harga Jual</span>
                <span className="block text-xl font-black text-slate-200">{formatRupiah(roundedRecommendedPrice)}</span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Harga Jual Final Restoran</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                  <input type="number" className="w-full p-2.5 pl-9 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-orange-500 text-xs font-bold text-white transition-all" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder={String(roundedRecommendedPrice)} />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2.5">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ANALISA KEUNTUNGAN AKTUAL</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Estimasi Laba / Porsi:</span>
                  <span className={`font-black text-sm ${actualProfitValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRupiah(actualProfitValue)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Profit Margin Aktual:</span>
                  <span className={`font-black text-sm ${actualProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>{actualProfitPercent.toFixed(1)}%</span>
                </div>
              </div>

              <button onClick={handleSaveToLibrary} className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 text-xs">
                <Save className="w-4 h-4" /> {editingRecipe ? 'Simpan Perubahan' : 'Simpan Formula ke Library'}
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 py-16">
              <Calculator className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="font-semibold text-xs text-slate-500">Silakan isi formulir di samping</p>
              <p className="text-[10px] text-slate-400 mt-1">Lalu klik tombol "Hitung HPP Final" untuk melihat analisa harga jual & margin laba aktual.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LibraryHppView = () => {
  const { hppLibrary, setHppLibrary, availableMaterials, categories, triggerConfirm, setEditingRecipe, setActiveTab } = useAppContext();

  const handleDelete = (id) => {
    triggerConfirm('Yakin ingin menghapus resep menu ini dari Library?', () => {
      setHppLibrary(hppLibrary.filter(item => item.id !== id));
    });
  };

  const handleEdit = (recipe) => {
    setEditingRecipe(recipe);
    setActiveTab('calculator'); 
  };

  const libraryWithLiveCalc = useMemo(() => {
    const enriched = hppLibrary.map(recipe => {
      const liveIngredientCost = recipe.ingredients.reduce((sum, ing) => {
        const liveMaterial = availableMaterials.find(rm => rm.id === ing.rawMaterialId);
        const currentPrice = liveMaterial ? liveMaterial.price : ing.snapshotPrice; 
        
        return sum + (currentPrice * ing.qtyUsed);
      }, 0);

      const liveMaterialPerUnit = recipe.yieldQty > 0 ? (liveIngredientCost / recipe.yieldQty) : 0;
      const liveHpp = liveMaterialPerUnit + (recipe.laborCost || 0) + (recipe.overheadCost || 0);
      
      const actualMarginValue = recipe.finalPrice - liveHpp;
      const actualMarginPercent = recipe.finalPrice > 0 ? (actualMarginValue / recipe.finalPrice) * 100 : 0;

      return { ...recipe, liveHpp, actualMarginPercent };
    });

    const groups = {};
    categories.forEach(cat => groups[cat] = []); 
    groups['Uncategorized'] = [];

    enriched.forEach(item => {
      if (groups[item.category]) groups[item.category].push(item);
      else groups['Uncategorized'].push(item);
    });

    return groups;
  }, [hppLibrary, availableMaterials, categories]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="font-heading text-lg font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-600" /> Katalog Library Menu (Final)
        </h3>
        <p className="text-xs text-slate-500 mt-1">Daftar menu dengan total HPP terhitung otomatis berdasarkan harga bahan baku pasar & bahan setengah jadi terbaru.</p>
      </div>

      {hppLibrary.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm p-10 py-16 animate-in zoom-in-95">
          <BookOpen className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium text-slate-500 text-xs">Belum ada resep / menu final yang disimpan ke Library.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...categories, 'Uncategorized'].map(category => {
            const items = libraryWithLiveCalc[category];
            if (!items || items.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-xs font-black text-slate-800 tracking-wider uppercase">{category}</span>
                  <span className="bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-full">{items.length} Menu</span>
                  <div className="h-px bg-slate-200 flex-1 ml-2"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(item => {
                    const isMarginDanger = item.actualMarginPercent < (item.marginPercent / 2);
                    return (
                      <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative group hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[9px] text-slate-400 font-medium">Yield: {item.yieldQty} Porsi</span>
                            <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(item)} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Edit Formula Resep"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(item.id)} className="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          
                          <h4 className="font-heading font-black text-slate-800 text-base leading-tight mb-3">{item.name}</h4>

                          <div className="space-y-2 mb-4">
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-semibold">HPP Aktual</span>
                              <span className="font-black text-slate-800">{formatRupiah(item.liveHpp)}</span>
                            </div>
                            
                            <div className="flex justify-between items-end text-xs p-1">
                              <div>
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Harga Jual</span>
                                <span className="font-black text-orange-600 text-sm">{formatRupiah(item.finalPrice)}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Margin Saat Ini</span>
                                <span className={`font-black text-xs px-1.5 py-0.5 rounded ${isMarginDanger ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                  {item.actualMarginPercent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {isMarginDanger && (
                          <div className="mt-2 pt-2 border-t border-red-100 flex items-start gap-1 text-red-600">
                            <TrendingDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold leading-tight">Margin kritis! Periksa kembali harga bahan baku / prep Anda.</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

const CategoryModal = () => {
  const { categories, setCategories, hppLibrary, setHppLibrary, isCategoryModalOpen, setIsCategoryModalOpen, triggerAlert, triggerConfirm } = useAppContext();
  const [newCat, setNewCat] = useState('');
  const [editIndex, setEditIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');

  if (!isCategoryModalOpen) return null;

  const handleAdd = () => {
    if(!newCat.trim()) return;
    if(categories.some(c => c.toLowerCase() === newCat.trim().toLowerCase())) return triggerAlert('Kategori sudah ada!');
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
  };

  const handleDelete = (cat, idx) => {
    triggerConfirm(`Yakin ingin menghapus kategori "${cat}"? Menu yang menggunakan kategori ini akan masuk ke "Uncategorized".`, () => {
      setCategories(categories.filter((_, i) => i !== idx));
    });
  };

  const startEdit = (cat, idx) => {
    setEditIndex(idx); setEditValue(cat);
  };

  const saveEdit = (oldCat, idx) => {
    if(!editValue.trim() || editValue === oldCat) return setEditIndex(-1);
    if(categories.some((c, i) => i !== idx && c.toLowerCase() === editValue.trim().toLowerCase())) return triggerAlert('Nama kategori sudah digunakan!');

    const newCategories = [...categories];
    newCategories[idx] = editValue.trim();
    setCategories(newCategories);

    const updatedLibrary = hppLibrary.map(recipe => recipe.category === oldCat ? { ...recipe, category: editValue.trim() } : recipe);
    if(JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
    
    setEditIndex(-1);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="font-heading font-bold text-slate-800 text-lg flex items-center gap-2"><Layers className="w-5 h-5 text-orange-600" /> Kelola Kategori Menu</h3>
          <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-lg"><X className="w-4 h-4"/></button>
        </div>

        <div className="flex gap-2 mb-4 shrink-0">
          <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Tambah kategori baru..." className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-600 text-xs font-bold text-slate-700" />
          <button onClick={handleAdd} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"><Plus className="w-4 h-4"/> Tambah</button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 border border-slate-100 rounded-xl bg-slate-50 min-h-[200px]">
          {categories.length === 0 ? (
            <p className="text-center text-xs text-slate-400 p-4 italic mt-4">Belum ada kategori terdaftar.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {categories.map((cat, idx) => (
                <li key={idx} className="flex justify-between items-center p-3 hover:bg-slate-100/50 transition-colors">
                  {editIndex === idx ? (
                    <div className="flex flex-1 gap-2 mr-2">
                      <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(cat, idx)} className="flex-1 p-1.5 bg-white border border-blue-300 rounded-lg outline-none focus:border-blue-500 text-xs font-bold text-slate-700" autoFocus />
                      <button onClick={() => saveEdit(cat, idx)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setEditIndex(-1)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-700">{cat}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(cat, idx)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(cat, idx)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// KOMPONEN UTAMA HPP VIEW (YANG AKAN DIPANGGIL DI APP.JSX)
// =========================================================================

export default function HppView() {
  // Hanya ambil activeTab dari context. Tidak perlu state, sidebar, atau provider lagi.
  const { activeTab, setActiveTab, hppLibrary, editingRecipe, customAlert, setCustomAlert, confirmModal, setConfirmModal } = useAppContext();

  return (
    <div className="flex-1 overflow-hidden relative flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
      
      {/* 1. Baris Tab Navigasi HPP */}
      <div className="flex gap-2 border-b border-slate-200 pt-2 pb-3 mb-6 overflow-x-auto hide-scrollbar shrink-0">
        <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'materials' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'}`}>
          Database Bahan Baku
        </button>
        <button onClick={() => setActiveTab('semi-finished')} className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'semi-finished' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'}`}>
          Bahan Setengah Jadi (Prep)
        </button>
        <button onClick={() => setActiveTab('calculator')} className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'calculator' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'}`}>
          {editingRecipe ? '✏️ Edit Resep Menu' : 'Kalkulator HPP Final'}
        </button>
        <button onClick={() => setActiveTab('library')} className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'library' ? 'bg-slate-800 text-white shadow-sm -translate-y-0.5' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'}`}>
          Library Menu ({hppLibrary.length})
        </button>
      </div>

      {/* 2. Isi Konten Berdasarkan Tab */}
      {activeTab === 'materials' && <BahanBakuView />}
      {activeTab === 'semi-finished' && <BahanSetengahJadiView />}
      {activeTab === 'calculator' && <KalkulatorHppView />}
      {activeTab === 'library' && <LibraryHppView />}

      {/* 3. Modal Kategori (hanya muncul saat dipanggil) */}
      <CategoryModal />

      {/* 4. Alert & Confirm Modal HPP */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-10 h-10 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-6 h-6" /></div>
            <h3 className="font-heading font-bold text-slate-900 text-base mb-1">Berhasil</h3>
            <p className="text-slate-500 text-xs mb-5">{customAlert.message}</p>
            <button onClick={() => setCustomAlert({ isOpen: false, message: '' })} className="w-full py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors text-xs">OK</button>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-5 h-5" /></div>
            <h3 className="font-heading font-bold text-slate-900 text-base mb-1">Konfirmasi</h3>
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 text-xs">Batal</button>
              <button onClick={() => { if (confirmModal.onConfirm) confirmModal.onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 text-xs">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}