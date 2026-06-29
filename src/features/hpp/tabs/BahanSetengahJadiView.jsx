import React, { useState, useMemo } from 'react';
import { getIngredientCost } from '../../../utils/hppUtils';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, IconButton, PageHeader, EmptyState, Input, Badge, SortModal } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { markDeleted, activeOnly } from '../../../utils/softDelete';
import { Beaker, Plus, X, Search, Edit3, Trash2, Save, ArrowUpDown } from 'lucide-react';

const BahanSetengahJadiView = () => {
    const { rawMaterials, semiFinished, setSemiFinished, triggerAlert, triggerConfirm, availableMaterials } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('name-asc');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const [prepId, setPrepId] = useState('');
    const [prepName, setPrepName] = useState('');
    const [resultUnit, setResultUnit] = useState('');
    const [yieldQty, setYieldQty] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [overheadCost, setOverheadCost] = useState('');
    const [ingredients, setIngredients] = useState([{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);

    const sortOptions = [
        { key: 'name-asc', label: 'Nama Prep (A-Z)' },
        { key: 'name-desc', label: 'Nama Prep (Z-A)' },
        { key: 'price-desc', label: 'HPP Live Tertinggi' },
        { key: 'price-asc', label: 'HPP Live Terendah' },
        { key: 'lastUpdated-desc', label: 'Baru Diupdate' },
        { key: 'lastUpdated-asc', label: 'Lama Diupdate' },
    ];

    const handleAddIngredient = () => setIngredients([...ingredients, { id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
    const handleRemoveIngredient = (id) => setIngredients(ingredients.length > 1 ? ingredients.filter(ing => ing.id !== id) : [{ id: Date.now(), name: '', unit: '', price: '', qtyUsed: '1', recipeUnit: '' }]);
    const handleIngredientChange = (id, field, value) => setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));

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
        setPrepId(''); setPrepName(''); setResultUnit(''); setYieldQty(''); setLaborCost(''); setOverheadCost('');
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
                return {
                    rawMaterialId: match ? match.id : `rm-custom-${Date.now()}`,
                    qtyUsedFraction: basePrice > 0 ? (cost / basePrice) : 0,
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
        triggerConfirm('Yakin ingin memindahkan bahan prep ini ke Recycle Bin? Kalkulasi HPP mungkin terpengaruh.', () => {
            setSemiFinished(semiFinished.map(sf => sf.id === id ? markDeleted(sf) : sf));
        });
    };

    const totalIngredientCost = useMemo(() => ingredients.reduce((sum, item) => sum + getIngredientCost(item), 0), [ingredients]);
    const livePrepCostPerUnit = (totalIngredientCost + (Number(laborCost) || 0) + (Number(overheadCost) || 0)) / Math.max(1, Number(yieldQty) || 1);

    const activeRawMaterials = activeOnly(rawMaterials);
    const activePreps = activeOnly(availableMaterials);
    const filteredPreps = activePreps.filter(m => m.isPrep && m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const sortedPreps = applySort(filteredPreps, sortKey, {
        name: prep => (prep.name || '').replace(' [Prep]', ''),
        price: prep => prep.price || 0,
        lastUpdated: prep => prep.lastUpdated ? new Date(prep.lastUpdated) : new Date(0),
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <PageHeader
                title="Bahan Setengah Jadi (Prep)"
                subtitle="Buat bahan olahan (misal: Bumbu Dasar, Ayam Ungkep) untuk dipakai di Kalkulator HPP."
                icon={<Beaker className="w-6 h-6 text-accent-600 dark:text-accent-400" />}
                className="mb-2"
                action={
                    <Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsEditing(true)}>
                        Tambah Bahan Prep
                    </Button>
                }
            />

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Cari bahan setengah jadi..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsSortOpen(true)}
                    className="w-full sm:w-48 flex items-center justify-between gap-2 pl-4 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 transition-colors text-sm bg-white dark:bg-slate-900"
                >
                    <span className="truncate">{sortOptions.find(o => o.key === sortKey)?.label || 'Urutkan'}</span>
                    <ArrowUpDown className="text-slate-400 w-4 h-4 shrink-0" />
                </button>
            </div>

            <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 font-bold">Nama Bahan Prep</th>
                                <th className="p-4 font-bold">Satuan Hasil</th>
                                <th className="p-4 font-bold">HPP Live per Satuan</th>
                                <th className="p-4 font-bold">Log Update</th>
                                <th className="p-4 font-bold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {sortedPreps.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState size="sm" title="Belum ada data bahan setengah jadi" /></td></tr>
                            ) : (
                                sortedPreps.map((prep) => {
                                    const originalPrep = semiFinished.find(s => s.id === prep.id);
                                    return (
                                        <tr key={prep.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors group">
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-100 group-hover:text-accent-600 transition-colors">{prep.name.replace(' [Prep]', '')} <Badge variant="orange" size="sm" className="ml-2">PREP</Badge></td>
                                            <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{prep.unit}</td>
                                            <td className="p-4 font-black text-green-600 dark:text-green-400">{formatRupiah(prep.price)}</td>
                                            <td className="p-4 text-slate-500 font-medium text-sm">
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

            {/* MODAL TAMBAH/EDIT BAHAN SETENGAH JADI */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        {/* HEADER */}
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                            <div>
                                <h3 className="font-heading font-black text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                    {prepId ? 'Edit Bahan Setengah Jadi' : 'Tambah Bahan Prep Baru'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Buat racikan prep Anda di sini.</p>
                            </div>
                            <IconButton variant="neutral" className="rounded-full" onClick={resetForm}><X className="w-5 h-5" /></IconButton>
                        </div>
                        
                        {/* BODY SCROLLABLE */}
                        <div className="flex-1 overflow-y-auto p-5 lg:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* KIRI: FORM INPUT */}
                                <div className="lg:col-span-8 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                        <Input label="Nama Prep" type="text" value={prepName} onChange={e => setPrepName(e.target.value)} placeholder="Misal: Bumbu Merah" />
                                        <Input label="Satuan Hasil" type="text" value={resultUnit} onChange={e => setResultUnit(e.target.value)} placeholder="Misal: Gram, Liter" />
                                        <Input label="Jumlah Hasil" type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="0" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 border-b pb-2">Komposisi Bahan Mentah:</label>
                                        <div className="space-y-4">
                                            {ingredients.map((ing, index) => (
                                                <div key={ing.id} className="grid grid-cols-12 gap-3 items-center border-b border-slate-200 dark:border-slate-700 pb-5 md:pb-0 md:border-none last:border-0 last:pb-0">
                                                    <div className="col-span-12 md:col-span-4">
                                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Nama Bahan Mentah</label>}
                                                        <select
                                                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500 text-sm"
                                                            value={ing.name}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const matched = activeRawMaterials.find(r => r.name === val);
                                                                if (matched) setIngredients(ingredients.map(i => i.id === ing.id ? { ...i, name: val, unit: matched.unit, price: String(matched.price), recipeUnit: matched.unit, qtyUsed: '1' } : i));
                                                                else handleIngredientChange(ing.id, 'name', val);
                                                            }}
                                                        >
                                                            <option value="" disabled>-- Pilih Bahan --</option>
                                                            {activeRawMaterials.map(rm => <option key={rm.id} value={rm.name}>{rm.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-4 md:col-span-3">
                                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Harga</label>}
                                                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 font-bold truncate border border-slate-200 dark:border-slate-700">
                                                            {formatRupiah(ing.price)} / {ing.unit || '-'}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-2 md:col-span-2">
                                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Jml & Satuan</label>}
                                                        <div className="flex gap-1">
                                                            <input type="number" className="w-12 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-center" value={ing.qtyUsed} onChange={e => handleIngredientChange(ing.id, 'qtyUsed', e.target.value)} />
                                                            <select className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" value={ing.recipeUnit || ing.unit} onChange={e => handleIngredientChange(ing.id, 'recipeUnit', e.target.value)}>
                                                                <option value={ing.unit}>{ing.unit || 'Sat'}</option>
                                                                <option value="Gram">Gram</option><option value="ml">ml</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-10 sm:col-span-3 md:col-span-2">
                                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 mb-2 text-center uppercase">Biaya</label>}
                                                        <div className="p-2.5 bg-accent-50 dark:bg-accent-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg text-sm text-accent-700 dark:text-accent-300 font-bold text-center truncate">{formatRupiah(getIngredientCost(ing))}</div>
                                                    </div>
                                                    <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-6' : ''}`}>
                                                        <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="ghost" size="sm" className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={handleAddIngredient}>Tambah Bahan Mentah</Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-slate-100 dark:border-slate-800">
                                        <Input label="Biaya Tenaga Kerja (1 Resep)" type="number" icon={<span className="font-bold">Rp</span>} value={laborCost} onChange={e => setLaborCost(e.target.value)} placeholder="0" />
                                        <Input label="Biaya Overhead (1 Resep)" type="number" icon={<span className="font-bold">Rp</span>} value={overheadCost} onChange={e => setOverheadCost(e.target.value)} placeholder="0" />
                                    </div>
                                </div>

                                {/* KANAN: RESULT */}
                                <div className="lg:col-span-4 bg-slate-900 rounded-2xl p-6 text-white h-full flex flex-col">
                                    <h4 className="font-heading font-black text-lg text-slate-100 border-b border-slate-700 pb-3 mb-5">SIMULASI HPP PREP</h4>
                                    <div className="space-y-4 text-sm flex-1">
                                        <div className="flex justify-between text-slate-400"><span>Bahan Baku:</span><span className="font-bold text-white">{formatRupiah(totalIngredientCost)}</span></div>
                                        <div className="flex justify-between text-slate-400"><span>Biaya Produksi:</span><span className="font-bold text-white">{formatRupiah(Number(laborCost) + Number(overheadCost))}</span></div>
                                        <div className="h-px bg-slate-700 my-2"></div>
                                        <div className="flex justify-between items-center text-slate-300"><span>Total 1 Batch:</span><span className="font-bold text-accent-400">{formatRupiah(totalIngredientCost + Number(laborCost) + Number(overheadCost))}</span></div>
                                        <div className="flex justify-between items-center text-slate-300"><span>Yield:</span><span className="font-bold text-accent-400 bg-accent-950/50 px-2 py-0.5 rounded border border-orange-500/40">{yieldQty || 0} {resultUnit || 'Unit'}</span></div>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-xl text-center mt-6 border border-slate-700 shadow-inner">
                                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">HPP per {resultUnit || 'Satuan'}</span>
                                        <span className="block text-3xl font-heading font-black text-green-400">{formatRupiah(livePrepCostPerUnit)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
                            <Button variant="secondary" onClick={resetForm}>Batal</Button>
                            <Button variant="success" icon={<Save className="w-4 h-4" />} onClick={handleSave}>Simpan Bahan Prep</Button>
                        </div>
                    </div>
                </div>
            )}
            <SortModal isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} value={sortKey} onChange={setSortKey} options={sortOptions} />
        </div>
    );
};

export default BahanSetengahJadiView;