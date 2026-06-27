import React, { useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, IconButton, PageHeader, EmptyState, Input } from '../../../components/ui';
import { Package, Plus, X, Search, Clock, Edit3, Trash2, Save } from 'lucide-react';

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
            <PageHeader
                title="Database Bahan Baku Pasar"
                subtitle="Kelola acuan harga bahan baku dasar murni dari pasar disini."
                icon={<Package className="w-6 h-6 text-accent-600 dark:text-accent-400" />}
                className="mb-2"
                action={!isEditing && (
                    <Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsEditing(true)}>
                        Tambah Bahan Baku
                    </Button>
                )}
            />

            {isEditing ? (
                <Card padding="lg" className="animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg">{formData.id ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}</h4>
                        <IconButton variant="neutral" className="rounded-full" onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }}><X className="w-5 h-5" /></IconButton>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        <Input
                            label="Nama Bahan Baku"
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Contoh: Ayam Potong"
                        />
                        <Input
                            label="Satuan Pembelian"
                            type="text"
                            value={formData.unit}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            placeholder="Contoh: Ekor, Kg, Liter, Gram"
                        />
                        <Input
                            label="Harga Beli Saat Ini (Rp)"
                            type="number"
                            icon={<span className="font-bold">Rp</span>}
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', unit: '', price: '' }); }}>Batal</Button>
                        <Button icon={<Save className="w-4 h-4" />} onClick={handleSave}>Simpan Bahan</Button>
                    </div>
                </Card>
            ) : (
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Cari bahan baku..."
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
            )}

            <Card padding="none" className="overflow-hidden">
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
                                <tr><td colSpan="5"><EmptyState size="sm" title="Belum ada data bahan baku" /></td></tr>
                            ) : (
                                filteredMaterials.map((rm) => {
                                    const isUpdatedToday = rm.lastUpdated && new Date(rm.lastUpdated).toDateString() === new Date().toDateString();
                                    return (
                                        <tr key={rm.id} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors group">
                                            <td className="p-4 font-bold text-slate-800 dark:text-slate-100 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">{rm.name}</td>
                                            <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{rm.unit}</td>
                                            <td className="p-4 font-black text-accent-600 dark:text-accent-400">{formatRupiah(rm.price)}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className={`w-3.5 h-3.5 ${isUpdatedToday ? 'text-green-500 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                                    <span className={`text-xs font-semibold ${isUpdatedToday ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {rm.lastUpdated ? new Date(rm.lastUpdated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <IconButton variant="edit" ghost onClick={() => { setFormData(rm); setIsEditing(true); }}><Edit3 className="w-4 h-4" /></IconButton>
                                                <IconButton variant="delete" ghost onClick={() => handleDelete(rm.id)}><Trash2 className="w-4 h-4" /></IconButton>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default BahanBakuView;