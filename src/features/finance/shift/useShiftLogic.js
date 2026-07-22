import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { isNativePlatform } from '../../../library/printer';
import { toPng, toBlob } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { generateUUID, toLocalMonthString, toLocalDateString } from '../../../utils/formatters';
import { markDeleted, restoreItem, activeOnly, trashedOnly } from '../../../utils/softDelete';
import { pushTransactionDelete, pushLiveState } from '../../../storage/realtimeSync';
import { applySort } from '../../../utils/sortUtils';
import { useBulkSelect } from '../../../hook/useBulkSelect';
import { getActiveCouriers } from '../../hrd/utils/payrollLogic';
import {
  computeAllCourierBalances,
  isCourierHolder,
  CASH_TRANSFER_TYPE_WRITEOFF,
  isWriteoffTransfer,
  CASH_TRANSFER_TYPE_REIMBURSE
} from '../../../utils/cashHolders';

// Opsi sorting utk Riwayat Shift — dipakai oleh <SortModal> di ShiftView.jsx.
// Statis (gak butuh state), jadi diekspor terpisah dari hook-nya.
export const sortOptions = [
  { key: 'date-desc', label: 'Terbaru Dulu' },
  { key: 'date-asc', label: 'Terlama Dulu' },
  { key: 'id-asc', label: 'ID Dompet (A-Z)' },
  { key: 'id-desc', label: 'ID Dompet (Z-A)' },
  { key: 'difference-desc', label: 'Selisih Terbesar' },
];

