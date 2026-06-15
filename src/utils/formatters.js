 export const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

 export const generateUUID = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );

/**
 * Format Date (atau string/number yang bisa di-parse jadi Date) menjadi
 * "YYYY-MM-DD" berdasarkan tanggal LOKAL device, bukan UTC.
 *
 * Kenapa ini penting:
 * `date.toISOString().split('T')[0]` mengonversi ke UTC dulu. Untuk device
 * di WIB (UTC+7), transaksi yang terjadi jam 00:00–06:59 WIB akan punya
 * tanggal UTC = hari SEBELUMNYA, sehingga transaksi tengah malam/dini hari
 * salah masuk ke laporan hari sebelumnya.
 *
 * Gunakan fungsi ini untuk:
 * - Nilai default <input type="date"> (hari ini)
 * - Filter/kelompokkan record berdasarkan tanggal (laporan, shift, dll)
 */
export const toLocalDateString = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Sama seperti toLocalDateString tapi hanya "YYYY-MM" (untuk
 * pengelompokan/laporan bulanan berdasarkan tanggal lokal device).
 */
export const toLocalMonthString = (date = new Date()) => toLocalDateString(date).slice(0, 7);