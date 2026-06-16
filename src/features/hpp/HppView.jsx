import React, { useState, useMemo, useEffect, createContext, useContext } from 'react';
import { getIngredientCost } from '../../utils/hppUtils';
import { AppContext, useAppContext } from '../../context/AppContext';
import { formatRupiah } from '../../utils/formatters';
import { usePersistState } from '../../hook/usePersistState';
import CategoryModal from '../../components/CategoryModal';
import { INITIAL_CATEGORIES, INITIAL_RAW_MATERIALS } from '../../data/initialData';
import {
    Menu as MenuIcon, X, Plus, Trash2, CheckCircle2, ChevronRight,
    Calculator, PieChart, Save, AlertCircle, Edit3,
    BookOpen, Package, RefreshCw, Clock, Search,
    TrendingUp, TrendingDown, HelpCircle, DollarSign, User, Zap, Beaker
} from 'lucide-react';


// =========================================================================
// TAB 1: DATABASE BAHAN BAKU (RAW MATERIALS)
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h3 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Package className="w-6 h-6 text-orange-600 dark:text-orange-400" /> Database Bahan Baku Pasar
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola acuan harga bahan baku dasar murni dari pasar disini.</p>
                </div>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="bg-orange-600 dark:bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                        <Plus className="w-4 h-4" /> Tambah Bahan Baku
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">{formData.id ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}</h4>
                        <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Nama Bahan Baku</label>
                            <input type="text" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: Ayam Potong" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Satuan Pembelian</label>
                            <input type="text" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="Contoh: Ekor, Kg, Liter, Gram" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Harga Beli Saat Ini (Rp)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">Rp</span>
                                <input type="number" className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm">Batal</button>
                        <button onClick={handleSave} className="px-6 py-2.5 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl shadow-sm hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all duration-300 text-sm"><Save className="w-4 h-4" /> Simpan Bahan</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center">
                    <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-3 mr-2" />
                    <input type="text" placeholder="Cari bahan baku..." className="flex-1 p-2 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 font-bold">Nama Bahan</th>
                                <th className="p-4 font-bold">Satuan</th>
                                <th className="p-4 font-bold">Harga Pasar Saat Ini</th>
                                <th className="p-4 font-bold">Log Update Terakhir</th>
                                <th className="p-4 font-bold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {filteredMaterials.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-400 dark:text-slate-500 italic">Belum ada data bahan baku</td></tr>
                            ) : (
                                filteredMaterials.map((rm) => {
                                    const isUpdatedToday = rm.lastUpdated && new Date(rm.lastUpdated).toDateString() === new Date().toDateString();
                                    return (
                                        <tr key={rm.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors group">
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{rm.name}</td>
                                            <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{rm.unit}</td>
                                            <td className="p-4 font-black text-orange-600 dark:text-orange-400">{formatRupiah(rm.price)}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className={`w-3.5 h-3.5 ${isUpdatedToday ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                                    <span className={`text-xs font-semibold ${isUpdatedToday ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {rm.lastUpdated ? new Date(rm.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <button onClick={() => { setFormData(rm); setIsEditing(true); }} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(rm.id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
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

// =========================================================================
// TAB 1.5: BAHAN SETENGAH JADI (SEMI-FINISHED GOODS / PREP)
// =========================================================================
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

    const livePrepCostPerUnit = (totalIngredientCost + (Number(laborCost) || 0) + (Number(overheadCost) || 0)) / Math.max(1, Number(yieldQty) || 1);

    const filteredPreps = availableMaterials.filter(m => m.isPrep && m.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h3 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Beaker className="w-6 h-6 text-orange-600 dark:text-orange-400" /> Bahan Setengah Jadi (Prep)
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Buat bahan olahan (misal: Bumbu Dasar, Ayam Ungkep) untuk dipakai di Kalkulator HPP.</p>
                </div>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="bg-orange-600 dark:bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-orange-700 dark:hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                        <Plus className="w-4 h-4" /> Tambah Bahan Prep
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in slide-in-from-top-2 duration-300">
                    <div className="lg:col-span-8 space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">{prepId ? 'Edit Bahan Setengah Jadi' : 'Form Bahan Setengah Jadi Baru'}</h4>
                                <button onClick={resetForm} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Nama Prep</label>
                                    <input type="text" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={prepName} onChange={e => setPrepName(e.target.value)} placeholder="Contoh: Bumbu Dasar Merah" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Satuan Hasil</label>
                                    <input type="text" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={resultUnit} onChange={e => setResultUnit(e.target.value)} placeholder="Contoh: Gram, Liter, Porsi" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Jumlah Hasil</label>
                                    <input type="number" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="0" />
                                </div>
                            </div>

                            <div className="pt-4">
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 border-b pb-2">Komposisi Bahan Mentah:</label>

                                <div className="space-y-4 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    {ingredients.map((ing, index) => (
                                        <div key={ing.id} className="grid grid-cols-12 gap-3 items-center border-b border-slate-200 dark:border-slate-700 pb-5 md:pb-0 md:border-none last:border-0 last:pb-0">
                                            <div className="col-span-12 md:col-span-3">
                                                {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Nama Bahan Mentah</label>}
                                                <select
                                                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-medium transition-colors"
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
                                                {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Harga Beli</label>}
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">Rp</span>
                                                        <input type="number" className="w-full p-3 pl-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-600 dark:text-slate-300 font-bold" value={ing.price} readOnly placeholder="Harga" title="Harga dasar dari database" />
                                                    </div>
                                                    <input type="text" className="w-16 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-500 dark:text-slate-400 font-semibold text-center" value={ing.unit} readOnly placeholder="Sat" title="Satuan dasar dari database" />
                                                </div>
                                            </div>

                                            <div className="col-span-6 sm:col-span-2 md:col-span-1">
                                                {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 text-center uppercase">Jumlah</label>}
                                                <input type="number" step="any" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-bold text-center transition-colors" value={ing.qtyUsed} onChange={e => handleIngredientChange(ing.id, 'qtyUsed', e.target.value)} placeholder="1" />
                                            </div>

                                            <div className="col-span-6 sm:col-span-2 md:col-span-2">
                                                {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Satuan Pakai</label>}
                                                <select className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-medium cursor-pointer transition-colors" value={ing.recipeUnit || ing.unit} onChange={e => handleIngredientChange(ing.id, 'recipeUnit', e.target.value)}>
                                                    <option value={ing.unit}>{ing.unit || 'Satuan'}</option>
                                                    {ing.unit?.toLowerCase() === 'kg' && <option value="Gram">Gram</option>}
                                                    {ing.unit?.toLowerCase() === 'liter' && <option value="ml">ml</option>}
                                                    {ing.unit?.toLowerCase() === 'ekor' && <option value="Potong">Potong</option>}
                                                    <option value="Gram">Gram</option><option value="ml">ml</option><option value="Pcs">Pcs</option><option value="Sdm">Sdm</option><option value="Sdt">Sdt</option>
                                                </select>
                                            </div>

                                            <div className="col-span-10 sm:col-span-3 md:col-span-2">
                                                {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 text-center uppercase">Biaya</label>}
                                                <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl text-sm text-orange-700 dark:text-orange-300 font-bold text-center truncate">
                                                    {formatRupiah(getIngredientCost(ing))}
                                                </div>
                                            </div>

                                            <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-6' : ''}`}>
                                                <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Hapus Bahan"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 flex justify-center md:justify-start">
                                    <button onClick={handleAddIngredient} className="flex items-center gap-2 px-5 py-2.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 text-sm font-bold rounded-xl transition-all duration-200">
                                        <Plus className="w-4 h-4" /> Tambah Bahan Mentah
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Total Biaya Tenaga Kerja (1 Resep Prep)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">Rp</span>
                                        <input type="number" className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors" value={laborCost} onChange={e => setLaborCost(e.target.value)} placeholder="0" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Total Biaya Overhead Gas/Dll (1 Resep Prep)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">Rp</span>
                                        <input type="number" className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors" value={overheadCost} onChange={e => setOverheadCost(e.target.value)} placeholder="0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 dark:border-slate-100 p-6 text-white space-y-6">
                        <h4 className="font-heading font-black text-lg text-slate-100 dark:text-slate-800 border-b border-slate-800 dark:border-slate-100 pb-3">SIMULASI HPP PREP</h4>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-slate-400 dark:text-slate-500">
                                <span>Total Biaya Bahan Baku:</span>
                                <span className="font-bold text-slate-100 dark:text-slate-800">{formatRupiah(totalIngredientCost)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 dark:text-slate-500">
                                <span>Total Biaya Produksi:</span>
                                <span className="font-bold text-slate-100 dark:text-slate-800">{formatRupiah(Number(laborCost) + Number(overheadCost))}</span>
                            </div>
                            <div className="h-px bg-slate-800 my-3"></div>
                            <div className="flex justify-between items-center text-slate-300 dark:text-slate-600">
                                <span>Total Keseluruhan (1 Batch):</span>
                                <span className="font-bold text-orange-400 dark:text-orange-300">{formatRupiah(totalIngredientCost + Number(laborCost) + Number(overheadCost))}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300 dark:text-slate-600">
                                <span>Menghasilkan (Yield):</span>
                                <span className="font-bold text-orange-400 dark:text-orange-300 bg-orange-950 dark:bg-orange-950/50 px-2 py-0.5 rounded border border-orange-900 dark:border-orange-500/40">{yieldQty || 0} {resultUnit || 'Unit'}</span>
                            </div>
                        </div>

                        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 dark:border-slate-300 text-center mt-6">
                            <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">HPP Prep per {resultUnit || 'Satuan'}</span>
                            <span className="block text-3xl font-heading font-black text-green-400 dark:text-green-400">{formatRupiah(livePrepCostPerUnit)}</span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic mt-4">Bahan Prep ini akan muncul di dropdown tab Kalkulator HPP secara otomatis.</p>

                        <button onClick={handleSave} className="w-full py-4 mt-6 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-sm">
                            <Save className="w-5 h-5" /> {prepId ? 'Update Bahan Prep' : 'Simpan Bahan Prep'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center mb-5">
                        <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-3 mr-2" />
                        <input type="text" placeholder="Cari bahan setengah jadi..." className="flex-1 p-2 outline-none text-sm font-medium text-slate-800 dark:text-slate-100 bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="p-4 font-bold">Nama Bahan Prep</th>
                                        <th className="p-4 font-bold">Satuan Hasil</th>
                                        <th className="p-4 font-bold">HPP Live per Satuan</th>
                                        <th className="p-4 font-bold">Log Update</th>
                                        <th className="p-4 font-bold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {filteredPreps.length === 0 ? (
                                        <tr><td colSpan="5" className="p-8 text-center text-slate-400 dark:text-slate-500 italic">Belum ada data bahan setengah jadi</td></tr>
                                    ) : (
                                        filteredPreps.map((prep) => {
                                            const originalPrep = semiFinished.find(s => s.id === prep.id);
                                            return (
                                                <tr key={prep.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors group">
                                                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{prep.name.replace(' [Prep]', '')} <span className="bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2">PREP</span></td>
                                                    <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{prep.unit}</td>
                                                    <td className="p-4 font-black text-green-600 dark:text-green-400">{formatRupiah(prep.price)}</td>
                                                    <td className="p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                                        {prep.lastUpdated ? new Date(prep.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                    </td>
                                                    <td className="p-4 flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <button onClick={() => handleEdit(originalPrep)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDelete(prep.id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
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

// =========================================================================
// TAB 2: KALKULATOR HPP (COGS CALCULATOR)
// =========================================================================
const KalkulatorHppView = () => {
    const {
        availableMaterials,
        hppLibrary, setHppLibrary,
        categories, setIsCategoryModalOpen,
        triggerAlert, triggerConfirm,
        editingRecipe, setEditingRecipe, setActiveTab
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

            const isWeightOrVolume = ['kg', 'gram', 'g', 'liter', 'l', 'ml', 'mili', 'sdm', 'sdt'].includes(unit);
            if (!isWeightOrVolume) return sum;

            if (unit === 'kg' || unit === 'liter' || unit === 'l') qty *= 1000;
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
            handleReset();
            setActiveTab('library');
        } else {
            const isDuplicate = hppLibrary.some(item => item.name.toLowerCase() === productName.toLowerCase());
            if (isDuplicate) {
                triggerConfirm(`Menu dengan nama "${productName}" sudah ada. Timpa dengan hitungan baru?`, () => {
                    setHppLibrary(hppLibrary.map(item => item.name.toLowerCase() === productName.toLowerCase() ? { ...newRecipe, id: item.id } : item));
                    triggerAlert(`Resep "${productName}" berhasil di-update!`);
                    handleReset();
                    setActiveTab('library');
                });
            } else {
                setHppLibrary([...hppLibrary, newRecipe]);
                triggerAlert(`Resep "${productName}" berhasil disimpan ke Library!`);
                handleReset();
                setActiveTab('library');
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">Informasi Produk</h4>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Nama Produk Final</label>
                                <input type="text" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Contoh: Es Teh, Nasi Goreng, Bakso" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">Kategori</label>
                                    <button onClick={() => setIsCategoryModalOpen(true)} className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                                        <Edit3 className="w-3.5 h-3.5" /> Kelola Kategori
                                    </button>
                                </div>
                                <select className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors cursor-pointer" value={category} onChange={e => setCategory(e.target.value)}>
                                    {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                    {!categories.includes(category) && category && <option value={category}>{category}</option>}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                            <span>🛒</span> Komposisi Bahan & Satuan Pakai
                        </h4>

                        <div className="space-y-4">
                            {ingredients.map((ing, index) => (
                                <div key={ing.id} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2 duration-300 border-b border-slate-100 dark:border-slate-800 pb-4 md:pb-0 md:border-none">
                                    <div className="col-span-12 md:col-span-3">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Nama Bahan</label>}
                                        <select
                                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-medium transition-colors"
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
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Harga & Satuan</label>}
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">Rp</span>
                                                <input type="number" className="w-full p-3 pl-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-600 dark:text-slate-300 font-bold" value={ing.price} readOnly placeholder="Harga" />
                                            </div>
                                            <input type="text" className="w-16 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-500 dark:text-slate-400 font-semibold text-center" value={ing.unit} readOnly placeholder="Sat" />
                                        </div>
                                    </div>

                                    <div className="col-span-6 sm:col-span-2 md:col-span-1">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 text-center uppercase">Jumlah</label>}
                                        <input type="number" step="any" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-bold text-center transition-colors" value={ing.qtyUsed} onChange={e => handleIngredientChange(ing.id, 'qtyUsed', e.target.value)} placeholder="1" />
                                    </div>

                                    <div className="col-span-6 sm:col-span-2 md:col-span-2">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Satuan Pakai</label>}
                                        <select className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm text-slate-800 dark:text-slate-100 font-medium cursor-pointer transition-colors" value={ing.recipeUnit || ing.unit} onChange={e => handleIngredientChange(ing.id, 'recipeUnit', e.target.value)}>
                                            <option value={ing.unit}>{ing.unit || 'Satuan'}</option>
                                            {ing.unit?.toLowerCase() === 'kg' && <option value="Gram">Gram</option>}
                                            {ing.unit?.toLowerCase() === 'liter' && <option value="ml">ml</option>}
                                            {ing.unit?.toLowerCase() === 'ekor' && <option value="Potong">Potong</option>}
                                            <option value="Gram">Gram</option><option value="ml">ml</option><option value="Pcs">Pcs</option><option value="Sdm">Sdm</option><option value="Sdt">Sdt</option>
                                        </select>
                                    </div>

                                    <div className="col-span-10 sm:col-span-3 md:col-span-2">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 text-center uppercase">Biaya Komposisi</label>}
                                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl text-sm text-orange-700 dark:text-orange-300 font-bold text-center truncate">{formatRupiah(getIngredientCost(ing))}</div>
                                    </div>

                                    <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-8' : ''}`}>
                                        <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center md:justify-start pt-2">
                            <button onClick={handleAddIngredient} className="flex items-center gap-2 px-5 py-2.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 text-sm font-bold rounded-xl transition-all duration-200"><Plus className="w-4 h-4" /> Tambah Komposisi</button>
                        </div>

                        <div className="bg-orange-50 dark:bg-orange-500/10 p-5 rounded-2xl border border-orange-200 dark:border-orange-500/30 flex flex-col gap-3 text-sm mt-5">
                            <div className="flex justify-between items-center border-b border-orange-200 dark:border-orange-500/60 pb-3">
                                <span className="text-orange-800 dark:text-orange-300 font-bold">Total Estimasi Berat / Volume:</span>
                                <span className="text-base font-black text-orange-900 dark:text-orange-200">{totalWeight} <span className="text-xs text-orange-800 dark:text-orange-300 font-bold">Gram/ml</span></span>
                            </div>
                            <div className="flex justify-between items-center border-b border-orange-200 dark:border-orange-500/60 pb-3">
                                <span className="text-orange-800 dark:text-orange-300 font-bold">Total Biaya Komposisi Bahan (Murni):</span>
                                <span className="text-base font-black text-orange-900 dark:text-orange-200">{formatRupiah(totalIngredientCost)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-orange-900 dark:text-orange-200 font-black">HPP Bahan per Gram/ml:</span>
                                <span className="text-base font-black text-orange-600 dark:text-orange-400">{formatRupiah(totalWeight > 0 ? totalIngredientCost / totalWeight : 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2"><span>📦</span> Jumlah Produk yang Dihasilkan</h4>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Jumlah Produk (Unit)</label>
                            <input type="number" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-orange-600 dark:focus:border-orange-500 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="Contoh: 10, 50, 100" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button onClick={handleCalculate} className="flex-1 py-3.5 bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"><Calculator className="w-5 h-5" /> Hitung HPP Final</button>
                        <button onClick={handleReset} className="py-3.5 px-8 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">Reset</button>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
                    {showResult ? (
                        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 dark:border-slate-100 p-6 text-white space-y-6 animate-in zoom-in-95 duration-300 ease-out">
                            <div className="border-b border-slate-800 dark:border-slate-100 pb-4 flex justify-between items-center">
                                <div>
                                    <h4 className="font-heading font-black text-lg text-slate-100 dark:text-slate-800 tracking-wider">HASIL ANALISA & HARGA JUAL</h4>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Atur simulasi margin & harga akhir toko Anda.</p>
                                </div>
                                <HelpCircle className="w-5 h-5 text-slate-400 dark:text-slate-500 cursor-help" />
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-slate-400 dark:text-slate-500">
                                    <span>Bahan / Porsi:</span>
                                    <span className="font-bold text-slate-100 dark:text-slate-800">{formatRupiah(materialCostPerUnit)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 dark:text-slate-500">
                                    <span>Tenaga Kerja / Porsi:</span>
                                    <span className="font-bold text-slate-100 dark:text-slate-800">{formatRupiah(lbrCost)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 dark:text-slate-500">
                                    <span>Overhead / Kemasan:</span>
                                    <span className="font-bold text-slate-100 dark:text-slate-800">{formatRupiah(ovhCost)}</span>
                                </div>
                                <div className="h-px bg-slate-800 my-3"></div>
                                <div className="flex justify-between items-center bg-slate-800/60 p-3 rounded-xl border border-slate-700 dark:border-slate-300">
                                    <span className="font-bold text-slate-300 dark:text-slate-600 text-xs uppercase tracking-wider">TOTAL HPP PER PORSI</span>
                                    <span className="text-lg font-black text-orange-400 dark:text-orange-300">{formatRupiah(totalHppPerUnit)}</span>
                                </div>
                            </div>

                            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 dark:border-slate-300 mt-4 space-y-3">
                                <div className="flex justify-between items-center text-sm text-slate-400 dark:text-slate-500">
                                    <span>Total HPP (Satu Resep Penuh):</span>
                                    <span className="font-bold text-slate-200 dark:text-slate-700">{formatRupiah(totalHppPerUnit * yld)}</span>
                                </div>
                                {totalWeight > 0 && (
                                    <div className="flex justify-between items-center text-sm text-slate-300 dark:text-slate-600 pt-2 border-t border-slate-700 dark:border-slate-300">
                                        <span className="font-bold">Total HPP per Gram/ml:</span>
                                        <span className="font-black text-orange-400 dark:text-orange-300 bg-orange-950 dark:bg-orange-950/50 px-2 py-1 rounded-md border border-orange-900 dark:border-orange-500/50">
                                            {formatRupiah((totalHppPerUnit * yld) / totalWeight)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800 dark:border-slate-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-300 dark:text-slate-600">Target Profit Margin (%)</span>
                                    <span className="font-black text-orange-400 dark:text-orange-300 text-base bg-orange-950 dark:bg-orange-950/50 px-3 py-1 rounded-lg border border-orange-900 dark:border-orange-500/50">{marginPercent}%</span>
                                </div>
                                <input type="range" min="5" max="95" className="w-full accent-orange-600 cursor-pointer h-2 bg-slate-700 dark:bg-slate-300 rounded-lg appearance-none" value={marginPercent} onChange={e => setMarginPercent(Number(e.target.value))} />
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {[20, 35, 50, 70].map(m => <button key={m} onClick={() => setMarginPercent(m)} className={`py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${marginPercent === m ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-md' : 'bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-700 hover:text-white dark:hover:text-slate-900'}`}>{m}%</button>)}
                                </div>
                            </div>

                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 dark:border-slate-300 space-y-2 text-center mt-6">
                                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Rekomendasi Harga Jual</span>
                                <span className="block text-3xl font-heading font-black text-slate-100 dark:text-slate-800">{formatRupiah(roundedRecommendedPrice)}</span>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-800 dark:border-slate-100">
                                <label className="block text-xs font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">Harga Jual Final Restoran</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">Rp</span>
                                    <input type="number" className="w-full p-4 pl-12 bg-slate-800 border border-slate-700 dark:border-slate-300 rounded-xl outline-none focus:border-orange-500 dark:focus:border-orange-500 text-base font-bold text-white transition-all shadow-inner" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder={String(roundedRecommendedPrice)} />
                                </div>
                            </div>

                            <div className="bg-slate-950 dark:bg-black p-5 rounded-2xl border border-slate-800 dark:border-slate-100 space-y-3 mt-4">
                                <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center mb-4">ANALISA KEUNTUNGAN AKTUAL</span>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium">Estimasi Laba / Porsi:</span>
                                    <span className={`font-black text-base ${actualProfitValue >= 0 ? 'text-green-400 dark:text-green-400' : 'text-red-400 dark:text-red-400'}`}>{formatRupiah(actualProfitValue)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium">Profit Margin Aktual:</span>
                                    <span className={`font-black text-base px-2 py-0.5 rounded-md ${actualProfitPercent >= 0 ? 'bg-green-950 dark:bg-green-950/30 text-green-400 dark:text-green-400' : 'bg-red-950 dark:bg-red-950/30 text-red-400 dark:text-red-400'}`}>{actualProfitPercent.toFixed(1)}%</span>
                                </div>
                            </div>

                            <button onClick={handleSaveToLibrary} className="w-full py-4 mt-6 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white font-bold text-base rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                <Save className="w-5 h-5" /> {editingRecipe ? 'Simpan Perubahan' : 'Simpan Formula ke Library'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500 py-24 animate-in fade-in duration-300">
                            <Calculator className="w-16 h-16 mx-auto opacity-20 mb-4" />
                            <p className="font-heading font-bold text-base text-slate-500 dark:text-slate-400">Silakan isi formulir di samping</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Lalu klik tombol "Hitung HPP Final" untuk melihat analisa harga jual & margin laba aktual.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// TAB 3: LIBRARY HPP (COGS LIBRARY)
// =========================================================================
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-5">
                <h3 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-orange-600 dark:text-orange-400" /> Katalog Library Menu (Final)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Daftar menu dengan total HPP terhitung otomatis berdasarkan harga bahan baku pasar & bahan setengah jadi terbaru.</p>
            </div>

            {hppLibrary.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm p-12 py-24 animate-in zoom-in-95 duration-300">
                    <BookOpen className="w-16 h-16 mb-4 opacity-20 text-slate-500 dark:text-slate-400" />
                    <p className="font-heading font-bold text-slate-500 dark:text-slate-400 text-base">Belum ada resep / menu final yang disimpan ke Library.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {[...categories, 'Uncategorized'].map(category => {
                        const items = libraryWithLiveCalc[category];
                        if (!items || items.length === 0) return null;

                        return (
                            <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <span className="font-heading text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{category}</span>
                                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full">{items.length} Menu</span>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1 ml-2"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {items.map(item => {
                                        const isMarginDanger = item.actualMarginPercent < (item.marginPercent / 2);
                                        return (
                                            <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 relative group hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yield: {item.yieldQty} Porsi</span>
                                                        <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                            <button onClick={() => handleEdit(item)} className="p-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors" title="Edit Formula Resep"><Edit3 className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>

                                                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight mb-4 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{item.name}</h4>

                                                    <div className="space-y-3 mb-5">
                                                        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm">
                                                            <span className="text-slate-500 dark:text-slate-400 font-bold">HPP Aktual</span>
                                                            <span className="font-black text-slate-800 dark:text-slate-100">{formatRupiah(item.liveHpp)}</span>
                                                        </div>

                                                        <div className="flex justify-between items-end text-sm p-1">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Harga Jual</span>
                                                                <span className="font-black text-orange-600 dark:text-orange-400 text-base">{formatRupiah(item.finalPrice)}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Margin Saat Ini</span>
                                                                <span className={`font-black text-sm px-2 py-1 rounded-md ${isMarginDanger ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'}`}>
                                                                    {item.actualMarginPercent.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isMarginDanger && (
                                                    <div className="mt-2 pt-3 border-t border-red-100 dark:border-red-500/20 flex items-start gap-2 text-red-600 dark:text-red-400">
                                                        <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <p className="text-[11px] font-bold leading-relaxed">Margin kritis! Periksa kembali harga bahan baku / prep Anda.</p>
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

// =========================================================================
// MODAL KELOLA KATEGORI
// =========================================================================
// =========================================================================
// MAIN APP ROOT
// =========================================================================
export default function App() {
    const [activeTab, setActiveTab] = useState('materials');

    // Ambil categories dari outer AppContext (App.jsx) agar tidak duplikat state
    // dan perubahan dari MenuMgmt langsung sinkron di sini juga
    const {
        categories,
        setCategories,
        menus,
        setMenus,
        hppLibrary: outerHppLibrary,
        setHppLibrary: setOuterHppLibrary,
    } = useAppContext();

    // Database States yang masih dikelola lokal (rawMaterials & semiFinished
    // dipakai untuk kalkulasi live di dalam HppView)
    const [rawMaterials, setRawMaterials] = usePersistState('rawMaterials', INITIAL_RAW_MATERIALS, { syncMode: 'config' });
    const [semiFinished, setSemiFinished] = usePersistState('semiFinished', [], { syncMode: 'config' });
    // hppLibrary: gunakan yang dari outer context agar sinkron dengan fitur lain
    const hppLibrary = outerHppLibrary;
    const setHppLibrary = setOuterHppLibrary;
    const [editingRecipe, setEditingRecipe] = useState(null);

    // Modals
    const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);


    const triggerAlert = (message) => setCustomAlert({ isOpen: true, message });
    const triggerConfirm = (message, onConfirm) => setConfirmModal({ isOpen: true, message, onConfirm });

    // LIVE MATERIALS POOL (RAW + PREP)
    const availableMaterials = useMemo(() => {
        const prepsAsMaterials = semiFinished.map(prep => {
            const totalIngCost = prep.ingredients.reduce((sum, ing) => {
                const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
                const currentPrice = rm ? rm.price : (ing.snapshotPrice || 0);
                return sum + (currentPrice * ing.qtyUsedFraction);
            }, 0);

            const totalBatchCost = totalIngCost + (Number(prep.laborCost) || 0) + (Number(prep.overheadCost) || 0);
            const costPerUnit = totalBatchCost / Math.max(1, Number(prep.yieldQty) || 1);

            return {
                id: prep.id,
                name: `${prep.name} [Prep]`,
                unit: prep.resultUnit,
                price: costPerUnit,
                isPrep: true,
                lastUpdated: prep.lastUpdated || new Date()
            };
        });

        return [...rawMaterials, ...prepsAsMaterials];
    }, [rawMaterials, semiFinished]);

    const contextValue = {
        rawMaterials, setRawMaterials,
        semiFinished, setSemiFinished,
        availableMaterials,
        hppLibrary, setHppLibrary,
        categories, setCategories,
        isCategoryModalOpen, setIsCategoryModalOpen,
        editingRecipe, setEditingRecipe,
        activeTab, setActiveTab,
        triggerAlert, triggerConfirm
    };

    return (
        <AppContext.Provider value={contextValue}>
            <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-slate-950 font-body text-slate-800 dark:text-slate-100">
                {/* Main Content */}
                <div className="flex-1 overflow-hidden relative flex flex-col p-4 md:p-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
                    {/* Header Bagian Internal */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Kalkulator HPP Cerdas
                        </h2>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pt-2 pb-5 mb-8 overflow-x-auto hide-scrollbar shrink-0">
                        <button onClick={() => setActiveTab('materials')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'materials' ? 'bg-slate-800 text-white shadow-md -translate-y-0.5' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                            Database Bahan Baku
                        </button>
                        <button onClick={() => setActiveTab('semi-finished')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'semi-finished' ? 'bg-slate-800 text-white shadow-md -translate-y-0.5' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                            Bahan Setengah Jadi (Prep)
                        </button>
                        <button onClick={() => setActiveTab('calculator')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'calculator' ? 'bg-slate-800 text-white shadow-md -translate-y-0.5' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                            {editingRecipe ? '✏️ Edit Resep Menu' : 'Kalkulator HPP Final'}
                        </button>
                        <button onClick={() => setActiveTab('library')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'library' ? 'bg-slate-800 text-white shadow-md -translate-y-0.5' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                            Library Menu ({hppLibrary.length})
                        </button>
                    </div>

                    {/* View Switcher */}
                    {activeTab === 'materials' && <BahanBakuView />}
                    {activeTab === 'semi-finished' && <BahanSetengahJadiView />}
                    {activeTab === 'calculator' && <KalkulatorHppView />}
                    {activeTab === 'library' && <LibraryHppView />}
                </div>

                {/* Modals Alert & Confirm */}
                {customAlert.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black backdrop-blur-sm transition-opacity duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
                            <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><CheckCircle2 className="w-6 h-6" /></div>
                            <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Pemberitahuan</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{customAlert.message}</p>
                            <button onClick={() => setCustomAlert({ isOpen: false, message: '' })} className="w-full py-3 bg-orange-600 dark:bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors shadow-sm text-sm">Tutup</button>
                        </div>
                    </div>
                )}

                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black backdrop-blur-sm transition-opacity duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300 ease-out">
                            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><AlertCircle className="w-6 h-6" /></div>
                            <h3 className="font-heading font-bold text-slate-900 dark:text-slate-50 text-lg mb-2">Konfirmasi Tindakan</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm">Batal</button>
                                <button onClick={() => { if (confirmModal.onConfirm) confirmModal.onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-3 bg-red-500 dark:bg-red-600 text-white font-bold rounded-xl hover:bg-red-600 dark:hover:bg-red-500 shadow-sm transition-colors text-sm">Ya, Lanjutkan</button>
                            </div>
                        </div>
                    </div>
                )}

                <CategoryModal
                    isOpen={isCategoryModalOpen}
                    onClose={() => setIsCategoryModalOpen(false)}
                    title="Kelola Kategori Menu"
                    categories={categories}
                    setCategories={setCategories}
                    triggerAlert={triggerAlert}
                    triggerConfirm={triggerConfirm}
                    onRename={(oldCat, newCat) => {
                        // Update hppLibrary
                        const updatedLibrary = hppLibrary.map(recipe => recipe.category === oldCat ? { ...recipe, category: newCat } : recipe);
                        if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
                        // Update menus (sinkron dengan MenuMgmt)
                        if (menus && setMenus) {
                            const updatedMenus = menus.map(m => m.category === oldCat ? { ...m, category: newCat } : m);
                            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
                        }
                    }}
                    onDelete={(deletedCat) => {
                        const updatedLibrary = hppLibrary.map(recipe => recipe.category === deletedCat ? { ...recipe, category: 'Umum' } : recipe);
                        if (JSON.stringify(updatedLibrary) !== JSON.stringify(hppLibrary)) setHppLibrary(updatedLibrary);
                        if (menus && setMenus) {
                            const updatedMenus = menus.map(m => m.category === deletedCat ? { ...m, category: 'Umum' } : m);
                            if (JSON.stringify(updatedMenus) !== JSON.stringify(menus)) setMenus(updatedMenus);
                        }
                    }}
                />
            </div>
        </AppContext.Provider>
    );
}