// Semua state + useMemo + handler punya ShiftView, diekstrak ke custom hook
// biar ShiftView.jsx & ShiftModals.jsx tinggal konsumsi hasilnya (bukan
// duplikasi logic). Urutan & isi PERSIS sama dengan ShiftView.jsx versi lama
// (1753 baris) — cuma dipindah lokasi, gak ada perubahan perilaku.
export function useShiftLogic() {
  const {
    currentShift, setCurrentShift, shiftHistory, setShiftHistory,
    salesHistory, expenses, incomes, formatRupiah, triggerAlert, triggerConfirm,
    storeSettings, isAdminMode, employees, cashTransfers, setCashTransfers
  } = useAppContext();

  const [initialCashInput, setInitialCashInput] = useState('');
  const [openedByEmployeeId, setOpenedByEmployeeId] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [showXReading, setShowXReading] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState(null);

  // State untuk Fitur Edit (Khusus Admin)
  const [editingShift, setEditingShift] = useState(null);
  const [editActualCashInput, setEditActualCashInput] = useState('');
  const [editInitialCashInput, setEditInitialCashInput] = useState('');

  // State untuk Fitur Edit Saldo Awal pada Shift yang SEDANG AKTIF (Khusus Admin)
  const [isEditingActiveInitial, setIsEditingActiveInitial] = useState(false);
  const [editActiveInitialInput, setEditActiveInitialInput] = useState('');

  // Filter tanggal untuk Rekapitulasi Riwayat Shift di Bagian Bawah
  const [filterMode, setFilterMode] = useState('hari-ini'); // 'hari-ini' | 'kemarin' | 'bulan-ini' | 'semua' | 'tanggal-terpilih'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showTrash, setShowTrash] = useState(false); // toggle: riwayat normal vs recycle bin
  const [showCourierLog, setShowCourierLog] = useState(false); // toggle admin-only: riwayat setoran kurir
  const [sortKey, setSortKey] = useState('date-desc'); // dipasangin ke applySort
  const [isSortOpen, setIsSortOpen] = useState(false); // toggle buka SortModal
  const [isSelecting, setIsSelecting] = useState(false); // toggle mode "Pilih" utk bulk delete

  // State utk Modal Setor Sebagian (Kurir -> Dompet)
  const [depositTarget, setDepositTarget] = useState(null); // { employeeId, employeeName } | null
  const [partialDepositInput, setPartialDepositInput] = useState('');
  const [isDepositSubmitting, setIsDepositSubmitting] = useState(false); // anti double-submit

  // State utk Modal Hapus Setoran (write-off saldo kurir yang hilang/gak
  // balik — TIDAK menaikkan Saldo Dompet, beda dari Setor. Khusus Admin,
  // lihat isAdminMode check di tombol pemicunya).
  const [writeoffTarget, setWriteoffTarget] = useState(null); // { employeeId, employeeName } | null
  const [writeoffInput, setWriteoffInput] = useState('');
  const [isWriteoffSubmitting, setIsWriteoffSubmitting] = useState(false); // anti double-submit

  // State utk Modal Ganti Uang (reimburse) — kebalikan dari Setor: dipakai
  // saat saldo kurir NEGATIF (kurir nombokin belanja pakai duit pribadi
  // karena saldo COD-nya gak cukup). Kasir ganti uang kurir dari laci
  // -> saldo kurir naik balik ke 0 (atau mendekati), DAN Saldo Dompet
  // TURUN sejumlah yang diganti (uang beneran keluar dari laci fisik).
  // Dicatat sebagai cashTransfers dgn type: 'reimburse', amount NEGATIF
  // (kebalikan tanda dari deposit/writeoff) supaya computeCourierBalance
  // otomatis benar tanpa perlu cabang logic baru (lihat catatan di
  // utils/cashHolders.js).
  const [reimburseTarget, setReimburseTarget] = useState(null); // { employeeId, employeeName } | null
  const [reimburseInput, setReimburseInput] = useState('');
  const [isReimburseSubmitting, setIsReimburseSubmitting] = useState(false); // anti double-submit

  const handleShareImage = async () => {
    const reportElement = document.getElementById('xreading-content');
    if (!reportElement) {
      alert('Error: Elemen laporan tidak ditemukan.');
      return;
    }

    try {
      if (isNativePlatform()) {
        const dataUrl = await toPng(reportElement, {
          backgroundColor: '#ffffff',
          pixelRatio: 3,
          skipAutoScale: true,
          style: { width: '300px' }
        });

        const base64Data = dataUrl.split(',')[1];
        const fileName = `laporan-shift-${closedShiftData.id}-${Date.now()}.png`;

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Laporan Tutup Dompet',
          text: `Berikut adalah Laporan Tutup Dompet (ID: ${closedShiftData.id})`,
          url: savedFile.uri,
          dialogTitle: 'Bagikan Laporan via'
        });
      } else {
        const blob = await toBlob(reportElement, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          skipAutoScale: true,
          style: { width: '300px' }
        });

        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `laporan-shift-${closedShiftData.id}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Log Error Asli:', error);
      if (error.name !== 'AbortError') alert(`GAGAL SHARE!\n\nPesan Error: ${error.message || JSON.stringify(error)}`);
    }
  };

  // Uang Tunai di Kurir — saldo cash yang masih di luar laci kasir
  // (dipegang kurir dari COD Delivery, belum disetor). Angka ini DIPAKAI
  // buat ngitung expectedCash/Saldo Akhir Dompet di shiftStats di bawah
  // (expectedCash = Total Kas Bisnis - totalHeldByCouriers) — jadi begitu
  // kurir setor & saldo dia turun/nol, Saldo Akhir Dompet otomatis naik
  // tanpa perlu tracking transaksi setoran secara terpisah.
  // Logic hitungnya sama persis dgn yang dulu dipakai di halaman Setoran
  // Kurir (lihat utils/cashHolders.js).
  //
  // SENGAJA TIDAK di-clamp ke 0 per kurir. Kalau kurir belanja pakai uang
  // pribadinya sendiri (nombokin) karena saldo COD dia gak cukup, balance
  // dia di computeCourierBalance jadi NEGATIF — itu artinya bisnis
  // BERUTANG ke kurir, bukan "dianggap nol". Kalau di-clamp ke 0 di sini,
  // expectedCash di bawah jadi under-count: kas bisnis kelihatan lebih
  // sedikit dari yang seharusnya, padahal sebagian pengeluaran sudah
  // ditalangi kurir dari kantongnya sendiri (bukan dari kas fisik toko).
  const couriers = useMemo(() => getActiveCouriers(employees), [employees]);
  const courierBalances = useMemo(() => computeAllCourierBalances(couriers, {
    expenses: activeOnly(expenses),
    salesHistory: activeOnly(salesHistory),
    cashTransfers: activeOnly(cashTransfers || []),
  }), [couriers, expenses, salesHistory, cashTransfers]);
  const totalHeldByCouriers = useMemo(
    () => courierBalances.reduce((sum, b) => sum + b.balance, 0),
    [courierBalances]
  );

  // Total Hapus Setoran (write-off) — dijumlah TERPISAH dari totalHeldByCouriers.
  // Dipakai buat ngoreksi totalCashBisnis di shiftStats: begitu ada write-off,
  // saldo kurir turun (lewat totalHeldByCouriers) SAMA seperti setoran biasa,
  // tapi duitnya beneran hilang — bukan pindah ke laci — jadi totalCashBisnis
  // (dan ujungnya expectedCash/Saldo Dompet) HARUS ikut turun sejumlah yang
  // sama, supaya write-off gak keliatan seolah nambah uang di laci kasir.
  const totalWrittenOff = useMemo(
    () => activeOnly(cashTransfers || []).filter(isWriteoffTransfer).reduce((sum, t) => sum + (t.amount || 0), 0),
    [cashTransfers]
  );

  // Tombol "Setor" — SATU-SATUNYA jalur setor kurir->dompet, selalu buka
  // popup input nominal (gak ada lagi jalur instant tanpa konfirmasi
  // nominal). Popup punya tombol "Setor Semua" buat auto-isi input dgn
  // full balance, atau kasir bisa ketik nominal custom buat setor
  // sebagian. Balance yang dipakai selalu diambil ULANG dari
  // courierBalances (live, bukan snapshot lama yang nempel di tombol) —
  // jaga-jaga kalau ada transaksi baru masuk SELAGI popup ini kebuka
  // (hole #4).
  const handleOpenDeposit = (balanceEntry) => {
    setDepositTarget({ employeeId: balanceEntry.employeeId, employeeName: balanceEntry.employeeName });
    setPartialDepositInput('');
  };

  const handleConfirmPartialDeposit = () => {
    if (!depositTarget || isDepositSubmitting) return; // hole #2: cegah double-submit

    // Re-fetch balance TERKINI, bukan yang di-snapshot pas modal dibuka.
    const liveEntry = courierBalances.find(b => b.employeeId === depositTarget.employeeId);
    const liveBalance = Math.max(liveEntry?.balance || 0, 0);

    const amount = Number(partialDepositInput);

    // hole #3: nominal wajib > 0
    if (!partialDepositInput || !Number.isFinite(amount) || amount <= 0) {
      triggerAlert('Nominal setoran harus lebih dari Rp 0.');
      return;
    }
    // hole #1: gak boleh setor melebihi saldo yang beneran tercatat
    if (amount > liveBalance) {
      triggerAlert(`Nominal melebihi saldo ${depositTarget.employeeName} saat ini (${formatRupiah(liveBalance)}).`);
      return;
    }

    setIsDepositSubmitting(true);
    const isFull = amount === liveBalance;
    const sisaSetelahSetor = liveBalance - amount;

    const newTransfer = {
      id: generateUUID(),
      employeeId: depositTarget.employeeId,
      employeeName: depositTarget.employeeName,
      amount,
      // hole #6: note dibedain biar riwayat tetap keauditkan meski ada
      // beberapa kali setoran sebagian dari kurir yang sama dalam sehari.
      note: isFull ? 'Setoran penuh dari Dompet' : `Setoran sebagian dari Dompet (sisa ${formatRupiah(sisaSetelahSetor)})`,
      date: new Date(),
    };
    setCashTransfers([newTransfer, ...cashTransfers]);
    triggerAlert(
      isFull
        ? `Saldo ${depositTarget.employeeName} sebesar ${formatRupiah(amount)} berhasil dipindah ke Dompet.`
        : `${formatRupiah(amount)} dari saldo ${depositTarget.employeeName} dipindah ke Dompet. Sisa: ${formatRupiah(sisaSetelahSetor)}.`
    );

    setIsDepositSubmitting(false);
    setDepositTarget(null);
    setPartialDepositInput('');
  };

  // Tombol "Hapus" — buka popup Hapus Setoran (write-off saldo kurir),
  // khusus Admin. Sama pola dengan handleOpenDeposit: hanya nyimpen
  // employeeId/employeeName ke state, nominal live selalu diambil ULANG
  // dari courierBalances pas modal render (lihat handleConfirmWriteoff).
  const handleOpenWriteoff = (balanceEntry) => {
    setWriteoffTarget({ employeeId: balanceEntry.employeeId, employeeName: balanceEntry.employeeName });
    setWriteoffInput('');
  };

  const handleConfirmWriteoff = () => {
    if (!writeoffTarget || isWriteoffSubmitting) return;

    const liveEntry = courierBalances.find(b => b.employeeId === writeoffTarget.employeeId);
    const liveBalance = Math.max(liveEntry?.balance || 0, 0);

    const amount = Number(writeoffInput);

    if (!writeoffInput || !Number.isFinite(amount) || amount <= 0) {
      triggerAlert('Nominal yang dihapus harus lebih dari Rp 0.');
      return;
    }
    if (amount > liveBalance) {
      triggerAlert(`Nominal melebihi saldo ${writeoffTarget.employeeName} saat ini (${formatRupiah(liveBalance)}).`);
      return;
    }

    setIsWriteoffSubmitting(true);
    const isFull = amount === liveBalance;
    const sisaSetelahHapus = liveBalance - amount;

    // type: 'writeoff' — beda dari setoran biasa: turunin saldo kurir
    // TAPI TIDAK menaikkan Saldo Akhir Dompet (lihat shiftStats di bawah,
    // totalCashBisnis dikurangi totalWrittenOff persis supaya efeknya
    // gak nyampur ke expectedCash/laci kasir).
    const newTransfer = {
      id: generateUUID(),
      employeeId: writeoffTarget.employeeId,
      employeeName: writeoffTarget.employeeName,
      amount,
      type: CASH_TRANSFER_TYPE_WRITEOFF,
      note: isFull ? 'Hapus setoran (write-off, uang hilang/tidak balik)' : `Hapus setoran sebagian (write-off, sisa ${formatRupiah(sisaSetelahHapus)})`,
      date: new Date(),
    };
    setCashTransfers([newTransfer, ...cashTransfers]);
    triggerAlert(
      isFull
        ? `Saldo ${writeoffTarget.employeeName} sebesar ${formatRupiah(amount)} dihapus (dicatat sebagai kerugian).`
        : `${formatRupiah(amount)} dari saldo ${writeoffTarget.employeeName} dihapus. Sisa: ${formatRupiah(sisaSetelahHapus)}.`
    );

    setIsWriteoffSubmitting(false);
    setWriteoffTarget(null);
    setWriteoffInput('');
  };

  // Tombol "Ganti Uang" — buka popup Reimburse, buat kurir yang saldonya
  // NEGATIF (nombokin belanja bisnis pakai duit pribadi). Beda dari
  // handleOpenDeposit/handleOpenWriteoff: di sini liveBalance yang relevan
  // justru saldo negatifnya (jumlah yang harus diganti kasir), BUKAN
  // di-clamp ke 0 — kalau di-clamp, gak akan pernah ada nominal yang valid
  // buat diganti.
  const handleOpenReimburse = (balanceEntry) => {
    setReimburseTarget({ employeeId: balanceEntry.employeeId, employeeName: balanceEntry.employeeName });
    setReimburseInput('');
  };

  const handleConfirmReimburse = () => {
    if (!reimburseTarget || isReimburseSubmitting) return;

    // Re-fetch balance TERKINI (pola sama kayak deposit/writeoff, hole #4).
    // Saldo yang relevan di sini adalah UTANG bisnis ke kurir, yaitu nilai
    // absolut dari balance negatif. Kalau ternyata balance udah gak lagi
    // negatif (misal ada transaksi lain masuk selagi modal terbuka), utang
    // dianggap 0 — gak ada yang perlu diganti.
    const liveEntry = courierBalances.find(b => b.employeeId === reimburseTarget.employeeId);
    const liveDebt = liveEntry && liveEntry.balance < 0 ? Math.abs(liveEntry.balance) : 0;

    const amount = Number(reimburseInput);

    if (!reimburseInput || !Number.isFinite(amount) || amount <= 0) {
      triggerAlert('Nominal yang diganti harus lebih dari Rp 0.');
      return;
    }
    if (amount > liveDebt) {
      triggerAlert(`Nominal melebihi utang ke ${reimburseTarget.employeeName} saat ini (${formatRupiah(liveDebt)}).`);
      return;
    }

    setIsReimburseSubmitting(true);
    const isFull = amount === liveDebt;
    const sisaUtangSetelahGanti = liveDebt - amount;

    // type: 'reimburse', amount NEGATIF — lihat catatan lengkap di
    // utils/cashHolders.js soal kenapa tandanya dibalik: biar formula
    // `deposited = sum(amount)` di computeCourierBalance otomatis
    // MENAMBAH saldo kurir (menutup defisitnya) tanpa cabang logic baru,
    // dan efeknya ke expectedCash (Saldo Dompet turun karena kasir
    // beneran ngeluarin uang tunai) juga otomatis benar lewat
    // totalHeldByCouriers, tanpa perlu variabel koreksi terpisah seperti
    // totalWrittenOff.
    const newTransfer = {
      id: generateUUID(),
      employeeId: reimburseTarget.employeeId,
      employeeName: reimburseTarget.employeeName,
      amount: -amount,
      type: CASH_TRANSFER_TYPE_REIMBURSE,
      note: isFull
        ? 'Ganti uang kurir (reimburse, lunas)'
        : `Ganti uang kurir sebagian (reimburse, sisa utang ${formatRupiah(sisaUtangSetelahGanti)})`,
      date: new Date(),
    };
    setCashTransfers([newTransfer, ...cashTransfers]);
    triggerAlert(
      isFull
        ? `Utang ke ${reimburseTarget.employeeName} sebesar ${formatRupiah(amount)} sudah diganti (lunas).`
        : `${formatRupiah(amount)} sudah diganti ke ${reimburseTarget.employeeName}. Sisa utang: ${formatRupiah(sisaUtangSetelahGanti)}.`
    );

    setIsReimburseSubmitting(false);
    setReimburseTarget(null);
    setReimburseInput('');
  };

  // Tutup Saldo Lama — nolin saldo kurir yang kebawa dari SEBELUM hari ini
  // (bukan dihapus, tapi dicatat sebagai transaksi cashTransfers normal
  // bernote jelas, biar tetap keauditkan & muncul di Riwayat Setoran —
  // lihat toggle "Riwayat Setoran" khusus admin di bagian Riwayat bawah).
  // Saldo dari transaksi HARI INI sengaja TIDAK disentuh — biar gak
  // nge-reset uang yang belum sempat beneran disetor/dilaporkan.
  //
  // Dipanggil otomatis tiap kali "Buka Dompet" (lihat handleOpenShift) —
  // karena di lapangan setoran fisik sering kejadian tanpa sempat dicatat,
  // jadi ganti hari = anggap lunas.
  const closeStaleCourierBalances = ({ silent = false } = {}) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const priorExpenses = activeOnly(expenses).filter(e => new Date(e.date) < startOfToday);
    const priorSales = activeOnly(salesHistory).filter(s => new Date(s.date) < startOfToday);
    const priorTransfers = activeOnly(cashTransfers || []).filter(t => new Date(t.date) < startOfToday);

    const staleBalances = computeAllCourierBalances(couriers, {
      expenses: priorExpenses,
      salesHistory: priorSales,
      cashTransfers: priorTransfers,
    }).filter(b => b.balance > 0);

    if (staleBalances.length === 0) {
      if (!silent) triggerAlert('Tidak ada saldo kurir dari hari sebelumnya yang perlu ditutup.');
      return;
    }

    const closingTransfers = staleBalances.map(b => ({
      id: generateUUID(),
      employeeId: b.employeeId,
      employeeName: b.employeeName,
      amount: b.balance,
      note: 'Penutupan saldo lama (otomatis/manual, bukan setoran fisik tercatat)',
      date: new Date(),
    }));

    setCashTransfers([...closingTransfers, ...cashTransfers]);

    if (!silent) {
      const rincian = staleBalances.map(b => `${b.employeeName}: ${formatRupiah(b.balance)}`).join(', ');
      triggerAlert(`Saldo lama ditutup (${rincian}).`);
    }
  };

  // Calculate stats for current shift
  const shiftStats = useMemo(() => {
    if (!currentShift) return null;
    const start = currentShift.startTime;

    // Batas HARI (local midnight) shift dibuka — khusus dipakai buat filter
    // Pemasukan & Pengeluaran, BUKAN `start` yang presisi jam-menit-detik.
    // Sebabnya: ExpenseView/IncomeView cuma punya input TANGGAL (gak ada
    // jam), jadi field `date`-nya selalu tersimpan sebagai local midnight
    // 00:00 lewat parseLocalDate(). Kalau dibandingkan langsung ke `start`
    // (jam persis shift dibuka, mis. 08:00), maka 00:00 >= 08:00 SELALU
    // false → transaksi yang dicatat "hari ini" gak akan pernah kehitung
    // masuk shift yang lagi jalan (ini penyebab pengeluaran & pemasukan
    // gak muncul di Dompet). Penjualan (shiftSales) TETAP pakai `start`
    // presisi jam karena timestamp-nya emang jam asli waktu checkout.
    const shiftStartDate = new Date(start);
    const startOfShiftDay = new Date(shiftStartDate.getFullYear(), shiftStartDate.getMonth(), shiftStartDate.getDate());

    // Penjualan Tunai — SEMUA cash sale, kasir MAUPUN kurir COD. Di level
    // ini kita hitung "Total Kas Bisnis" (bukan laci kasir doang), jadi
    // duit COD kurir tetap dihitung sebagai pemasukan cash yang sah —
    // cuma lokasinya belum tentu di laci. Pemisahan "yang masih di tangan
    // kurir" diurus BELAKANGAN lewat pengurangan totalHeldByCouriers di
    // bawah (satu titik saja), BUKAN dengan exclude manual per record di
    // sini — biar gak ada 2 tempat yang harus saling sinkron soal
    // "kurir vs bukan kurir".
    const shiftSales = activeOnly(salesHistory).filter(s => new Date(s.date) >= start);
    let cashSalesTotal = 0;
    shiftSales.forEach(sale => {
      if (sale.paymentMethod === 'Tunai') cashSalesTotal += sale.total;
      else if (sale.paymentMethod === 'Split Payment') {
        sale.splitDetails.forEach(p => { if (p.method === 'Tunai') cashSalesTotal += p.amount; });
      }
    });

    // Pemasukan & Pengeluaran (Tunai) — sama, level Total Kas Bisnis.
    // Pengeluaran yang dibayar pakai cash kurir (cashHolder: kurir, misal
    // kurir belanja sebelum sempat setor) TETAP ikut kehitung di
    // totalCashBisnis (bukan di-exclude), karena itu tetap pengeluaran
    // cash bisnis yang sah — pemisahan lokasinya (siapa yang megang)
    // diurus lewat totalHeldByCouriers. TAPI buat keterangan di UI,
    // kasir & kurir dipisah jadi 2 baris sendiri (bukan digabung jadi
    // satu angka "Pengeluaran") biar kasir bisa lihat jelas mana yang
    // keluar dari lacinya sendiri vs mana yang dipotong dari saldo kurir.
    const shiftIncomes = activeOnly(incomes).filter(i => new Date(i.date) >= startOfShiftDay);
    const shiftExpenses = activeOnly(expenses).filter(e => new Date(e.date) >= startOfShiftDay && (e.paymentMethod || 'Tunai') === 'Tunai');
    const shiftExpensesKasir = shiftExpenses.filter(e => !isCourierHolder(e));
    const shiftExpensesKurir = shiftExpenses.filter(e => isCourierHolder(e));

    const cashIncomeTotal = shiftIncomes.reduce((s, i) => s + i.amount, 0);
    const cashExpenseKasirTotal = shiftExpensesKasir.reduce((s, e) => s + e.amount, 0);
    const cashExpenseKurirTotal = shiftExpensesKurir.reduce((s, e) => s + e.amount, 0);
    const cashExpenseTotal = cashExpenseKasirTotal + cashExpenseKurirTotal;

    // Total Kas Bisnis — gabungan laci kasir + yang masih di tangan kurir,
    // murni cash-basis, gak peduli lokasi fisiknya di mana saat ini.
    // Dikurangi totalWrittenOff (Hapus Setoran) — itu uang yang beneran
    // hilang dari bisnis (bukan cuma "belum disetor"), jadi harus ikut
    // ngurangin Total Kas Bisnis juga, BUKAN cuma totalHeldByCouriers.
    // Tanpa pengurangan ini, expectedCash di bawah bakal seolah-olah naik
    // tiap ada write-off — padahal duitnya gak pernah masuk laci.
    const totalCashBisnis = currentShift.initialCash + cashSalesTotal + cashIncomeTotal - cashExpenseTotal - totalWrittenOff;

    // Saldo Akhir (Laci Kasir) = Total Kas Bisnis - Saldo yang MASIH
    // dipegang kurir (belum disetor). Ini SATU-SATUNYA rumus buat nentuin
    // laci kasir. Konsekuensinya otomatis benar tanpa perlu tracking
    // manual: begitu kurir setor (tombol "Setor" nge-nolin saldo dia di
    // totalHeldByCouriers), expectedCash di sini OTOMATIS naik sejumlah
    // yang disetor — gak perlu nambahin cashTransfers sebagai baris
    // terpisah lagi. Konsekuensi lain: kalau kurir BELUM setor,
    // otomatis ke-exclude dari laci kasir juga tanpa perlu filter manual
    // per record sales/expenses di atas.
    //
    // Catatan: totalHeldByCouriers TIDAK di-scope ke jam mulai shift ini
    // (dia running balance real-time, lihat computeAllCourierBalances di
    // atas) — sengaja begitu, karena saldo kurir itu murni carry-over
    // sampai BENERAN disetor lewat tombol "Setor" (lihat handleOpenDeposit
    // & handleConfirmPartialDeposit). Tidak ada reset
    // otomatis lintas hari maupun lintas shift — kasir/kurir yang
    // menentukan kapan setoran dicatat, bukan sistem.
    const expectedCash = totalCashBisnis - totalHeldByCouriers;

    return {
      initialCash: currentShift.initialCash,
      cashSales: cashSalesTotal,
      cashIncomes: cashIncomeTotal,
      cashExpenses: cashExpenseTotal,
      cashExpensesKasir: cashExpenseKasirTotal,
      cashExpensesKurir: cashExpenseKurirTotal,
      totalCashBisnis,
      expectedCash
    };
  }, [currentShift, salesHistory, expenses, incomes, totalHeldByCouriers, totalWrittenOff]);

  // Deteksi dompet yang kebawa nginap dari hari sebelumnya (kemungkinan kasir lupa nutup).
  // Sengaja pakai perbandingan TANGGAL, bukan jumlah jam, karena shift resto
  // bisa aja legit jalan lama dalam satu hari kalender yang sama.
  const isShiftCarriedOver = useMemo(() => {
    if (!currentShift) return false;
    const start = new Date(currentShift.startTime);
    const now = new Date();
    return start.toDateString() !== now.toDateString();
  }, [currentShift]);

  const handleOpenShift = () => {
    if (!initialCashInput || Number(initialCashInput) < 0) return triggerAlert('Masukkan nominal saldo awal yang valid.');
    const selectedEmployee = employees?.find(e => e.id === openedByEmployeeId);
    const newShift = {
      id: `DOMPET-${generateUUID().split('-')[0].toUpperCase()}`,
      startTime: new Date(),
      initialCash: Number(initialCashInput),
      openedByEmployeeId: selectedEmployee?.id || null,
      openedByEmployeeName: selectedEmployee?.name || null,
    };
    setCurrentShift(newShift);
    closeStaleCourierBalances({ silent: true }); // ganti hari = saldo kurir kemarin dianggap lunas
    pushLiveState('currentShift', newShift).catch(err =>
      console.warn('Gagal push manual :', err)
    );
    setInitialCashInput('');
    setOpenedByEmployeeId('');
    triggerAlert('Dompet berhasil dibuka!');
  };

  const handleCloseShift = () => {
    if (!actualCashInput || Number(actualCashInput) < 0) return triggerAlert('Masukkan uang aktual yang ada di dompet');

    const actualCash = Number(actualCashInput);
    const difference = actualCash - shiftStats.expectedCash;

    const shiftData = {
      ...currentShift,
      endTime: new Date(),
      stats: shiftStats,
      actualCash,
      difference
    };

    triggerConfirm(`Apakah Anda yakin ingin menutup dompet ini? Semua transaksi selanjutnya tidak akan terekap di dompet ini.`, () => {
      const filteredHistory = shiftHistory.filter(s => s.id !== shiftData.id);
      setShiftHistory([shiftData, ...filteredHistory]);
      setCurrentShift(null);
      pushLiveState('currentShift', null).catch(err =>
        console.warn('Gagal push manual close shift:', err)
      );
      setClosedShiftData(shiftData);
      setActualCashInput('');
      setShowXReading(true);
    });
  };

  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setEditActualCashInput(shift.actualCash.toString());
    setEditInitialCashInput((shift.stats?.initialCash ?? 0).toString());
  };

  const handleSaveEdit = () => {
    if (!editActualCashInput || Number(editActualCashInput) < 0) {
      return triggerAlert('Masukkan nominal uang aktual yang valid.');
    }
    if (editInitialCashInput === '' || Number(editInitialCashInput) < 0) {
      return triggerAlert('Masukkan nominal saldo awal yang valid.');
    }

    triggerConfirm(`Apakah Anda yakin ingin menyimpan perubahan pada laporan ${editingShift.id}?`, () => {
      const newActualCash = Number(editActualCashInput);
      const newInitialCash = Number(editInitialCashInput);

      // Saldo awal berubah → recalculate expectedCash berdasarkan delta-nya,
      // komponen lain (penjualan/pemasukan/pengeluaran) tidak berubah.
      const initialDelta = newInitialCash - (editingShift.stats?.initialCash ?? 0);
      const newExpectedCash = (editingShift.stats?.expectedCash ?? 0) + initialDelta;
      const newDifference = newActualCash - newExpectedCash;

      const updatedShift = {
        ...editingShift,
        stats: {
          ...editingShift.stats,
          initialCash: newInitialCash,
          expectedCash: newExpectedCash
        },
        actualCash: newActualCash,
        difference: newDifference
      };

      const updatedHistory = shiftHistory.map(s => s.id === updatedShift.id ? updatedShift : s);

      setShiftHistory(updatedHistory);
      triggerAlert(`Data laporan ${updatedShift.id} berhasil diperbarui.`);
      setEditingShift(null);
    });
  };

  // --- Edit Saldo Awal untuk Shift yang SEDANG BERJALAN (currentShift) ---
  const handleOpenEditActiveInitial = () => {
    setEditActiveInitialInput((currentShift?.initialCash ?? 0).toString());
    setIsEditingActiveInitial(true);
  };

  const handleSaveActiveInitial = () => {
    if (editActiveInitialInput === '' || Number(editActiveInitialInput) < 0) {
      return triggerAlert('Masukkan nominal saldo awal yang valid.');
    }

    const newInitialCash = Number(editActiveInitialInput);

    triggerConfirm('Apakah Anda yakin ingin mengoreksi Saldo Awal dompet yang sedang berjalan ini?', () => {
      const updatedShift = { ...currentShift, initialCash: newInitialCash };
      setCurrentShift(updatedShift);
      pushLiveState('currentShift', updatedShift).catch(err =>
        console.warn('Gagal push manual koreksi saldo awal:', err)
      );
      triggerAlert('Saldo Awal dompet berhasil dikoreksi.');
      setIsEditingActiveInitial(false);
    });
  };

  const handleDeleteShift = (id) => {
    triggerConfirm('Pindahkan data dompet ini ke Recycle Bin?', () => {
      setShiftHistory(shiftHistory.map(shift => shift.id === id ? markDeleted(shift) : shift));
      triggerAlert('Data dipindahkan ke Recycle Bin.');
    });
  };

  // Hapus 1 baris riwayat setoran kurir (koreksi kalau kasir/admin salah
  // catat) — soft-delete konsisten sama pola recycle bin di seluruh app
  // (activeOnly() di list Riwayat Setoran Kurir otomatis nyembunyiin ini).
  // Beda dari shift, sengaja gak dikasih recycle bin terpisah di sini
  // karena penggunaannya cuma buat koreksi cepat, bukan alur audit shift.
  const handleDeleteCourierTransfer = (id) => {
    triggerConfirm('Hapus baris setoran ini? Saldo kurir terkait akan otomatis kehitung ulang.', () => {
      setCashTransfers(cashTransfers.map(t => t.id === id ? markDeleted(t) : t));
      triggerAlert('Baris setoran dihapus.');
    });
  };

  const handleRestoreShift = (id) => {
    setShiftHistory(shiftHistory.map(shift => shift.id === id ? restoreItem(shift) : shift));
    triggerAlert('Data berhasil dikembalikan.');
  };

  const handlePermanentDeleteShift = (id) => {
    triggerConfirm('Hapus PERMANEN data dompet ini? Tindakan ini tidak bisa dibatalkan.', () => {
      setShiftHistory(shiftHistory.filter(shift => shift.id !== id));
      // Langsung kirim delete ke Supabase saat ini juga, gak nunggu siklus
      // auto-sync 15 menit & gak peduli toggle-nya nyala/mati.
      pushTransactionDelete('shiftHistory', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      );
      triggerAlert('Data dihapus permanen.');
    });
  };

  // Cek apakah tanggal shift (startTime) lolos filter aktif.
  // Perbandingan rentang tanggal pakai string "YYYY-MM-DD" langsung (toLocalDateString),
  // aman dibandingkan leksikografis tanpa perlu konversi ke Date/timestamp.
  const matchesDateFilter = (date) => {
    const d = toLocalDateString(date);
    if (filterMode === 'semua') return true;
    if (filterMode === 'hari-ini') return d === toLocalDateString();
    if (filterMode === 'kemarin') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return d === toLocalDateString(yesterday);
    }
    if (filterMode === 'bulan-ini') return toLocalMonthString(date) === toLocalMonthString();
    if (filterMode === 'tanggal-terpilih') {
      if (!filterStartDate) return true;
      // Hybrid: kalau filterEndDate kosong, otomatis single-day (= filterStartDate)
      const end = filterEndDate || filterStartDate;
      return d >= filterStartDate && d <= end;
    }
    return true;
  };

  const filteredShiftHistory = useMemo(() => {
    const source = showTrash ? trashedOnly(shiftHistory) : activeOnly(shiftHistory);
    return source.filter(shift => matchesDateFilter(shift.startTime));
  }, [shiftHistory, filterMode, filterStartDate, filterEndDate, showTrash]);

  // Urutkan hasil filter pakai sortKey terpilih (gak ngubah rekapShiftStats, cuma urutan tampil)
  const sortedShiftHistory = useMemo(() => applySort(filteredShiftHistory, sortKey, {
    date: s => new Date(s.startTime),
    id: s => s.id || '',
    difference: s => s.difference || 0,
  }), [filteredShiftHistory, sortKey]);

  // Bulk select untuk checkbox "Pilih Semua" & "Hapus Terpilih"
  const { selectedIds, allSelected, toggleOne: toggleSelectOne, toggleAll: toggleSelectAll, reset: resetSelection, count } = useBulkSelect(sortedShiftHistory);

  // Hapus Banyak SEKALIGUS (Pindah ke Recycle Bin)
  const handleBulkSoftDeleteShift = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Pindahkan ${ids.length} data dompet terpilih ke Recycle Bin?`, () => {
      setShiftHistory(shiftHistory.map(shift => selectedIds.has(shift.id) ? markDeleted(shift) : shift));
      resetSelection();
      triggerAlert('Data terpilih dipindahkan ke Recycle Bin.');
    });
  };

  // Hapus Banyak SEKALIGUS (Permanen di Recycle Bin)
  const handleBulkPermanentDeleteShift = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    triggerConfirm(`Hapus PERMANEN ${ids.length} data dompet terpilih? Tindakan ini tidak bisa dibatalkan.`, () => {
      setShiftHistory(shiftHistory.filter(shift => !selectedIds.has(shift.id)));
      ids.forEach(id => pushTransactionDelete('shiftHistory', id).catch(err =>
        console.warn('[recycle bin] gagal hapus permanen di cloud:', err?.message)
      ));
      resetSelection();
      triggerAlert('Data terpilih dihapus permanen.');
    });
  };

  const rekapShiftStats = useMemo(() => {
    let totalInitial = 0;
    let totalSales = 0;
    let totalIncomes = 0;
    let totalExpenses = 0;
    let totalExpected = 0;
    let totalActual = 0;
    let totalDifference = 0;

    filteredShiftHistory.forEach(shift => {
      totalInitial += shift.stats.initialCash || 0;
      totalSales += shift.stats.cashSales || 0;
      totalIncomes += shift.stats.cashIncomes || 0;
      totalExpenses += shift.stats.cashExpenses || 0;
      totalExpected += shift.stats.expectedCash || 0;
      totalActual += shift.actualCash || 0;
      totalDifference += shift.difference || 0;
    });

    return {
      totalInitial, totalSales, totalIncomes, totalExpenses, totalExpected, totalActual, totalDifference
    };
  }, [filteredShiftHistory]);

  return {
    // Passthrough dari AppContext yang dipakai render layer (ShiftView.jsx / ShiftModals.jsx)
    currentShift, shiftHistory, formatRupiah, storeSettings, isAdminMode, employees, cashTransfers,

    // Halaman utama (buka dompet / kartu aktif)
    initialCashInput, setInitialCashInput,
    openedByEmployeeId, setOpenedByEmployeeId,
    actualCashInput, setActualCashInput,
    isShiftCarriedOver,
    handleOpenShift, handleCloseShift,
    handleOpenEditActiveInitial,

    // X-Reading
    showXReading, setShowXReading,
    closedShiftData, setClosedShiftData,
    handleShareImage,

    // Saldo & aksi kurir (dipakai halaman utama utk trigger, & ShiftModals utk isi form)
    couriers, courierBalances, totalHeldByCouriers,
    handleOpenDeposit, handleConfirmPartialDeposit, isDepositSubmitting,
    handleOpenWriteoff, handleConfirmWriteoff, isWriteoffSubmitting,
    handleOpenReimburse, handleConfirmReimburse, isReimburseSubmitting,
    depositTarget, setDepositTarget, partialDepositInput, setPartialDepositInput,
    writeoffTarget, setWriteoffTarget, writeoffInput, setWriteoffInput,
    reimburseTarget, setReimburseTarget, reimburseInput, setReimburseInput,

    // Shift stats (dipakai halaman utama & modal edit saldo awal aktif)
    shiftStats,

    // Modal edit (khusus Admin)
    editingShift, setEditingShift,
    editActualCashInput, setEditActualCashInput,
    editInitialCashInput, setEditInitialCashInput,
    handleOpenEditModal, handleSaveEdit,
    isEditingActiveInitial, setIsEditingActiveInitial,
    editActiveInitialInput, setEditActiveInitialInput,
    handleSaveActiveInitial,

    // Riwayat: filter, sort, trash, bulk select
    filterMode, setFilterMode,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    showTrash, setShowTrash,
    showCourierLog, setShowCourierLog,
    sortKey, setSortKey,
    isSortOpen, setIsSortOpen,
    isSelecting, setIsSelecting,
    filteredShiftHistory, sortedShiftHistory, rekapShiftStats,
    selectedIds, allSelected, toggleSelectOne, toggleSelectAll, resetSelection, count,
    handleDeleteShift, handleRestoreShift, handlePermanentDeleteShift,
    handleBulkSoftDeleteShift, handleBulkPermanentDeleteShift,
    handleDeleteCourierTransfer,
  };
}