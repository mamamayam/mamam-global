/**
 * applySort — urutkan array data berdasarkan sortKey gabungan "field-direction"
 * (mis. "date-desc", "name-asc"), dipasangin sama field map buat ambil nilai
 * yang mau dibandingin per item.
 *
 * fieldMap: { [namaField]: (item) => nilaiYangDibandingin }
 *   - String dibandingin pakai localeCompare (locale 'id') biar urutan abjad
 *     gak keganggu huruf besar/kecil.
 *   - Number / Date dibandingin langsung.
 *
 * Dirancang buat dipasangin langsung sama <SortModal /> di components/ui:
 * key opsi SortModal ("date-desc", dst) = sortKey yang dilempar ke sini.
 *
 * Contoh (lihat HistoryView.jsx buat contoh lengkap):
 *   const sorted = applySort(orders, sortKey, {
 *     date: o => new Date(o.date),
 *     name: o => o.customerName || '',
 *     type: o => o.orderType || '',
 *   });
 */
export const applySort = (data, sortKey, fieldMap) => {
    if (!sortKey || !Array.isArray(data)) return data;

    const [field, direction] = sortKey.split('-');
    const getValue = fieldMap?.[field];
    if (!getValue) return data;

    const sorted = [...data].sort((a, b) => {
        const va = getValue(a);
        const vb = getValue(b);

        if (typeof va === 'string' || typeof vb === 'string') {
            return String(va).localeCompare(String(vb), 'id');
        }
        return va > vb ? 1 : va < vb ? -1 : 0;
    });

    return direction === 'desc' ? sorted.reverse() : sorted;
};