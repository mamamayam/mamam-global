import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Ruler, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { formatRupiah } from '../../../utils/formatters';
import { Card, Button, Badge, Input, Select, IconButton, EmptyState } from '../../../components/ui';
import { activeOnly } from '../../../utils/softDelete';
import { BASE_UNITS, BASE_UNIT_LABELS, suggestBaseUnitAndPrice, formatBaseUnit } from '../../../utils/unitConversion';

// Migrasi Satuan — satu-satunya tempat buat ngisi/ngedit baseUnit & basePrice
// tiap rawMaterial (dipakai baik migrasi data lama MAUPUN bahan yang baru
// ditambah lewat Tambah Bahan Baku, karena keduanya bakal muncul di sini
// selama baseUnit-nya masih kosong — lihat banner status di BahanBakuView).
//
// Kenapa terpisah dari modal Tambah/Edit Bahan Baku: biar cuma ada SATU
// tempat yang tau cara nyaranin/nge-parse satuan (gampang di-maintain), dan
// biar review-nya bisa sekaligus lihat semua bahan (bukan satu-satu buka
// modal edit bergantian).
//
// Alur: draft lokal (belum kesimpen) diisi dari basePrice/baseUnit yang
// SUDAH ada, atau dari suggestBaseUnitAndPrice() kalau belum ada — user bisa
// koreksi apa aja sebelum tekan "Terapkan Semua". unit/price LAMA di
// rawMaterials tidak disentuh sama sekali (0 resiko ke kalkulasi yang lagi
// jalan sekarang, sesuai prinsip Patch 1).
//
// PENTING soal urutan Hook: semua Hook (useState/useEffect/useMemo) WAJIB
// dipanggil sebelum early-return `if (!isOpen)` di bawah — kalau ada Hook
// yang nyelip SETELAH early-return itu, urutan pemanggilan Hook jadi beda
// antara render "modal terbuka" vs "modal tertutup" dan React akan error.
const UnitMigrationModal = ({ isOpen, onClose }) => {
  const { rawMaterials, setRawMaterials, triggerAlert } = useAppContext();
  const [draft, setDraft] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const activeMaterials = useMemo(() => activeOnly(rawMaterials), [rawMaterials]);

  // Sengaja cuma re-init draft pas modal DIBUKA (bukan tiap `rawMaterials`
  // berubah) — supaya draft yang lagi direview/diketik user gak diam-diam
  // ke-reset kalau device lain kebetulan sync perubahan harga selagi modal
  // ini terbuka. Nutup lalu buka lagi modalnya akan re-sync dari data terbaru.
  useEffect(() => {
    if (!isOpen) return;
    const initial = {};
    activeOnly(rawMaterials).forEach(rm => {
      const already = rm.baseUnit && (rm.basePrice !== null && rm.basePrice !== undefined);
      const suggestion = already ? null : suggestBaseUnitAndPrice(rm.unit, rm.price);
      initial[rm.id] = {
        baseUnit: already ? rm.baseUnit : (suggestion.baseUnit || ''),
        basePrice: already
          ? String(rm.basePrice)
          : (suggestion.basePrice !== null ? String(Math.round(suggestion.basePrice * 100) / 100) : ''),
        checklistUnitOverride: rm.checklistUnitOverride || [],
      };
    });
    setDraft(initial);
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isRowComplete = (id) => {
    const d = draft[id];
    return !!d && !!d.baseUnit && d.basePrice !== '' && !Number.isNaN(Number(d.basePrice));
  };

  const visibleMaterials = useMemo(() => {
    const filtered = activeMaterials.filter(rm => rm.name.toLowerCase().includes(searchQuery.toLowerCase()));
    // Yang belum lengkap duluan — paling butuh perhatian user duluan.
    return [...filtered].sort((a, b) => {
      const aDone = isRowComplete(a.id);
      const bDone = isRowComplete(b.id);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name, 'id');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMaterials, searchQuery, draft]);

  const completedCount = activeMaterials.filter(rm => isRowComplete(rm.id)).length;

  if (!isOpen) return null;

  const updateDraft = (id, patch) => {
    setDraft(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const addOverrideRow = (id) => {
    setDraft(prev => ({
      ...prev,
      [id]: { ...prev[id], checklistUnitOverride: [...(prev[id]?.checklistUnitOverride || []), { label: '', factor: '' }] },
    }));
  };

  const updateOverrideRow = (id, idx, patch) => {
    setDraft(prev => {
      const rows = [...(prev[id]?.checklistUnitOverride || [])];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, [id]: { ...prev[id], checklistUnitOverride: rows } };
    });
  };

  const removeOverrideRow = (id, idx) => {
    setDraft(prev => {
      const rows = (prev[id]?.checklistUnitOverride || []).filter((_, i) => i !== idx);
      return { ...prev, [id]: { ...prev[id], checklistUnitOverride: rows } };
    });
  };

  const handleApply = () => {
    setRawMaterials(rawMaterials.map(rm => {
      const d = draft[rm.id];
      if (!d) return rm;

      const basePriceNum = d.basePrice !== '' ? Number(d.basePrice) : null;
      const cleanOverrides = (d.checklistUnitOverride || [])
        .filter(o => o.label && o.label.trim() && Number(o.factor) > 0)
        .map(o => ({ label: o.label.trim(), factor: Number(o.factor) }));

      return {
        ...rm,
        baseUnit: d.baseUnit || null,
        basePrice: (d.baseUnit && basePriceNum !== null && !Number.isNaN(basePriceNum)) ? basePriceNum : null,
        checklistUnitOverride: cleanOverrides,
      };
    }));
    triggerAlert('Satuan dasar berhasil disimpan.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="flex justify-between items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="min-w-0">
            <h3 className="font-heading font-black text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
              <Ruler className="w-5 h-5 text-accent-500 shrink-0" /> Migrasi Satuan Dasar
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {completedCount} dari {activeMaterials.length} bahan sudah punya Satuan Dasar &middot; harga selalu per 1 Gram / ml / Pcs.
            </p>
          </div>
          <IconButton variant="neutral" className="rounded-full shrink-0" onClick={onClose}><X className="w-5 h-5" /></IconButton>
        </div>

        {/* SEARCH */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari bahan..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* BODY SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {visibleMaterials.length === 0 ? (
            <EmptyState size="sm" title="Tidak ada bahan yang cocok" />
          ) : (
            visibleMaterials.map(rm => {
              const d = draft[rm.id] || { baseUnit: '', basePrice: '', checklistUnitOverride: [] };
              const done = isRowComplete(rm.id);

              return (
                <Card key={rm.id} variant="muted" padding="md" className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{rm.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Sebelumnya: {rm.unit || '(satuan kosong)'} &middot; {formatRupiah(rm.price)}
                      </p>
                    </div>
                    <Badge variant={done ? 'success' : 'warning'} size="sm" className="shrink-0">
                      {done ? 'Siap' : 'Perlu diisi'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Satuan Dasar"
                      value={d.baseUnit}
                      onChange={e => updateDraft(rm.id, { baseUnit: e.target.value })}
                    >
                      <option value="">Pilih...</option>
                      {BASE_UNITS.map(u => <option key={u} value={u}>{BASE_UNIT_LABELS[u]}</option>)}
                    </Select>
                    <Input
                      label={`Harga / ${formatBaseUnit(d.baseUnit)}`}
                      type="number"
                      step="any"
                      value={d.basePrice}
                      onChange={e => updateDraft(rm.id, { basePrice: e.target.value })}
                      placeholder="0"
                    />
                  </div>

                  {done && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> = {formatRupiah(Number(d.basePrice))} / {formatBaseUnit(d.baseUnit)}
                    </p>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-500 dark:text-slate-400 select-none">
                      Alias satuan checklist (opsional){(d.checklistUnitOverride || []).length > 0 ? ` \u00b7 ${d.checklistUnitOverride.length}` : ''}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-slate-400 dark:text-slate-500 leading-relaxed">
                        Isi kalau di checklist stok bahan ini kadang ditulis pakai satuan gak standar (misal "Pouch"). 1 satuan itu = berapa {formatBaseUnit(d.baseUnit) || 'Satuan Dasar'}?
                      </p>
                      {(d.checklistUnitOverride || []).map((o, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            className="flex-1 min-w-0 p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            placeholder="Misal: Pouch"
                            value={o.label}
                            onChange={e => updateOverrideRow(rm.id, idx, { label: e.target.value })}
                          />
                          <span className="text-slate-400 shrink-0">=</span>
                          <input
                            type="number"
                            className="w-20 shrink-0 p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            placeholder="900"
                            value={o.factor}
                            onChange={e => updateOverrideRow(rm.id, idx, { factor: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removeOverrideRow(rm.id, idx)}
                            className="p-1.5 text-slate-400 hover:text-accent-500 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOverrideRow(rm.id)}
                        className="text-accent-600 dark:text-accent-400 font-semibold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Tambah alias
                      </button>
                    </div>
                  </details>
                </Card>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/50">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="success" icon={<CheckCircle2 className="w-4 h-4" />} onClick={handleApply}>
            Terapkan Semua
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnitMigrationModal;
