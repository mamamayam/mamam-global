import { useState, useCallback } from 'react';

/**
 * Hook generik buat checkbox bulk-select (dipakai di semua Recycle Bin).
 * `visibleList` = array item yang lagi ketampak (udah kena filter/sort),
 * jadi acuan buat status "Pilih Semua".
 */
export function useBulkSelect(visibleList) {
    const [selectedIds, setSelectedIds] = useState(new Set());

    const allSelected = visibleList.length > 0 && visibleList.every(item => selectedIds.has(item.id));

    const toggleOne = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        setSelectedIds(allSelected ? new Set() : new Set(visibleList.map(item => item.id)));
    }, [allSelected, visibleList]);

    const reset = useCallback(() => setSelectedIds(new Set()), []);

    return { selectedIds, allSelected, toggleOne, toggleAll, reset, count: selectedIds.size };
}