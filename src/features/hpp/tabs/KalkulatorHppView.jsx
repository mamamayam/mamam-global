import React, { useState, useMemo, useEffect } from 'react';
import { getIngredientCost } from '../../../utils/hppUtils';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, Input, Select, EmptyState } from '../../../components/ui';
import { Calculator, Plus, Trash2, Save, HelpCircle, Edit3 } from 'lucide-react';

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
                    <Card padding="lg" className="space-y-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">Informasi Produk</h4>
                        <div className="space-y-5">
                            <Input
                                label="Nama Produk Final"
                                type="text"
                                value={productName}
                                onChange={e => setProductName(e.target.value)}
                                placeholder="Contoh: Es Teh, Nasi Goreng, Bakso"
                            />
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">Kategori</label>
                                    <button onClick={() => setIsCategoryModalOpen(true)} className="text-xs text-accent-600 dark:text-accent-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                                        <Edit3 className="w-3.5 h-3.5" /> Kelola Kategori
                                    </button>
                                </div>
                                <Select value={category} onChange={e => setCategory(e.target.value)}>
                                    {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                    {!categories.includes(category) && category && <option value={category}>{category}</option>}
                                </Select>
                            </div>
                        </div>
                    </Card>

                    <Card padding="lg" className="space-y-5">
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
                                        <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl text-sm text-accent-700 dark:text-accent-300 font-bold text-center truncate">{formatRupiah(getIngredientCost(ing))}</div>
                                    </div>

                                    <div className={`col-span-2 sm:col-span-1 md:col-span-1 flex justify-center ${index === 0 ? 'md:pt-8' : ''}`}>
                                        <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center md:justify-start pt-2">
                            <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={handleAddIngredient}>Tambah Komposisi</Button>
                        </div>

                        <div className="bg-accent-50 dark:bg-accent-500/10 p-5 rounded-2xl border border-orange-200 dark:border-orange-500/30 flex flex-col gap-3 text-sm mt-5">
                            <div className="flex justify-between items-center border-b border-orange-200 dark:border-orange-500/60 pb-3">
                                <span className="text-accent-800 dark:text-accent-300 font-bold">Total Estimasi Berat / Volume:</span>
                                <span className="text-base font-black text-accent-900 dark:text-accent-200">{totalWeight} <span className="text-xs text-accent-800 dark:text-accent-300 font-bold">Gram/ml</span></span>
                            </div>
                            <div className="flex justify-between items-center border-b border-orange-200 dark:border-orange-500/60 pb-3">
                                <span className="text-accent-800 dark:text-accent-300 font-bold">Total Biaya Komposisi Bahan (Murni):</span>
                                <span className="text-base font-black text-accent-900 dark:text-accent-200">{formatRupiah(totalIngredientCost)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-accent-900 dark:text-accent-200 font-black">HPP Bahan per Gram/ml:</span>
                                <span className="text-base font-black text-accent-600 dark:text-accent-400">{formatRupiah(totalWeight > 0 ? totalIngredientCost / totalWeight : 0)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card padding="lg" className="space-y-4">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2"><span>📦</span> Jumlah Produk yang Dihasilkan</h4>
                        <Input
                            label="Jumlah Produk (Unit)"
                            type="number"
                            value={yieldQty}
                            onChange={e => setYieldQty(e.target.value)}
                            placeholder="Contoh: 10, 50, 100"
                        />
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button size="lg" className="flex-1" icon={<Calculator className="w-5 h-5" />} onClick={handleCalculate}>Hitung HPP Final</Button>
                        <Button variant="secondary" size="lg" onClick={handleReset}>Reset</Button>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
                    {showResult ? (
                        <Card variant="dark-elevated" padding="lg" className="space-y-6 animate-in zoom-in-95 duration-300 ease-out">
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
                                    <span className="text-lg font-black text-accent-400 dark:text-accent-300">{formatRupiah(totalHppPerUnit)}</span>
                                </div>
                            </div>

                            <Card variant="dark-muted" padding="md" className="mt-4 space-y-3">
                                <div className="flex justify-between items-center text-sm text-slate-400 dark:text-slate-500">
                                    <span>Total HPP (Satu Resep Penuh):</span>
                                    <span className="font-bold text-slate-200 dark:text-slate-700">{formatRupiah(totalHppPerUnit * yld)}</span>
                                </div>
                                {totalWeight > 0 && (
                                    <div className="flex justify-between items-center text-sm text-slate-300 dark:text-slate-600 pt-2 border-t border-slate-700 dark:border-slate-300">
                                        <span className="font-bold">Total HPP per Gram/ml:</span>
                                        <span className="font-black text-accent-400 dark:text-accent-300 bg-accent-950 dark:bg-accent-950/50 px-2 py-1 rounded-md border border-orange-900 dark:border-orange-500/50">
                                            {formatRupiah((totalHppPerUnit * yld) / totalWeight)}
                                        </span>
                                    </div>
                                )}
                            </Card>

                            <div className="space-y-4 pt-4 border-t border-slate-800 dark:border-slate-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-300 dark:text-slate-600">Target Profit Margin (%)</span>
                                    <span className="font-black text-accent-400 dark:text-accent-300 text-base bg-accent-950 dark:bg-accent-950/50 px-3 py-1 rounded-lg border border-orange-900 dark:border-orange-500/50">{marginPercent}%</span>
                                </div>
                                <input type="range" min="5" max="95" className="w-full accent-orange-600 cursor-pointer h-2 bg-slate-700 dark:bg-slate-300 rounded-lg appearance-none" value={marginPercent} onChange={e => setMarginPercent(Number(e.target.value))} />
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {[20, 35, 50, 70].map(m => <button key={m} onClick={() => setMarginPercent(m)} className={`py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${marginPercent === m ? 'bg-accent-600 dark:bg-accent-500 text-white shadow-md' : 'bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-700 hover:text-white dark:hover:text-slate-900'}`}>{m}%</button>)}
                                </div>
                            </div>

                            <Card variant="dark-muted" padding="lg" className="space-y-2 text-center mt-6">
                                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Rekomendasi Harga Jual</span>
                                <span className="block text-3xl font-heading font-black text-slate-100 dark:text-slate-800">{formatRupiah(roundedRecommendedPrice)}</span>
                            </Card>

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
                                    <span className={`font-black text-base ${actualProfitValue >= 0 ? 'text-green-400 dark:text-green-400' : 'text-accent-400 dark:text-accent-400'}`}>{formatRupiah(actualProfitValue)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 dark:text-slate-500 font-medium">Profit Margin Aktual:</span>
                                    <span className={`font-black text-base px-2 py-0.5 rounded-md ${actualProfitPercent >= 0 ? 'bg-green-950 dark:bg-green-950/30 text-green-400 dark:text-green-400' : 'bg-accent-950 dark:bg-accent-950/30 text-accent-400 dark:text-accent-400'}`}>{actualProfitPercent.toFixed(1)}%</span>
                                </div>
                            </div>

                            <Button variant="success" size="full" className="mt-6 text-base" icon={<Save className="w-5 h-5" />} onClick={handleSaveToLibrary}>
                                {editingRecipe ? 'Simpan Perubahan' : 'Simpan Formula ke Library'}
                            </Button>
                        </Card>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 py-24 animate-in fade-in duration-300">
                            <EmptyState
                                size="lg"
                                icon={<Calculator className="w-16 h-16" />}
                                title="Silakan isi formulir di samping"
                                description='Lalu klik tombol "Hitung HPP Final" untuk melihat analisa harga jual & margin laba aktual.'
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KalkulatorHppView;