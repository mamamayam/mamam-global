import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Trash2, PencilLine } from 'lucide-react';
import { Button, Input, Select, IconButton } from '../../components/ui';
import { formatRupiah } from '../../utils/formatters';
import { activeOnly, markDeleted } from '../../utils/softDelete';
import { hasBaseUnit, formatBaseUnit } from '../../utils/unitConversion';
import { findActiveCorrection } from './stockChecklistApi';

// Koreksi Stok Opname — SATU-SATUNYA cara owner "mengedit" nilai Stok
// Opname dari mamam-global, TANPA nyentuh tabel stock_checklists (data
// mentah karyawan, punya mamam-absensi) sama sekali. Koreksi disimpan
// terpisah, dicek duluan sama valuateChecklist sebelum fallback ke
// checklist asli — lihat stockChecklistApi.js.
//
// "Hapus" koreksi = soft-delete (markDeleted) -> otomatis balik ke nilai
// checklist asli (atau ke status unmatched/unit-mismatch apa adanya) tanpa
// pernah kehilangan histori kalau ternyata kepencet gak sengaja.
//
// prefill (opsional): { rawMaterialId, name } — dipakai waktu modal dibuka
// dari baris item yang SUDAH diketahui bahannya (matched / unit-mismatch).
// Kalau kosong, user pilih sendiri dari dropdown (mis. buat item unmatched,
// atau nambah koreksi baru yang gak ada di checklist hari itu sama sekali).
const StockCorrectionModal = ({ isOpen, onClose, dateStr, rawMaterials, corrections, setCorrections, prefill, triggerAlert, triggerConfirm }) => {
  const [rawMaterialId, setRawMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  const usableMaterials = useMemo(
    () => activeOnly(rawMaterials || []).filter(hasBaseUnit).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [rawMaterials]
  );

  const existing = useMemo(
    () => (rawMaterialId ? findActiveCorrection(corrections, dateStr, rawMaterialId) : null),
    [corrections, dateStr, rawMaterialId]
  );

  // Reset/prefill pas modal DIBUKA aja (bukan tiap `corrections` berubah),
  // pola sama kayak UnitMigrationModal — hindari form yang lagi diisi user
  // ke-reset diam-diam kalau ada sync masuk dari device lain.
  useEffect(() => {
    if (!isOpen) return;
    const initialId = prefill?.rawMaterialId || '';
    setRawMaterialId(initialId);
    const activeExisting = initialId ? findActiveCorrection(corrections, dateStr, initialId) : null;
    setQty(activeExisting ? String(activeExisting.qty) : '');
    setNote(activeExisting ? (activeExisting.note || '') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedMaterial = usableMaterials.find(m => m.id === rawMaterialId);

  const handleMaterialChange = (id) => {
    setRawMaterialId(id);
    const activeExisting = findActiveCorrection(corrections, dateStr, id);
    setQty(activeExisting ? String(activeExisting.qty) : '');
    setNote(activeExisting ? (activeExisting.note || '') : '');
  };

  const handleSave = () => {
    if (!rawMaterialId) return triggerAlert('Pilih bahan yang mau dikoreksi dulu.');
    if (qty === '' || Number.isNaN(Number(qty)) || Number(qty) < 0) return triggerAlert('Isi jumlah yang benar (angka, minimal 0).');

    const now = new Date().toISOString();

    if (existing) {
      setCorrections(corrections.map(c => c.id === existing.id ? { ...c, qty: Number(qty), note: note.trim(), updatedAt: now } : c));
      triggerAlert('Koreksi berhasil diperbarui.');
    } else {
      const newCorrection = {
        id: `soc-${Date.now()}`,
        dateStr,
        rawMaterialId,
        qty: Number(qty),
        note: note.trim(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      setCorrections([...(corrections || []), newCorrection]);
      triggerAlert('Koreksi berhasil disimpan.');
    }
    onClose();
  };

  const handleRevert = () => {
    if (!existing) return;
    triggerConfirm('Hapus koreksi ini? Nilai akan balik ke hasil checklist asli (atau status semula kalau item ini tadinya belum ter-link).', () => {
      setCorrections(corrections.map(c => c.id === existing.id ? markDeleted(c) : c));
      triggerAlert('Koreksi dihapus, nilai kembali ke data asli.');
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start gap-3 p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="min-w-0">
            <h3 className="font-heading font-black text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
              <PencilLine className="w-5 h-5 text-accent-500 shrink-0" /> Koreksi Stok Opname
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tanggal {dateStr}. Data checklist asli karyawan tetap tersimpan apa adanya.</p>
          </div>
          <IconButton variant="neutral" className="rounded-full shrink-0" onClick={onClose}><X className="w-5 h-5" /></IconButton>
        </div>

        <div className="p-5 space-y-4">
          <Select
            label="Bahan"
            value={rawMaterialId}
            onChange={e => handleMaterialChange(e.target.value)}
            disabled={!!prefill?.rawMaterialId}
          >
            <option value="">-- Pilih Bahan --</option>
            {usableMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          {!hasBaseUnit(selectedMaterial) && rawMaterialId === '' && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Cuma bahan yang udah punya Satuan Dasar yang bisa dikoreksi (atur di Bahan Baku &rarr; Atur Satuan Dasar).</p>
          )}

          <Input
            label={selectedMaterial ? `Jumlah Sebenarnya (${formatBaseUnit(selectedMaterial.baseUnit)})` : 'Jumlah Sebenarnya'}
            type="number"
            step="any"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="0"
            disabled={!rawMaterialId}
          />
          {selectedMaterial && qty !== '' && !Number.isNaN(Number(qty)) && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold -mt-2">
              = {formatRupiah(Number(qty) * (selectedMaterial.basePrice || 0))}
            </p>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Catatan (opsional)</label>
            <textarea
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 text-sm transition-all duration-200"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Misal: karyawan salah tulis satuan, sudah dicek ulang fisik"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3 bg-slate-50 dark:bg-slate-950/50">
          {existing ? (
            <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={handleRevert}>Hapus Koreksi</Button>
          ) : <span />}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="success" icon={<Save className="w-4 h-4" />} onClick={handleSave}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockCorrectionModal;
