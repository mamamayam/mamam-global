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
  // Pemasukan Non-Penjualan (`incomes`) — SEKARANG diterjemahkan jadi
  // transaksi virtual juga, sama seperti sales & expense di atas. HANYA
  // porsi TUNAI yang masuk ledger (konsisten dgn aturan Non-Tunai di
  // atas). `from` pakai LOCATION_CUSTOMER — bukan berarti "dari
  // pelanggan", tapi lokasi ini memang didesain sebagai sumber netral
  // buat transaksi virtual dari LUAR sistem cash internal (gak pernah
  // dihitung saldonya di manapun — lihat cashHolders.js), jadi aman
  // dipakai ulang di sini: income bukan dari kurir/Dompet/Owner manapun,
  // dia genuinely uang baru yang masuk dari luar.
  // BUG YANG SEMPAT KEJADIAN: incomes sebelumnya TIDAK pernah masuk sini
  // — cuma dihitung terpisah (cashIncomeTotal di shiftStats) lalu
  // ditambahkan manual ke shiftStats.expectedCash SAJA. Tapi dompetBalance
  // (dipakai buat breakdown "Kasir (Dompet)" & "Saldo Akhir" di card
  // Dompet Aktif — lihat ShiftView) TIDAK PERNAH menyertakan
  // cashIncomeTotal itu. Akibatnya: baris "Pemasukan Non-Penjualan"
  // kelihatan "+Rp sekian" di card, tapi angka itu gak pernah nambah ke
  // Kasir/Saldo Akhir yang ditampilkan DI CARD YANG SAMA — cuma numpang
  // lewat ke shiftStats.expectedCash (yang baru kepakai/kelihatan pas
  // laporan tutup shift). Dua sumber angka berbeda buat hal yang
  // seharusnya sama. Fix: masukkan ke ledger juga, satu sumber data.
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

    // Pemasukan Non-Penjualan — selalu masuk ke Dompet (income di toko
    // ini gak punya konsep cashHolder/kurir, selalu dianggap langsung ke
    // laci kasir). Cuma yang paymentMethod 'Tunai' yang masuk ledger.
    const inc = activeOnly(incomes)
      .filter(i => (i.paymentMethod || 'Tunai') === 'Tunai') // default 'Tunai' utk data lama tanpa field ini
      .map(i => ({
        id: `virtual-income-${i.id}`,
        from: LOCATION_CUSTOMER,
        to: LOCATION_DOMPET,
        amount: i.amount || 0,
        note: i.description || i.note || 'Pemasukan Non-Penjualan',
        date: i.date,
        isVirtual: true,
      }));

    return [...sales, ...exp, ...inc];
  }, [salesHistory, expenses, incomes]);

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
  //   - Dompet: HARUS "murni per-shift" — gak boleh ada transaksi
  //     nyangkut dari shift MANAPUN sebelumnya, termasuk transaksi yang
  //     dicatat SISTEM sendiri (mis. closing transfer kurir saat tutup
  //     shift) walau tanggalnya SAMA dengan shift yang baru dibuka.
  //     Begitu sebuah shift ditutup, uang di laci itu "selesai" —
  //     dicatat sbg actualCash final di shiftHistory, TIDAK nyambung ke
  //     shift berikutnya SAMA SEKALI. Modal shift baru MURNI angka yang
  //     diketik manual di form "Buka Dompet", titik — walau baru buka-
  //     tutup-buka lagi dalam hitungan menit di hari yang sama.
  // BUG #1 YANG SEMPAT KEJADIAN: dompetBalance awalnya dihitung dari
  // allTransactions (SEMUA transaksi sepanjang sejarah aplikasi, gak
  // di-scope), sementara initialCash yang jadi openingBalance-nya cuma
  // punya shift AKTIF — hasilnya nyampur modal hari ini dengan akumulasi
  // penjualan/pengeluaran dari shift-shift lama yang udah lama ditutup,
  // angka jadi jutaan padahal shift baru buka dgn modal puluhan ribu.
  // Fix: dompetBalance HARUS pakai activeShiftTransactions (didefinisikan
  // di bawah), BUKAN allTransactions.
  // BUG #2 YANG SEMPAT KEJADIAN: filter sempat diubah jadi bandingin
  // TANGGAL KALENDER doang (bukan timestamp presisi), buat ngatasin
  // expense manual (ExpenseView) yang jamnya default 00:00:00. TAPI itu
  // bikin BUG BARU: kalau kasir tutup shift lalu BUKA LAGI shift baru di
  // HARI YANG SAMA (skenario testing cepat: tutup-buka berkali-kali
  // dalam semenit), transaksi closing kurir yang baru DITULIS SISTEM
  // (bertanggal "hari ini juga") ikut kehitung ke shift BARU — padahal
  // itu milik shift LAMA yang sudah selesai. Modal shift baru jadi
  // kebawa residu dari shift sebelumnya, padahal harusnya murni angka
  // manual yang diketik ulang.
  // FIX GABUNGAN: transaksi TERCATAT SISTEM (cashTransfers — selalu
  // punya timestamp presisi asli, baik manual lewat card "Catat
  // Perpindahan Uang" maupun otomatis dari closing shift) dibandingkan
  // PRESISI (>= currentShift.startTime, jam-menit-detik) — supaya
  // transaksi shift SEBELUMNYA gak ikut kehitung walau di hari sama.
  // Transaksi VIRTUAL (isVirtual: true — hasil terjemahan expense/
  // income/sales yang diinput via tanggal manual, rawan jam 00:00:00)
  // tetap dibandingkan by TANGGAL KALENDER seperti sebelumnya, biar gak
  // balik ke bug lama (expense hari ini ke-filter keluar keliru gara2
  // jamnya 00:00 lebih awal dari jam buka shift).
  const activeShiftTransactions = useMemo(() => {
    if (!currentShift) return [];
    const shiftStart = new Date(currentShift.startTime);
    const shiftStartDay = toLocalDateString(currentShift.startTime);
    const today = toLocalDateString();
    const cutoffDay = shiftStartDay > today ? shiftStartDay : today;
    return allTransactions.filter(t => {
      if (t.isVirtual) {
        // Expense/income/sales manual — bandingkan TANGGAL, bukan jam
        // (jam sering 00:00:00 dari input tanggal, bukan waktu real).
        return toLocalDateString(t.date) >= cutoffDay;
      }
      // Transaksi cashTransfers (manual ATAU otomatis/closing) — selalu
      // punya timestamp asli (new Date() saat dicatat), jadi aman & WAJIB
      // dibandingkan PRESIS ke jam buka shift. Ini yang mencegah
      // transaksi closing shift SEBELUMNYA ikut kehitung ke shift BARU
      // walau dicatat di hari yang sama.
      return new Date(t.date) >= shiftStart;
    });
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
  // sebagai JARING PENGAMAN kalau ada saldo kurir yang entah kenapa masih
  // nyangkut dari hari-hari sebelumnya (harusnya sudah dibereskan oleh
  // handleCloseShift di bawah setiap shift ditutup, tapi ini tetap ada
  // buat kasus shift yang lupa ditutup / dibuka ulang, dsb).
  //
  // RELASI DENGAN handleCloseShift: keduanya menulis transaksi
  // "Kurir -> Dompet" dengan pola yang sama, tapi TRIGGER dan CAKUPAN
  // beda — bukan duplikat:
  //   - handleCloseShift (saat TUTUP): nutup SEMUA kurir yang masih ada
  //     saldo, kapanpun transaksinya (termasuk hari ini) — karena SOP
  //     toko: kurir pasti setor & sudah dilaporkan manual ke kasir,
  //     tercermin di actualCash yang diketik kasir saat itu.
  //   - closeStaleCourierBalances (saat BUKA): jaring pengaman, cuma
  //     nutup saldo dari SEBELUM hari ini (bukan hari ini) — buat kasus
  //     shift kemarin lupa ditutup lewat tombol resminya.
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

    // Pemasukan Non-Penjualan (`incomes`) SEKARANG sudah masuk ledger
    // (lihat virtualTransactions) — jadi sudah otomatis ikut kehitung di
    // dompetBalance lewat activeShiftTransactions. cashIncomeTotal di
    // sini MURNI buat DISPLAY (baris "Pemasukan Non-Penjualan" di card),
    // dihitung dari activeShiftTransactions yang SAMA (satu ledger, satu
    // sumber), BUKAN filter terpisah dari incomes mentah — supaya angka
    // ini dijamin konsisten dengan apa yang sudah ikut di dompetBalance.
    const cashIncomeTotal = activeShiftTransactions
      .filter(t => t.isVirtual && t.from === LOCATION_CUSTOMER && t.to === LOCATION_DOMPET && t.id?.startsWith('virtual-income-'))
      .reduce((s, t) => s + t.amount, 0);

    const cashExpenseTotal = cashExpenseKasirTotal + cashExpenseKurirTotal;

    // expectedCash (Saldo Akhir / laci kasir) = dompetBalance MURNI,
    // TANPA tambahan apapun lagi. incomes SUDAH masuk ledger (lihat
    // virtualTransactions) jadi SUDAH otomatis tercermin di dompetBalance
    // — menambahkannya lagi di sini bakal DOBEL HITUNG.
    // BUG YANG SEMPAT KEJADIAN: dulu di titik ini expectedCash =
    // dompetBalance + cashIncomeTotal, karena incomes BELUM masuk ledger
    // sama sekali saat itu — jadi "Kasir (Dompet)"/"Saldo Akhir" di card
    // Aktif (yang baca dompetBalance MURNI, TANPA cashIncomeTotal) gak
    // pernah ikut naik walau baris "Pemasukan Non-Penjualan" kelihatan
    // ada isinya — cuma numpang lewat ke expectedCash (baru kepakai di
    // laporan tutup shift). Fix: incomes masuk ledger, expectedCash =
    // dompetBalance apa adanya.
    const expectedCash = dompetBalance;

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
  }, [currentShift, activeShiftTransactions, dompetBalance, cashSalesTotal, cashExpenseKasirTotal, cashExpenseKurirTotal, cashHilangTotal, totalHeldByCouriers]);

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
    // closeStaleCourierBalances() SENGAJA TIDAK dipanggil otomatis di sini
    // lagi (dulu dipanggil di titik ini) — itu jadi sumber bug
    // double-counting: fungsi itu menutup saldo kurir berdasar snapshot
    // "sebelum hari ini", tanpa tahu soal transaksi penutup yang BARU
    // ditulis handleCloseShift (yang sekarang sudah menutup SEMUA saldo
    // kurir tiap shift ditutup). Kalau dua-duanya jalan, saldo yang sama
    // ketutup dua kali — Dompet dobel-tambah, kurir jadi minus (utang
    // palsu). Fungsi closeStaleCourierBalances tetap ada di bawah, cuma
    // sekarang jadi tombol manual (jaring pengaman opsional), bukan
    // auto-trigger.
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

    // Snapshot "posisi uang" SEBELUM direset — buat laporan cetak &
    // riwayat (lihat courierBalancesSnapshot di shiftData). Diambil
    // duluan di sini karena courierBalances masih mencerminkan saldo
    // SEBELUM transaksi penutupan di bawah ditulis.
    const courierBalancesSnapshot = courierBalances
      .filter(b => b.balance !== 0)
      .map(b => ({ employeeId: b.employeeId, employeeName: b.employeeName, balance: b.balance }));

    // Penutupan saldo kurir saat TUTUP shift — kasir sudah memasukkan
    // actualCash yang MENCAKUP laporan setoran kurir (SOP toko: kurir
    // pasti setor, dilaporkan manual ke kasir meski belum sempat
    // di-input real-time ke aplikasi). Begitu shift ditutup, saldo itu
    // dianggap "sudah ketemu" di actualCash — jadi saldo kurir di sistem
    // direset ke 0 lewat transaksi TERCATAT (bukan diam-diam diubah
    // tanpa jejak), pola yang SAMA PERSIS dengan closeStaleCourierBalances
    // (dipanggil saat buka shift, buat saldo dari hari sebelumnya) — di
    // sini cakupannya SEMUA kurir yang masih ada saldo, karena baru saja
    // "dihitung ketemu" oleh kasir lewat actualCash.
    // PENTING: transaksi ini TIDAK menambah expectedCash/actualCash shift
    // YANG SEDANG DITUTUP INI (actualCash sudah final, diketik apa
    // adanya oleh kasir) — efeknya baru kelihatan di dompetBalance shift
    // BERIKUTNYA (yang mulai dari activeShiftTransactions kosong lagi).
    const closingCourierTransfers = courierBalances
      .filter(b => b.balance !== 0)
      .map(b => ({
        id: generateUUID(),
        from: courierLocationKey(b.employeeId),
        to: LOCATION_DOMPET,
        amount: b.balance,
        note: 'Setoran kurir (otomatis saat tutup shift — dilaporkan manual ke kasir)',
        date: new Date(),
        employeeNameSnapshot: { [b.employeeId]: b.employeeName },
      }));

    const shiftData = {
      ...currentShift,
      endTime: new Date(),
      stats: shiftStats,
      actualCash,
      difference,
      courierBalancesSnapshot,
    };

    triggerConfirm(`Apakah Anda yakin ingin menutup dompet ini? Semua transaksi selanjutnya tidak akan terekap di dompet ini.`, () => {
      if (closingCourierTransfers.length > 0) {
        setCashTransfers([...closingCourierTransfers, ...(cashTransfers || [])]);
      }
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