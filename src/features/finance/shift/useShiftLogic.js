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
  computeLocationBalance,
  getCourierBalanceTargets,
  isCourierHolder,
  getCashHolder,
  migrateLegacyCashTransfer,
  courierLocationKey,
  isCourierLocation,
  courierIdFromLocation,
  locationLabel,
  LOCATION_DOMPET,
  LOCATION_OWNER,
  LOCATION_HILANG,
  LOCATION_CUSTOMER,
} from '../../../utils/cashHolders';

// Label & warna per lokasi — dipakai di ShiftView.jsx (dropdown form,
// chip Log Transaksi, breakdown Rincian Posisi Uang) biar konsisten di
// satu tempat, gak ke-copy paste di banyak file.
export function getLocationMeta(key) {
  if (key === LOCATION_DOMPET) return { label: 'Dompet', colorClass: 'bg-slate-400', chipClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' };
  if (key === LOCATION_OWNER) return { label: 'Owner', colorClass: 'bg-orange-400', chipClass: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' };
  if (key === LOCATION_HILANG) return { label: 'Hilang', colorClass: 'bg-red-400', chipClass: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' };
  if (key === LOCATION_CUSTOMER) return { label: 'Customer', colorClass: 'bg-emerald-400', chipClass: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' };
  if (isCourierLocation(key)) return { label: null, colorClass: 'bg-sky-400', chipClass: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10' };
  return { label: key || '-', colorClass: 'bg-slate-300', chipClass: 'text-slate-500 bg-slate-100' };
}

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

  // Tab navigasi utama ShiftView: 'aktif' (kartu buka/tutup dompet +
  // rincian posisi uang + form transaksi), 'riwayat' (rekap + daftar
  // penutupan dompet), 'log' (Log Transaksi — satu list gabungan semua
  // perpindahan uang, manual & otomatis dari penjualan/pengeluaran).
  const [activeTab, setActiveTab] = useState('aktif');

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
  const [sortKey, setSortKey] = useState('date-desc'); // dipasangin ke applySort
  const [isSortOpen, setIsSortOpen] = useState(false); // toggle buka SortModal
  const [isSelecting, setIsSelecting] = useState(false); // toggle mode "Pilih" utk bulk delete

  // State utk Card "Catat Perpindahan Uang" — SATU form generik gantiin
  // 4 modal terpisah yang dulu ada (Setor/Hapus/Ganti Uang/Setor Owner).
  // Setiap transaksi kurir sekarang cuma punya 2 field lokasi (`from`/
  // `to`), lihat model lengkap di utils/cashHolders.js. `showTransferForm`
  // ngontrol collapse/expand card-nya di ShiftView.jsx.
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmountInput, setTransferAmountInput] = useState('');
  const [transferNoteInput, setTransferNoteInput] = useState('');
  const [confirmOverdraft, setConfirmOverdraft] = useState(false); // centang "lanjutkan sebagai talangan" saat saldo `from` kurang
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false); // anti double-submit

  // State utk Modal Edit Baris Transaksi (koreksi nominal/catatan kalau
  // salah input — Admin. Baris cashTransfers juga bisa dihapus total lewat
  // handleDeleteCourierTransfer).
  const [editingTransfer, setEditingTransfer] = useState(null); // cashTransfers record | null
  const [editTransferAmountInput, setEditTransferAmountInput] = useState('');
  const [editTransferNoteInput, setEditTransferNoteInput] = useState('');


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
  const activeCouriers = useMemo(() => getActiveCouriers(employees), [employees]);

  // ═══════════════════════════════════════════════════════════════════
  // MIGRASI PERMANEN — cashTransfers format lama (type + employeeId)
  // ke format baru (from + to). Dijalankan tiap render (murah, cuma
  // dipakai kalau ada record yang BELUM py from/to — lihat
  // migrateLegacyCashTransfer di utils/cashHolders.js), tapi PENULISAN
  // balik ke state cuma terjadi SEKALI lewat useEffect di bawah, biar
  // gak infinite-loop render & biar data lama beneran diganti permanen
  // (bukan sekadar "diterjemahkan pas ditampilkan").
  // ═══════════════════════════════════════════════════════════════════
  const needsMigration = useMemo(
    () => (cashTransfers || []).some(t => t.type && !(t.from && t.to)),
    [cashTransfers]
  );
  const migratedTransfers = useMemo(
    () => (cashTransfers || []).map(migrateLegacyCashTransfer),
    [cashTransfers]
  );
  if (needsMigration) {
    // Tulis balik SEKALI — render berikutnya needsMigration otomatis
    // false (semua record udah punya from/to), gak ada loop.
    setCashTransfers(migratedTransfers);
  }
  // Ledger aktif (sudah pasti format from/to) yang dipakai SEMUA
  // perhitungan saldo di bawah — soft-delete di-filter di sini SEKALI,
  // bukan di tiap useMemo terpisah.
  const activeManualTransfers = useMemo(
    () => activeOnly(needsMigration ? migratedTransfers : (cashTransfers || [])),
    [needsMigration, migratedTransfers, cashTransfers]
  );

  // ═══════════════════════════════════════════════════════════════════
  // TRANSAKSI VIRTUAL — terjemahan on-the-fly dari salesHistory/expenses
  // jadi bentuk from/to yang SAMA dengan cashTransfers manual, TANPA
  // menulis balik ke tabel manapun (salesHistory/expenses/PosView/
  // ExpenseView TIDAK disentuh sama sekali — lihat keputusan scope
  // rombakan ini). Digabung dengan activeManualTransfers jadi SATU
  // ledger seragam yang dipakai computeLocationBalance — gak ada lagi
  // 2 sumber angka terpisah yang harus disinkronin manual (itu penyebab
  // bug "Saldo Akhir gak match sama breakdown" yang sempat kejadian pas
  // didesain di mockup).
  //   Penjualan TUNAI (kasir langsung, atau Split Payment porsi tunainya)
  //                                              -> Customer -> Dompet
  //   Penjualan Delivery COD TUNAI dibayar kurir -> Customer -> Kurir X
  //   Pengeluaran TUNAI dibayar dari laci kasir  -> Dompet -> Hilang
  //   Pengeluaran TUNAI dibayar pakai cash kurir -> Kurir X -> Hilang
  //
  // PENTING — HANYA porsi TUNAI yang masuk ledger cash ini. Penjualan/
  // pengeluaran Non-Tunai (transfer bank, dsb) SAMA SEKALI TIDAK
  // menyentuh kas fisik (Dompet/Kurir), jadi tidak boleh ikut dihitung
  // di sini. Ini SEMPAT TERLEWAT di iterasi pertama rombakan ini — semua
  // order/expense ikut dihitung apa adanya tanpa cek paymentMethod, jadi
  // penjualan Non-Tunai ikut menaikkan saldo Dompet padahal uangnya gak
  // pernah masuk laci. Sekarang match persis logic asli (shiftSales/
  // shiftExpenses sebelum rombakan): 'Tunai' penuh, 'Split Payment' cuma
  // porsi method:'Tunai' di splitDetails, dan expense filter
  // paymentMethod==='Tunai' (default 'Tunai' utk data lama tanpa field ini).
  //
  // Pemasukan Non-Penjualan (`incomes`) BELUM diterjemahkan ke ledger
  // ini (behavior sama seperti versi sebelumnya — baris "Pemasukan
  // Non-Penjualan" di card dihitung terpisah, lihat shiftStats).
  const virtualTransactions = useMemo(() => {
    const sales = [];
    activeOnly(salesHistory).forEach(order => {
      const to = isCourierHolder(order) ? courierLocationKey(getCashHolder(order).employeeId) : LOCATION_DOMPET;
      if (order.paymentMethod === 'Tunai') {
        sales.push({
          id: `virtual-sale-${order.id}`,
          from: LOCATION_CUSTOMER,
          to,
          amount: order.total || 0,
          note: order.orderType || 'Penjualan',
          date: order.date,
          isVirtual: true,
        });
      } else if (order.paymentMethod === 'Split Payment') {
        (order.splitDetails || []).forEach((p, idx) => {
          if (p.method !== 'Tunai') return;
          sales.push({
            id: `virtual-sale-${order.id}-split-${idx}`,
            from: LOCATION_CUSTOMER,
            to,
            amount: p.amount || 0,
            note: `${order.orderType || 'Penjualan'} (Split Payment - porsi tunai)`,
            date: order.date,
            isVirtual: true,
          });
        });
      }
      // Metode lain (Non-Tunai/QRIS/dll sepenuhnya) TIDAK menyentuh kas
      // fisik sama sekali — sengaja tidak menghasilkan transaksi ledger.
    });

    const exp = activeOnly(expenses)
      .filter(e => (e.paymentMethod || 'Tunai') === 'Tunai') // default 'Tunai' utk data lama tanpa field ini, sama seperti logic asli
      .map(e => ({
        id: `virtual-expense-${e.id}`,
        from: isCourierHolder(e) ? courierLocationKey(getCashHolder(e).employeeId) : LOCATION_DOMPET,
        to: LOCATION_HILANG,
        amount: e.amount || 0,
        note: e.description || e.note || 'Pengeluaran',
        date: e.date,
        isVirtual: true,
      }));
    return [...sales, ...exp];
  }, [salesHistory, expenses]);

  // Ledger LENGKAP (manual + virtual) — satu-satunya input buat
  // computeLocationBalance di seluruh modul Shift.
  const allTransactions = useMemo(
    () => [...activeManualTransfers, ...virtualTransactions],
    [activeManualTransfers, virtualTransactions]
  );

  // Gabungan kurir aktif + kurir yang udah resign/ganti role tapi masih
  // punya jejak saldo di ledger — lihat catatan panjang di
  // getCourierBalanceTargets() (utils/cashHolders.js) soal kenapa ini perlu.
  const couriers = useMemo(() => getCourierBalanceTargets(activeCouriers, {
    expenses: activeOnly(expenses),
    salesHistory: activeOnly(salesHistory),
    cashTransfers: activeManualTransfers,
  }), [activeCouriers, expenses, salesHistory, activeManualTransfers]);

  const courierBalances = useMemo(
    () => computeAllCourierBalances(couriers, allTransactions),
    [couriers, allTransactions]
  );
  const totalHeldByCouriers = useMemo(
    () => courierBalances.reduce((sum, b) => sum + b.balance, 0),
    [courierBalances]
  );

  // Rincian Posisi Uang (dipakai di card Dompet Aktif) — SEMUA lokasi
  // dihitung dengan rumus yang SAMA (computeLocationBalance), gak ada
  // lagi akumulator khusus per "jenis transaksi". TAPI beda SCOPE waktu
  // antar lokasi, dan ini penting:
  //   - Kurir & Owner: RUNNING TOTAL lintas shift/hari (sengaja gak
  //     direset) — uang yang masih di tangan kurir dari kemarin/shift
  //     lalu itu MEMANG masih nyangkut secara fisik sampai beneran
  //     disetor, gak peduli shift keberapa sekarang.
  //   - Dompet: HARUS "pure hari ini" — gak boleh ada transaksi nyangkut
  //     dari kemarin/hari-hari sebelumnya, BAHKAN kalau shift yang sama
  //     kebawa nginep (belum ditutup). Begitu sebuah shift ditutup, uang
  //     di laci itu "selesai" — dicatat sbg actualCash final di
  //     shiftHistory, TIDAK nyambung ke shift berikutnya.
  // BUG #1 YANG SEMPAT KEJADIAN: dompetBalance awalnya dihitung dari
  // allTransactions (SEMUA transaksi sepanjang sejarah aplikasi, gak
  // di-scope), sementara initialCash yang jadi openingBalance-nya cuma
  // punya shift AKTIF — hasilnya nyampur modal hari ini dengan akumulasi
  // penjualan/pengeluaran dari shift-shift lama yang udah lama ditutup,
  // angka jadi jutaan padahal shift baru buka dgn modal puluhan ribu.
  // Fix: dompetBalance HARUS pakai activeShiftTransactions (didefinisikan
  // di bawah), BUKAN allTransactions.
  // BUG #2 YANG SEMPAT KEJADIAN: filter awalnya bandingin TIMESTAMP penuh
  // (`new Date(t.date) >= new Date(currentShift.startTime)`), bukan
  // TANGGAL. currentShift.startTime = jam PERSIS shift dibuka (mis.
  // 09:53:27) — sedangkan expense yang dicatat lewat input tanggal manual
  // (ExpenseView) jamnya default 00:00:00. Walau tanggalnya SAMA dengan
  // hari ini, 00:00:00 < 09:53:27, jadi expense itu ke-filter KELUAR
  // keliru — bikin "Pengeluaran Kasir" tampil Rp 0 walau ada banyak
  // expense hari itu. Fix: bandingin TANGGAL KALENDER (toLocalDateString,
  // pola yg sama dgn matchesDateFilter/closeStaleCourierBalances di file
  // ini), bukan timestamp — jam berapapun expense dicatat, selama
  // tanggalnya >= tanggal buka shift/hari ini, tetap kehitung.
  const activeShiftTransactions = useMemo(() => {
    if (!currentShift) return [];
    const shiftStartDay = toLocalDateString(currentShift.startTime);
    const today = toLocalDateString();
    // Batas bawah = tanggal yang PALING BARU antara hari buka shift dan
    // hari ini (string "YYYY-MM-DD" aman dibandingkan leksikografis).
    // Kasus normal (shift dibuka hari ini): shiftStartDay === today.
    // Kasus shift kebawa nginep (isShiftCarriedOver true, dibuka
    // kemarin/lebih lama): today > shiftStartDay, jadi transaksi
    // kemarin-dst di shift yang sama ikut ke-exclude — Saldo Akhir tetap
    // "pure hari ini" walau shift belum ditutup manual.
    const cutoffDay = shiftStartDay > today ? shiftStartDay : today;
    return allTransactions.filter(t => toLocalDateString(t.date) >= cutoffDay);
  }, [allTransactions, currentShift]);

  const dompetBalance = useMemo(
    () => computeLocationBalance(LOCATION_DOMPET, activeShiftTransactions, currentShift?.initialCash || 0),
    [activeShiftTransactions, currentShift]
  );
  const ownerBalance = useMemo(
    () => computeLocationBalance(LOCATION_OWNER, allTransactions),
    [allTransactions]
  );
  const hilangBalance = useMemo(
    () => computeLocationBalance(LOCATION_HILANG, allTransactions),
    [allTransactions]
  );

  // Total Penjualan/Pengeluaran Kasir/Pengeluaran Kurir buat card display
  // — dihitung dari activeShiftTransactions yang SAMA dengan dompetBalance
  // di atas (satu sumber, satu scope), bukan angka terpisah.
  const cashSalesTotal = useMemo(
    () => activeShiftTransactions.filter(t => t.from === LOCATION_CUSTOMER).reduce((s, t) => s + t.amount, 0),
    [activeShiftTransactions]
  );
  // Pengeluaran Kasir/Kurir buat card display — HANYA expense ASLI
  // (isVirtual: true, hasil terjemahan dari ExpenseView/PosView), BUKAN
  // transaksi "Hilang" manual. Sebelumnya dua-duanya (expense asli +
  // transaksi manual "Kurir/Dompet -> Hilang") ikut numpuk jadi satu
  // angka — matematisnya benar (sama-sama uang yang gak balik ke
  // Dompet), TAPI artinya beda: expense = belanja operasional beneran,
  // sedangkan transaksi Hilang = uang kecolongan/lenyap yang dicatat
  // manual lewat card "Catat Perpindahan Uang". Nyampur keduanya bikin
  // card "Pengeluaran Kasir/Kurir" gak match kalau dicocokkan ke rekap
  // ExpenseView (yang cuma nampilin expense asli). Sekarang dipisah:
  // expense asli tetap di sini, transaksi Hilang pindah ke
  // cashHilangTotal (card baru, terpisah) di bawah.
  const cashExpenseKasirTotal = useMemo(
    () => activeShiftTransactions.filter(t => t.isVirtual && t.to === LOCATION_HILANG && t.from === LOCATION_DOMPET).reduce((s, t) => s + t.amount, 0),
    [activeShiftTransactions]
  );
  const cashExpenseKurirTotal = useMemo(
    () => activeShiftTransactions.filter(t => t.isVirtual && t.to === LOCATION_HILANG && isCourierLocation(t.from)).reduce((s, t) => s + t.amount, 0),
    [activeShiftTransactions]
  );
  // Uang Hilang — transaksi MANUAL (bukan expense asli) yang tujuannya
  // 'Hilang', dari lokasi manapun (Dompet atau kurir manapun). Ini
  // kategori terpisah dari Pengeluaran Kasir/Kurir: uang kecolongan/
  // lenyap/tidak balik, bukan belanja operasional.
  const cashHilangTotal = useMemo(
    () => activeShiftTransactions.filter(t => !t.isVirtual && t.to === LOCATION_HILANG).reduce((s, t) => s + t.amount, 0),
    [activeShiftTransactions]
  );

  // ═══════════════════════════════════════════════════════════════════
  // CARD "CATAT PERPINDAHAN UANG" — SATU form generik gantiin 4 modal
  // terpisah (Setor/Hapus/Ganti Uang/Setor Owner). User pilih lokasi
  // `from` & `to` dari dropdown yang sama (kurir manapun, Dompet, Owner,
  // Hilang), isi nominal, submit -> 1 baris cashTransfers baru.
  // ═══════════════════════════════════════════════════════════════════

  // Semua lokasi yang bisa dipilih di dropdown from/to — kurir (dari
  // `couriers`, termasuk yang non-aktif tapi masih ada saldo nyangkut),
  // + Dompet, Owner, Hilang. TIDAK termasuk 'customer' (itu cuma dipakai
  // internal buat transaksi virtual penjualan, bukan pilihan manual).
  const transferLocations = useMemo(() => [
    ...couriers.map(c => ({ key: courierLocationKey(c.id), label: c.name })),
    { key: LOCATION_DOMPET, label: 'Dompet' },
    { key: LOCATION_OWNER, label: 'Owner' },
    { key: LOCATION_HILANG, label: 'Hilang' },
  ], [couriers]);

  const balanceOfLocation = (key) => {
    if (key === LOCATION_DOMPET) return dompetBalance;
    if (key === LOCATION_OWNER) return ownerBalance;
    if (key === LOCATION_HILANG) return hilangBalance;
    if (isCourierLocation(key)) {
      const id = courierIdFromLocation(key);
      return courierBalances.find(b => b.employeeId === id)?.balance || 0;
    }
    return 0;
  };

  const transferFromBalance = transferFrom ? balanceOfLocation(transferFrom) : 0;

  const handleOpenTransferForm = () => {
    setShowTransferForm(true);
    // Default: kurir pertama yang punya saldo -> Dompet (kasus paling
    // umum, "kurir setor"), biar user gak mulai dari form kosong.
    const firstCourierWithBalance = courierBalances.find(b => b.balance > 0);
    setTransferFrom(firstCourierWithBalance ? courierLocationKey(firstCourierWithBalance.employeeId) : LOCATION_DOMPET);
    setTransferTo(LOCATION_DOMPET);
    setTransferAmountInput('');
    setTransferNoteInput('');
    setConfirmOverdraft(false);
  };

  const handleCloseTransferForm = () => {
    setShowTransferForm(false);
    setTransferAmountInput('');
    setTransferNoteInput('');
    setConfirmOverdraft(false);
  };

  const handleSubmitTransfer = () => {
    if (isTransferSubmitting) return;
    const amount = Number(transferAmountInput);

    if (!transferFrom || !transferTo) {
      return triggerAlert('Pilih lokasi Dari dan Ke terlebih dahulu.');
    }
    if (transferFrom === transferTo) {
      return triggerAlert('Lokasi Dari dan Ke tidak boleh sama.');
    }
    if (!transferAmountInput || !Number.isFinite(amount) || amount <= 0) {
      return triggerAlert('Nominal harus lebih dari Rp 0.');
    }

    // Cek saldo `from` LIVE (bukan snapshot lama) — jaga-jaga ada
    // transaksi baru masuk selagi form ini kebuka (hole #4, pola yang
    // sama dengan modal-modal versi sebelumnya).
    const liveFromBalance = balanceOfLocation(transferFrom);
    const insufficientFunds = amount > liveFromBalance;
    if (insufficientFunds && !confirmOverdraft) {
      // JANGAN submit — biarkan UI (ShiftView.jsx) menampilkan peringatan
      // & checkbox konfirmasi talangan. User harus centang dulu baru
      // klik submit lagi.
      return;
    }

    setIsTransferSubmitting(true);
    const employeeNameSnapshot = {};
    [transferFrom, transferTo].forEach(key => {
      const id = courierIdFromLocation(key);
      if (id) {
        const name = couriers.find(c => c.id === id)?.name;
        if (name) employeeNameSnapshot[id] = name;
      }
    });

    const newTransfer = {
      id: generateUUID(),
      from: transferFrom,
      to: transferTo,
      amount,
      note: transferNoteInput.trim() || '-',
      date: new Date(),
      employeeNameSnapshot, // dipakai getCourierBalanceTargets kalau kurir ini nanti resign
    };
    setCashTransfers([newTransfer, ...(cashTransfers || [])]);

    const fromLabel = locationLabel(transferFrom, new Map(couriers.map(c => [c.id, c])));
    const toLabel = locationLabel(transferTo, new Map(couriers.map(c => [c.id, c])));
    triggerAlert(`${formatRupiah(amount)} dicatat: ${fromLabel} → ${toLabel}.`);

    setIsTransferSubmitting(false);
    handleCloseTransferForm();
  };

  // Tutup Saldo Lama — nolin saldo kurir yang kebawa dari SEBELUM hari ini
  // (dicatat sebagai transaksi Kurir -> Dompet normal bernote jelas, biar
  // tetap keauditkan & muncul di tab Log Transaksi). Saldo dari transaksi
  // HARI INI sengaja TIDAK disentuh — biar gak nge-reset uang yang belum
  // sempat beneran disetor/dilaporkan.
  //
  // Dipanggil otomatis tiap kali "Buka Dompet" (lihat handleOpenShift) —
  // karena di lapangan setoran fisik sering kejadian tanpa sempat dicatat,
  // jadi ganti hari = anggap lunas.
  const closeStaleCourierBalances = ({ silent = false } = {}) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const priorTransactions = allTransactions.filter(t => new Date(t.date) < startOfToday);

    // SENGAJA pakai activeCouriers (bukan `couriers` yang sudah digabung
    // dengan kurir non-aktif) — auto-close ini mengasumsikan uangnya udah
    // beneran disetor fisik tapi lupa dicatat, asumsi yang gak valid buat
    // kurir yang udah resign (gak ada lagi yang bisa "lupa nyetor"). Saldo
    // kurir non-aktif harus diselesaikan manual lewat Card Catat
    // Perpindahan Uang, biar ada jejak keputusan yang jelas.
    const staleBalances = computeAllCourierBalances(activeCouriers, priorTransactions)
      .filter(b => b.balance > 0);

    if (staleBalances.length === 0) {
      if (!silent) triggerAlert('Tidak ada saldo kurir dari hari sebelumnya yang perlu ditutup.');
      return;
    }

    const closingTransfers = staleBalances.map(b => ({
      id: generateUUID(),
      from: courierLocationKey(b.employeeId),
      to: LOCATION_DOMPET,
      amount: b.balance,
      note: 'Penutupan saldo lama (otomatis/manual, bukan setoran fisik tercatat)',
      date: new Date(),
      employeeNameSnapshot: { [b.employeeId]: b.employeeName },
    }));

    setCashTransfers([...closingTransfers, ...(cashTransfers || [])]);

    if (!silent) {
      const rincian = staleBalances.map(b => `${b.employeeName}: ${formatRupiah(b.balance)}`).join(', ');
      triggerAlert(`Saldo lama ditutup (${rincian}).`);
    }
  };

  // Calculate stats for current shift — SEKARANG murni "rebranding" dari
  // angka yang udah dihitung di scope hook ini (cashSalesTotal,
  // cashExpenseKasirTotal, cashExpenseKurirTotal, dompetBalance — semua
  // dari allTransactions, SATU sumber ledger yang sama), BUKAN hitung
  // ulang terpisah dari salesHistory/expenses. Ini mencegah kelas bug
  // yang sempat kejadian pas desain mockup: "Saldo Akhir" & breakdown
  // rincian baca dari 2 sumber angka berbeda yang gak dijamin sinkron.
  const shiftStats = useMemo(() => {
    if (!currentShift) return null;

    // Pemasukan Non-Penjualan (`incomes`) BELUM masuk ke ledger from/to
    // (lihat catatan di virtualTransactions) — tetap dihitung terpisah
    // di sini, dengan SCOPE TANGGAL yang sama dengan activeShiftTransactions
    // (MAX antara hari buka shift dan hari ini) — bukan cuma hari buka
    // shift doang. Tanpa clamp ke hari ini, shift yang kebawa nginep
    // (isShiftCarriedOver) bakal ikut narik incomes dari kemarin, bug
    // kelas yang sama dengan yang sudah difix di activeShiftTransactions.
    const shiftStartDay = toLocalDateString(currentShift.startTime);
    const today = toLocalDateString();
    const cutoffDay = shiftStartDay > today ? shiftStartDay : today;
    const cashIncomeTotal = activeOnly(incomes)
      .filter(i => toLocalDateString(i.date) >= cutoffDay)
      .reduce((s, i) => s + i.amount, 0);

    const cashExpenseTotal = cashExpenseKasirTotal + cashExpenseKurirTotal;

    // expectedCash (Saldo Akhir / laci kasir) = dompetBalance, yang
    // sudah dihitung di atas lewat computeLocationBalance(LOCATION_DOMPET,
    // allTransactions, initialCash) — SATU-SATUNYA rumus buat lokasi
    // Dompet, sama persis dipakai buat baris "Kasir (Dompet)" di
    // breakdown Rincian Posisi Uang. Bedanya cuma cashIncomeTotal
    // (Pemasukan Non-Penjualan) yang belum masuk ledger, jadi ditambah
    // manual di sini — SEKALI, di titik yang sama dgn dompetBalance,
    // bukan titik terpisah yang bisa lupa disinkronkan.
    const expectedCash = dompetBalance + cashIncomeTotal;

    return {
      initialCash: currentShift.initialCash,
      cashSales: cashSalesTotal,
      cashIncomes: cashIncomeTotal,
      cashExpenses: cashExpenseTotal,
      cashExpensesKasir: cashExpenseKasirTotal,
      cashExpensesKurir: cashExpenseKurirTotal,
      // Uang Hilang — kategori TERPISAH dari Pengeluaran Kasir/Kurir
      // (lihat cashHilangTotal di atas). Tetap kehitung di expectedCash
      // lewat dompetBalance (computeLocationBalance sudah memasukkan
      // SEMUA transaksi ke LOCATION_HILANG, virtual maupun manual) —
      // jadi Saldo Akhir TIDAK berubah, ini murni pemisahan
      // tampilan/kategori, bukan perubahan matematika saldo.
      cashHilang: cashHilangTotal,
      totalCashBisnis: expectedCash + totalHeldByCouriers,
      expectedCash,
    };
  }, [currentShift, incomes, dompetBalance, cashSalesTotal, cashExpenseKasirTotal, cashExpenseKurirTotal, cashHilangTotal, totalHeldByCouriers]);

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

    // Snapshot "posisi uang" saat shift ini ditutup — MURNI CATATAN,
    // BUKAN transaksi. Ini TIDAK menulis apapun ke cashTransfers, TIDAK
    // mereset atau memindahkan saldo kurir manapun. Saldo kurir tetap
    // berjalan sebagai running total seperti biasa (lihat catatan di
    // cashHolders.js) — snapshot ini cuma dokumentasi "per tanggal X,
    // begini posisi uangnya" biar kelihatan di laporan cetak & riwayat,
    // supaya kasir/owner bisa lihat kalau ada uang yang belum disetor
    // TANPA sistem diam-diam bikin transaksi/perpindahan uang sendiri.
    const courierBalancesSnapshot = courierBalances
      .filter(b => b.balance !== 0)
      .map(b => ({ employeeId: b.employeeId, employeeName: b.employeeName, balance: b.balance }));

    const shiftData = {
      ...currentShift,
      endTime: new Date(),
      stats: shiftStats,
      actualCash,
      difference,
      courierBalancesSnapshot,
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

  // Hapus 1 baris Log Transaksi (koreksi kalau kasir/admin salah catat) —
  // soft-delete konsisten sama pola recycle bin di seluruh app (activeOnly()
  // di tab Log Transaksi otomatis nyembunyiin ini). Beda dari shift, sengaja
  // gak dikasih recycle bin terpisah di sini karena penggunaannya cuma buat
  // koreksi cepat, bukan alur audit shift.
  const handleDeleteCourierTransfer = (id) => {
    triggerConfirm('Hapus baris transaksi ini? Saldo terkait akan otomatis kehitung ulang.', () => {
      setCashTransfers((cashTransfers || []).map(t => t.id === id ? markDeleted(t) : t));
      triggerAlert('Baris transaksi dihapus.');
    });
  };

  // Koreksi 1 baris Log Transaksi TANPA hapus-lalu-catat-ulang — dipakai
  // kalau kasir/admin salah ketik nominal, salah pilih lokasi, atau mau
  // perjelas catatan. Amount SELALU positif (gak ada lagi trik tanda
  // negatif dari model lama), jadi edit jauh lebih simpel — tinggal ganti
  // field-nya langsung, gak perlu tau "jenis" transaksinya apa.
  const handleOpenEditCourierTransfer = (transfer) => {
    setEditingTransfer(transfer);
    setEditTransferAmountInput(String(Math.abs(transfer.amount || 0)));
    setEditTransferNoteInput(transfer.note || '');
  };

  const handleSaveCourierTransferEdit = () => {
    if (!editingTransfer) return;
    const rawAmount = Number(editTransferAmountInput);
    if (!editTransferAmountInput || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      return triggerAlert('Nominal harus lebih dari Rp 0.');
    }

    triggerConfirm('Simpan koreksi baris transaksi ini? Saldo terkait akan otomatis kehitung ulang.', () => {
      setCashTransfers((cashTransfers || []).map(t => t.id === editingTransfer.id ? {
        ...t,
        amount: rawAmount,
        note: editTransferNoteInput,
      } : t));
      triggerAlert('Baris transaksi berhasil dikoreksi.');
      setEditingTransfer(null);
      setEditTransferAmountInput('');
      setEditTransferNoteInput('');
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

    // Tab navigasi utama: 'aktif' | 'riwayat' | 'log' (Log Transaksi)
    activeTab, setActiveTab,

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

    // Rincian Posisi Uang (card Dompet Aktif, pure display) — SEMUA
    // dihitung dari allTransactions lewat computeLocationBalance, satu
    // rumus yang sama di semua lokasi.
    couriers, courierBalances, totalHeldByCouriers,
    dompetBalance, ownerBalance, hilangBalance,

    // Shift stats (dipakai halaman utama & modal edit saldo awal aktif)
    shiftStats,

    // Card "Catat Perpindahan Uang" — SATU form generik gantiin 4 modal lama
    transferLocations, balanceOfLocation, transferFromBalance,
    showTransferForm, handleOpenTransferForm, handleCloseTransferForm,
    transferFrom, setTransferFrom, transferTo, setTransferTo,
    transferAmountInput, setTransferAmountInput,
    transferNoteInput, setTransferNoteInput,
    confirmOverdraft, setConfirmOverdraft,
    handleSubmitTransfer, isTransferSubmitting,

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
    sortKey, setSortKey,
    isSortOpen, setIsSortOpen,
    isSelecting, setIsSelecting,
    filteredShiftHistory, sortedShiftHistory, rekapShiftStats,
    selectedIds, allSelected, toggleSelectOne, toggleSelectAll, resetSelection, count,
    handleDeleteShift, handleRestoreShift, handlePermanentDeleteShift,
    handleBulkSoftDeleteShift, handleBulkPermanentDeleteShift,

    // Tab "Log Transaksi" — satu list gabungan (manual + virtual)
    allTransactions,
    handleDeleteCourierTransfer,
    editingTransfer, setEditingTransfer,
    editTransferAmountInput, setEditTransferAmountInput,
    editTransferNoteInput, setEditTransferNoteInput,
    handleOpenEditCourierTransfer, handleSaveCourierTransferEdit,
  };
}