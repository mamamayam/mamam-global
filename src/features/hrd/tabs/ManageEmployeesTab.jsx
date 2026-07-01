import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { toLocalDateString } from '../../../utils/formatters';
import { Card, Button, Input, Select, IconButton, Badge, SortModal } from '../../../components/ui';
import { applySort } from '../../../utils/sortUtils';
import { Plus, Edit3, Trash2, Briefcase, ArrowUpDown, ChevronLeft } from 'lucide-react';
import { EMPLOYEE_STATUS_OPTIONS, getEmployeeStatus, getEmployeeStatusInfo, OVERTIME_RATE_PER_30MIN } from '../utils/payrollLogic';

// Form kosong dipakai di 3 tempat (state awal, reset setelah simpan, tombol
// "Tambah Karyawan") — disatukan di sini biar gak ada 3 salinan object literal
// yang sama persis & gampang ketinggalan kalau suatu saat ada field baru.
const createEmptyEmployeeForm = () => ({
  id: '', name: '', phone: '', address: '',
  hourlyRate: 0, fullTimeBonus: 0, overtimeRate30: OVERTIME_RATE_PER_30MIN,
  startDate: toLocalDateString(), status: 'aktif', resignDate: '',
});

const ManageEmployeesTab = () => {
  const { employees, setEmployees, formatRupiah, triggerAlert, triggerConfirm, currentShift } = useAppContext();

  const [isEditingEmp, setIsEditingEmp] = useState(false);
  const [empFormData, setEmpFormData] = useState(createEmptyEmployeeForm);
  const [empSortKey, setEmpSortKey] = useState('name-asc');
  const [isEmpSortOpen, setIsEmpSortOpen] = useState(false);
  const [empStatusFilter, setEmpStatusFilter] = useState('semua');

  const handleSaveEmployee = () => {
    if (!empFormData.name || empFormData.hourlyRate <= 0) return triggerAlert('Nama dan Upah per jam harus diisi dengan benar!');

    const payload = {
      ...empFormData,
      overtimeRate30: Number(empFormData.overtimeRate30) > 0 ? Number(empFormData.overtimeRate30) : OVERTIME_RATE_PER_30MIN,
    };

    if (payload.id) {
      setEmployees(prev => prev.map(e => e.id === payload.id ? payload : e));
      triggerAlert('Data Karyawan berhasil diupdate.');
    } else {
      setEmployees(prev => [...prev, { ...payload, id: `EMP-${Date.now()}` }]);
      triggerAlert('Karyawan baru berhasil ditambahkan.');
    }
    setIsEditingEmp(false);
    setEmpFormData(createEmptyEmployeeForm());
  };

  const handleDeleteEmployee = (id) => {
    triggerConfirm('Yakin ingin menghapus data karyawan ini? Data riwayat mungkin akan kehilangan referensi.', () => {
      setEmployees(prev => prev.filter(e => e.id !== id));
      triggerAlert('Karyawan dihapus.');
    });
  };

  const sortedEmployees = useMemo(() => {
    const filtered = empStatusFilter === 'semua'
      ? employees
      : employees.filter(e => getEmployeeStatus(e) === empStatusFilter);
    return applySort(filtered, empSortKey, {
      name: e => e.name || '',
      rate: e => e.hourlyRate || 0,
      date: e => new Date(e.startDate),
    });
  }, [employees, empStatusFilter, empSortKey]);

  const empListSortOptions = [
    { key: 'name-asc', label: 'Nama (A-Z)' },
    { key: 'name-desc', label: 'Nama (Z-A)' },
    { key: 'rate-desc', label: 'Upah Tertinggi' },
    { key: 'date-desc', label: 'Gabung Terbaru' },
    { key: 'date-asc', label: 'Gabung Terlama' },
  ];

  return (
    <div className="h-full animate-in fade-in slide-in-from-left-4 duration-300">
      {isEditingEmp ? (
        <Card padding="lg" className="max-w-3xl">
          <IconButton variant="neutral" label="Kembali" className="mb-4" onClick={() => setIsEditingEmp(false)}>
            <ChevronLeft className="w-5 h-5" />
          </IconButton>
          <h2 className="font-heading text-xl font-bold mb-6 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
            {empFormData.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="Nama Lengkap" variant="muted" value={empFormData.name} onChange={e => setEmpFormData({ ...empFormData, name: e.target.value })} />
            <Input label="No. Handphone (WA)" variant="muted" value={empFormData.phone} onChange={e => setEmpFormData({ ...empFormData, phone: e.target.value })} />
            <Select label="Status Karyawan" variant="muted" value={empFormData.status || 'aktif'} onChange={e => setEmpFormData({ ...empFormData, status: e.target.value })}>
              {EMPLOYEE_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </Select>
            {empFormData.status === 'resign' && (
              <Input type="date" label="Tanggal Resign" variant="muted" value={empFormData.resignDate || ''} onChange={e => setEmpFormData({ ...empFormData, resignDate: e.target.value })} />
            )}
            <div className="md:col-span-2">
              <Input label="Alamat" variant="muted" value={empFormData.address} onChange={e => setEmpFormData({ ...empFormData, address: e.target.value })} />
            </div>
            <Input type="number" label="Upah per Jam (Rp)" variant="muted" icon={<span className="font-bold">Rp</span>} value={empFormData.hourlyRate || ""} onChange={e => setEmpFormData({ ...empFormData, hourlyRate: e.target.value ? Number(e.target.value) : "" })} />
            <Input type="number" label="Bonus Full Time (Rp)" variant="muted" icon={<span className="font-bold">Rp</span>} value={empFormData.fullTimeBonus || ""} onChange={e => setEmpFormData({ ...empFormData, fullTimeBonus: e.target.value ? Number(e.target.value) : "" })} />
            <Input type="number" label="Tarif Lembur per 30 Menit (Rp)" variant="muted" icon={<span className="font-bold">Rp</span>} value={empFormData.overtimeRate30 ?? OVERTIME_RATE_PER_30MIN} onChange={e => setEmpFormData({ ...empFormData, overtimeRate30: e.target.value ? Number(e.target.value) : "" })} />
            <Input type="date" label="Mulai Kerja" variant="muted" value={empFormData.startDate} onChange={e => setEmpFormData({ ...empFormData, startDate: e.target.value })} />
          </div>
          <Button variant="primary" size="lg" onClick={handleSaveEmployee}>Simpan Data Karyawan</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Briefcase className="w-5 h-5 text-slate-700 dark:text-slate-200" /> Daftar Karyawan</h3>
            <div className="flex items-center gap-2">
              <select value={empStatusFilter} onChange={e => setEmpStatusFilter(e.target.value)} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent focus:outline-none">
                <option value="semua">Semua Status</option>
                {EMPLOYEE_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <button type="button" onClick={() => setIsEmpSortOpen(true)} className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
              <Button variant="dark" icon={<Plus className="w-4 h-4" />} onClick={() => { setEmpFormData(createEmptyEmployeeForm()); setIsEditingEmp(true); }}>
                Tambah Karyawan
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
            {sortedEmployees.map(emp => (
              <Card key={emp.id} padding="lg" className="relative group hover:shadow-md transition-shadow duration-300">
                <div className="absolute top-4 right-4 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton variant="edit" ghost onClick={() => { setEmpFormData({ status: 'aktif', resignDate: '', overtimeRate30: OVERTIME_RATE_PER_30MIN, ...emp }); setIsEditingEmp(true); }}><Edit3 className="w-4 h-4" /></IconButton>
                  <IconButton variant="delete" ghost onClick={() => handleDeleteEmployee(emp.id)}><Trash2 className="w-4 h-4" /></IconButton>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-heading font-black text-xl">{emp.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base leading-tight pr-10">{emp.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge size="sm" variant={getEmployeeStatusInfo(getEmployeeStatus(emp)).badgeVariant}>{getEmployeeStatusInfo(getEmployeeStatus(emp)).label}</Badge>
                      {currentShift?.openedByEmployeeId === emp.id && (
                        <Badge size="sm" variant="success">🟢 Sedang Jaga</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Upah/Jam:</span><span className="font-bold text-orange-600">{formatRupiah(emp.hourlyRate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-medium">Lembur/30m:</span><span className="font-bold text-orange-600">{formatRupiah(emp.overtimeRate30 || OVERTIME_RATE_PER_30MIN)}</span></div>
                </div>
              </Card>
            ))}
          </div>
          <SortModal isOpen={isEmpSortOpen} onClose={() => setIsEmpSortOpen(false)} value={empSortKey} onChange={setEmpSortKey} options={empListSortOptions} />
        </div>
      )}
    </div>
  );
};

export default ManageEmployeesTab;