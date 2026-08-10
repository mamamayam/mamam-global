import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, Input, Select, EmptyState } from '../../../components/ui';
import { activeOnly } from '../../../utils/softDelete';
import { hasBaseUnit, formatBaseUnit, convertQtyToBaseUnit } from '../../../utils/unitConversion';
import { Calculator, Plus, Trash2, Save, HelpCircle, Edit3, Sparkles } from 'lucide-react';

const emptyIngredient = () => ({ id: Date.now() + Math.random(), rawMaterialId: '', name: '', baseUnit: '', qty: '1', needsAttention: false });

// Biaya 1 baris ingredient versi baru — tinggal qty * basePrice, gak ada lagi
// tabel konversi (lihat unitConversion.js untuk kenapa). qty SELALU dalam
// baseUnit bahan itu sendiri (gram/ml/pcs), gak ada satuan lain yang bisa
// dipilih di baris resep -> gak ada lagi ruang buat salah convert.
const ingredientCost = (ing, materials) => {
    const material = materials.find(m => m.id === ing.rawMaterialId);
    const price = material ? (material.basePrice || 0) : 0;
    return price * (Number(ing.qty) || 0);
};

const KalkulatorHppView = () => {
    const {
        availableMaterials,
        hppLibrary, setHppLibrary,
        categories, setIsCategoryModalOpen,
        triggerAlert, triggerConfirm, setActiveTab
    } = useAppContext();

    const [productName, setProductName] = useState('');
    const [category, setCategory] = useState(categories[0] || 'Uncategorized');
    const [yieldQty, setYieldQty] = useState('');
    const [ingredients, setIngredients] = useState([emptyIngredient()]);
    const [laborCost, setLaborCost] = useState('');
    const [overheadCost, setOverheadCost] = useState('');
    const [marginPercent, setMarginPercent] = useState(35);
    const [manualPrice, setManualPrice] = useState('');
    const [showResult, setShowResult] = useState(false);

    const activeAvailableMaterials = useMemo(() => activeOnly(availableMaterials), [availableMaterials]);
    const usableMaterials = activeAvailableMaterials.filter(hasBaseUnit);
    const pendingMaterialsCount = activeAvailableMaterials.length - usableMaterials.length;

    const handleAddIngredient = () => setIngredients([...ingredients, emptyIngredient()]);
    const handleRemoveIngredient = (id) => setIngredients(ingredients.length > 1 ? ingredients.filter(ing => ing.id !== id) : [emptyIngredient()]);

    const handleSelectMaterial = (id, materialName) => {
        const matched = usableMaterials.find(m => m.name === materialName);
        setIngredients(ingredients.map(ing => ing.id === id ? {
            ...ing,
            name: materialName,
            rawMaterialId: matched ? matched.id : '',
            baseUnit: matched ? matched.baseUnit : '',
            qty: '1',
            needsAttention: false,
        } : ing));
    };

    const handleQtyChange = (id, value) => {
        setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, qty: value } : ing));
    };

    const handleReset = () => {
        setProductName('');
        setCategory(categories[0] || 'Uncategorized');
        setIngredients([emptyIngredient()]);
        setLaborCost(''); setOverheadCost(''); setYieldQty(''); setMarginPercent(35); setManualPrice('');
        setShowResult(false);
    };

    // Resep dengan nama yang sama persis udah ada di Library -> tawarin muat
    // & konversi otomatis komposisinya, biar gak perlu ngetik ulang dari nol
    // pas migrasi ke sistem Satuan Dasar. Angka HASIL konversi tetep harus
    // dicek user sebelum Simpan (bukan langsung dipercaya buta).
    const existingMatch = useMemo(
        () => hppLibrary.find(item => item.name.trim().toLowerCase() === productName.trim().toLowerCase() && productName.trim()),
        [hppLibrary, productName]
    );

    const handleLoadFromExisting = () => {
        if (!existingMatch) return;
        const converted = existingMatch.ingredients.map(oldIng => {
            const material = usableMaterials.find(m => m.id === oldIng.rawMaterialId)
                || usableMaterials.find(m => m.name.toLowerCase() === (oldIng.name || '').toLowerCase());

            if (!material) {
                return { id: Date.now() + Math.random(), rawMaterialId: '', name: oldIng.name || '', baseUnit: '', qty: '', needsAttention: true };
            }

            // Ingredient yang sebelumnya udah v2 (punya `qty` langsung) -> tinggal pakai lagi.
            // Yang masih bentuk lama -> convert dari recipeQtyUsed+recipeUnit yang kesimpen.
            let qty = null;
            if (oldIng.qty !== undefined) {
                qty = Number(oldIng.qty);
            } else if (oldIng.recipeUnit) {
                qty = convertQtyToBaseUnit(oldIng.recipeQtyUsed, oldIng.recipeUnit, material.baseUnit, material.checklistUnitOverride);
            }

            return {
                id: Date.now() + Math.random(),
                rawMaterialId: material.id,
                name: material.name,
                baseUnit: material.baseUnit,
                qty: qty !== null && qty !== undefined && !Number.isNaN(qty) ? String(Math.round(qty * 100) / 100) : '',
                needsAttention: qty === null || qty === undefined || Number.isNaN(qty),
            };
        });
        setIngredients(converted.length > 0 ? converted : [emptyIngredient()]);
        triggerAlert('Komposisi lama dimuat & dikonversi ke Satuan Dasar. Cek lagi angkanya sebelum simpan, terutama baris yang ditandai.');
    };

    const handleCalculate = () => {
        if (!productName.trim()) return triggerAlert('Nama Produk wajib diisi!');
        const hasEmptyIngredient = ingredients.some(ing => !ing.rawMaterialId || ing.qty === '' || Number(ing.qty) < 0);
        if (hasEmptyIngredient) return triggerAlert('Lengkapi seluruh Bahan (pilih bahan & isi jumlahnya)!');
        if (!yieldQty || Number(yieldQty) <= 0) return triggerAlert('Jumlah Produk (Unit) harus lebih dari 0!');
        setShowResult(true);
    };

    // Total berat & volume dipisah tegas (bukan digabung kayak sistem lama)
    // karena gram & ml emang 2 dimensi fisik yang beda -> lebih jujur/akurat.
    const totalGram = useMemo(() => ingredients.filter(i => i.baseUnit === 'gram').reduce((s, i) => s + (Number(i.qty) || 0), 0), [ingredients]);
    const totalMl = useMemo(() => ingredients.filter(i => i.baseUnit === 'ml').reduce((s, i) => s + (Number(i.qty) || 0), 0), [ingredients]);

    const totalIngredientCost = useMemo(() => ingredients.reduce((sum, item) => sum + ingredientCost(item, activeAvailableMaterials), 0), [ingredients, activeAvailableMaterials]);
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
            id: `hpp-${Date.now()}`,
            name: productName,
            category,
            ingredients: ingredients.map(ing => {
                const material = activeAvailableMaterials.find(m => m.id === ing.rawMaterialId);
                return {
                    rawMaterialId: ing.rawMaterialId,
                    name: material ? material.name : ing.name,
                    baseUnit: material ? material.baseUnit : ing.baseUnit,
                    qty: Number(ing.qty) || 0,
                    snapshotBasePrice: material ? (material.basePrice || 0) : 0,
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
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-6">
                    <Card padding="lg" className="space-y-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">Informasi Produk</h4>
                        <div className="space-y-5">
                            <Input label="Nama Produk Final" type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Contoh: Es Teh" />
                            {existingMatch && (
                                <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl border border-accent-200 dark:border-accent-500/30 bg-accent-50 dark:bg-accent-500/10">
                                    <p className="text-xs font-semibold text-accent-700 dark:text-accent-300">Resep "{existingMatch.name}" udah ada di Library.</p>
                                    <Button size="xs" variant="ghost" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={handleLoadFromExisting}>Muat &amp; Konversi Otomatis</Button>
                                </div>
                            )}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">Kategori</label>
                                    <button onClick={() => setIsCategoryModalOpen(true)} className="text-xs text-accent-600 font-bold hover:underline flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Kelola Kategori</button>
                                </div>
                                <Select value={category} onChange={e => setCategory(e.target.value)}>
                                    {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                    {!categories.includes(category) && category && <option value={category}>{category}</option>}
                                </Select>
                            </div>
                        </div>
                    </Card>

                    <Card padding="lg" className="space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2"><span>🛒</span> Komposisi Bahan</h4>
                            {pendingMaterialsCount > 0 && (
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{pendingMaterialsCount} bahan belum bisa dipilih (belum ada Satuan Dasar di Bahan Baku)</span>
                            )}
                        </div>
                        <div className="space-y-4">
                            {ingredients.map((ing, index) => (
                                <div key={ing.id} className={`grid grid-cols-12 gap-3 items-center border-b border-slate-100 dark:border-slate-800 pb-4 md:pb-0 md:border-none ${ing.needsAttention ? 'rounded-xl bg-amber-50 dark:bg-amber-500/10 p-2 -mx-2' : ''}`}>
                                    <div className="col-span-12 md:col-span-5">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Bahan</label>}
                                        <select
                                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 text-sm transition-all duration-200"
                                            value={ing.name}
                                            onChange={e => handleSelectMaterial(ing.id, e.target.value)}
                                        >
                                            <option value="" disabled>-- Pilih Bahan --</option>
                                            <optgroup label="Bahan Baku Pasar">{usableMaterials.filter(m => !m.isPrep).map(rm => <option key={rm.id} value={rm.name}>{rm.name}</option>)}</optgroup>
                                            <optgroup label="Bahan Prep">{usableMaterials.filter(m => m.isPrep).map(prep => <option key={prep.id} value={prep.name}>{prep.name}</option>)}</optgroup>
                                        </select>
                                        {ing.needsAttention && <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">Perlu dicek / pilih ulang bahannya</p>}
                                    </div>
                                    <div className="col-span-6 md:col-span-3">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 text-center uppercase mb-2">Jumlah</label>}
                                        <input type="number" step="any" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-center" value={ing.qty} onChange={e => handleQtyChange(ing.id, e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="col-span-6 md:col-span-1 text-center">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Satuan</label>}
                                        <span className="inline-block px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">{formatBaseUnit(ing.baseUnit)}</span>
                                    </div>
                                    <div className="col-span-8 md:col-span-2">
                                        {index === 0 && <label className="block text-xs font-bold text-slate-500 text-center uppercase mb-2">Biaya</label>}
                                        <div className="p-3 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 rounded-xl text-sm text-accent-700 dark:text-accent-300 font-bold text-center truncate">{formatRupiah(ingredientCost(ing, activeAvailableMaterials))}</div>
                                    </div>
                                    <div className="col-span-4 md:col-span-1 flex justify-center">
                                        <button onClick={() => handleRemoveIngredient(ing.id)} className="p-2.5 text-slate-400 hover:text-accent-500 hover:bg-accent-50 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={handleAddIngredient}>Tambah Komposisi</Button>
                        <div className="bg-accent-50 dark:bg-accent-500/10 p-5 rounded-2xl border border-accent-200 dark:border-accent-500/30 flex flex-col gap-3 text-sm mt-5">
                            {totalGram > 0 && <div className="flex justify-between items-center border-b border-accent-200/60 dark:border-accent-500/20 pb-3"><span className="font-bold">Total Berat:</span><span className="font-black text-accent-900 dark:text-accent-200">{totalGram} Gram</span></div>}
                            {totalMl > 0 && <div className="flex justify-between items-center border-b border-accent-200/60 dark:border-accent-500/20 pb-3"><span className="font-bold">Total Volume:</span><span className="font-black text-accent-900 dark:text-accent-200">{totalMl} ml</span></div>}
                            <div className="flex justify-between items-center"><span className="font-black">Total Biaya Komposisi:</span><span className="font-black text-accent-600 dark:text-accent-400">{formatRupiah(totalIngredientCost)}</span></div>
                        </div>
                    </Card>

                    <Card padding="lg" className="space-y-4">
                        <h4 className="font-heading font-bold text-lg flex items-center gap-2"><span>📦</span> Jumlah Produk yang Dihasilkan</h4>
                        <Input label="Jumlah Produk (Unit)" type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} placeholder="Misal: 10" />
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button size="lg" className="flex-1" icon={<Calculator className="w-5 h-5" />} onClick={handleCalculate}>Hitung HPP Final</Button>
                        <Button variant="secondary" size="lg" onClick={handleReset}>Reset</Button>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
                    {showResult ? (
                        <Card variant="dark-elevated" padding="lg" className="space-y-6 animate-in zoom-in-95 duration-300 ease-out">
                            <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
                                <div>
                                    <h4 className="font-heading font-black text-lg text-slate-100 tracking-wider">HASIL ANALISA & HARGA JUAL</h4>
                                    <p className="text-xs text-slate-400 mt-1">Atur simulasi margin & harga akhir.</p>
                                </div>
                                <HelpCircle className="w-5 h-5 text-slate-400 cursor-help" />
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-slate-400"><span>Bahan / Porsi:</span><span className="font-bold text-white">{formatRupiah(materialCostPerUnit)}</span></div>
                                <div className="flex justify-between text-slate-400"><span>Tenaga Kerja / Porsi:</span><span className="font-bold text-white">{formatRupiah(lbrCost)}</span></div>
                                <div className="flex justify-between text-slate-400"><span>Overhead / Kemasan:</span><span className="font-bold text-white">{formatRupiah(ovhCost)}</span></div>
                                <div className="h-px bg-slate-800 my-3"></div>
                                <div className="flex justify-between items-center bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                                    <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">TOTAL HPP PER PORSI</span>
                                    <span className="text-lg font-black text-accent-400">{formatRupiah(totalHppPerUnit)}</span>
                                </div>
                            </div>

                            <Card variant="dark-muted" padding="md" className="mt-4 space-y-3">
                                <div className="flex justify-between items-center text-sm text-slate-400">
                                    <span>Total HPP (Satu Resep Penuh):</span><span className="font-bold text-white">{formatRupiah(totalHppPerUnit * yld)}</span>
                                </div>
                                {totalGram > 0 && (
                                    <div className="flex justify-between items-center text-sm text-slate-300 pt-2 border-t border-slate-700">
                                        <span className="font-bold">Total HPP per Gram:</span>
                                        <span className="font-black text-accent-400 bg-accent-950/50 px-2 py-1 rounded-lg border border-accent-500/50">{formatRupiah((totalHppPerUnit * yld) / totalGram)}</span>
                                    </div>
                                )}
                                {totalMl > 0 && (
                                    <div className="flex justify-between items-center text-sm text-slate-300 pt-2 border-t border-slate-700">
                                        <span className="font-bold">Total HPP per ml:</span>
                                        <span className="font-black text-accent-400 bg-accent-950/50 px-2 py-1 rounded-lg border border-accent-500/50">{formatRupiah((totalHppPerUnit * yld) / totalMl)}</span>
                                    </div>
                                )}
                            </Card>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-300">Target Profit Margin (%)</span>
                                    <span className="font-black text-accent-400 text-base bg-accent-950/50 px-3 py-1 rounded-lg border border-accent-500/50">{marginPercent}%</span>
                                </div>
                                <input type="range" min="5" max="95" className="w-full accent-[#ea580c] cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none" value={marginPercent} onChange={e => setMarginPercent(Number(e.target.value))} />
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {[20, 35, 50, 70].map(m => <button key={m} onClick={() => setMarginPercent(m)} className={`py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${marginPercent === m ? 'bg-accent-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{m}%</button>)}
                                </div>
                            </div>

                            <Card variant="dark-muted" padding="lg" className="space-y-2 text-center mt-6">
                                <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Rekomendasi Harga Jual</span>
                                <span className="block text-3xl font-heading font-black text-white">{formatRupiah(roundedRecommendedPrice)}</span>
                            </Card>

                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Harga Jual Final Restoran</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Rp</span>
                                    <input type="number" className="w-full p-4 pl-12 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 text-base font-bold text-white transition-all duration-200 shadow-inner" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder={String(roundedRecommendedPrice)} />
                                </div>
                            </div>

                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 mt-4">
                                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-4">ANALISA KEUNTUNGAN AKTUAL</span>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Estimasi Laba / Porsi:</span>
                                    <span className={`font-black text-base ${actualProfitValue >= 0 ? 'text-emerald-400' : 'text-accent-400'}`}>{formatRupiah(actualProfitValue)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-medium">Profit Margin Aktual:</span>
                                    <span className={`font-black text-base px-2 py-0.5 rounded-md ${actualProfitPercent >= 0 ? 'bg-emerald-950/30 text-emerald-400' : 'bg-accent-950/30 text-accent-400'}`}>{actualProfitPercent.toFixed(1)}%</span>
                                </div>
                            </div>

                            <Button variant="success" size="full" className="mt-6 text-base" icon={<Save className="w-5 h-5" />} onClick={handleSaveToLibrary}>
                                Simpan Formula ke Library
                            </Button>
                        </Card>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 py-24 animate-in fade-in duration-300">
                            <EmptyState size="lg" icon={<Calculator className="w-16 h-16" />} title="Silakan isi formulir di samping" description='Lalu klik tombol "Hitung HPP Final" untuk melihat analisa harga jual & margin laba aktual.' />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KalkulatorHppView;
