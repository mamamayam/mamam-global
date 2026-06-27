import React, { useState, useMemo } from 'react';
import { getIngredientCost } from '../../../utils/hppUtils';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, IconButton, PageHeader, EmptyState, Input, Badge } from '../../../components/ui';
import { Beaker, Plus, X, Search, Edit3, Trash2, Save } from 'lucide-react';

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
            <PageHeader
                title="Bahan Setengah Jadi (Prep)"
                subtitle="Buat bahan olahan (misal: Bumbu Dasar, Ayam Ungkep) untuk dipakai di Kalkulator HPP."
                icon={<Beaker className="w-6 h-6 text-accent-600 dark:text-accent-400" />}
                className="mb-2"
                action={!isEditing && (
                    <Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsEditing(true)}>
                        Tambah Bahan Prep
                    </Button>
                )}
            />

            {isEditing ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in slide-in-from-top-2 duration-300">
                    <div className="lg:col-span-8 space-y-4">
                        <Card padding="lg" className="space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">{prepId ? 'Edit Bahan Setengah Jadi' : 'Form Bahan Setengah Jadi Baru'}</h4>
                                <IconButton variant="neutral" className="rounded-full" onClick={resetForm}><X className="w-5 h-5" /></IconButton>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <Input
                                    label="Nama Prep"
                                    type="text"
                                    value={prepName}
                                    onChange={e => setPrepName(e.target.value)}
                                    placeholder="Contoh: Bumbu Dasar Merah"
                                />
                                <Input
                                    label="Satuan Hasil"
                                    type="text"
                                    value={resultUnit}
                                    onChange={e => setResultUnit(e.target.value)}
                                    placeholder="Contoh: Gram, Liter, Porsi"
                                />
                                <Input
                                    label="Jumlah Hasil"
                                    type="number"
                                    value={yieldQty}
                                    onChange={e => setYieldQty(e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            <div className="pt-4">
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 border-b pb-2">Komposisi Bahan Mentah:</label>

                                <Card variant="muted" padding="lg" className="space-y-4">
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
                                                <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl text-sm text-accent-700 dark:text-accent-300 font-bold text-center truncate">
                                                    {formatRupiah(getIngredientCost(ing))}
                                                </div>
                                            </div>

                                            <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-6' : ''}`}>
                                                <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-xl transition-colors" title="Hapus Bahan"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </Card>

                                <div className="mt-5 flex justify-center md:justify-start">
                                    <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={handleAddIngredient}>
                                        Tambah Bahan Mentah
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <Input
                                    label="Total Biaya Tenaga Kerja (1 Resep Prep)"
                                    type="number"
                                    icon={<span className="font-bold">Rp</span>}
                                    value={laborCost}
                                    onChange={e => setLaborCost(e.target.value)}
                                    placeholder="0"
                                />
                                <Input
                                    label="Total Biaya Overhead Gas/Dll (1 Resep Prep)"
                                    type="number"
                                    icon={<span className="font-bold">Rp</span>}
                                    value={overheadCost}
                                    onChange={e => setOverheadCost(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </Card>
                    </div>

                    <Card variant="dark-elevated" padding="lg" className="lg:col-span-4 space-y-6">
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
                                <span className="font-bold text-accent-400 dark:text-accent-300">{formatRupiah(totalIngredientCost + Number(laborCost) + Number(overheadCost))}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300 dark:text-slate-600">
                                <span>Menghasilkan (Yield):</span>
                                <span className="font-bold text-accent-400 dark:text-accent-300 bg-accent-950 dark:bg-accent-950/50 px-2 py-0.5 rounded border border-orange-900 dark:border-orange-500/40">{yieldQty || 0} {resultUnit || 'Unit'}</span>
                            </div>
                        </div>

                        <Card variant="dark-muted" padding="lg" className="text-center mt-6">
                            <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">HPP Prep per {resultUnit || 'Satuan'}</span>
                            <span className="block text-3xl font-heading font-black text-green-400 dark:text-green-400">{formatRupiah(livePrepCostPerUnit)}</span>
                        </Card>

                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic mt-4">Bahan Prep ini akan muncul di dropdown tab Kalkulator HPP secara otomatis.</p>

                        <Button variant="success" size="full" className="mt-6" icon={<Save className="w-5 h-5" />} onClick={handleSave}>
                            {prepId ? 'Update Bahan Prep' : 'Simpan Bahan Prep'}
                        </Button>
                    </Card>
                </div>
            ) : (
                <>
                    <div className="relative w-full sm:w-72 mb-5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Cari bahan setengah jadi..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-500 transition-all text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                aria-label="Hapus pencarian"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <Card padding="none" className="overflow-hidden">
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
                                        <tr><td colSpan="5"><EmptyState size="sm" title="Belum ada data bahan setengah jadi" /></td></tr>
                                    ) : (
                                        filteredPreps.map((prep) => {
                                            const originalPrep = semiFinished.find(s => s.id === prep.id);
                                            return (
                                                <tr key={prep.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors group">
                                                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">{prep.name.replace(' [Prep]', '')} <Badge variant="orange" size="sm" className="ml-2">PREP</Badge></td>
                                                    <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{prep.unit}</td>
                                                    <td className="p-4 font-black text-green-600 dark:text-green-400">{formatRupiah(prep.price)}</td>
                                                    <td className="p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                                        {prep.lastUpdated ? new Date(prep.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                    </td>
                                                    <td className="p-4 flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <IconButton variant="edit" ghost onClick={() => handleEdit(originalPrep)}><Edit3 className="w-4 h-4" /></IconButton>
                                                        <IconButton variant="delete" ghost onClick={() => handleDelete(prep.id)}><Trash2 className="w-4 h-4" /></IconButton>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default BahanSetengahJadiView;