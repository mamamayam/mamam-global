import { useState, useRef, useCallback, useEffect } from "react";

// ─── Hook drag & drop reorder (mouse + touch) ───
// Diekstrak dari MenuMgmt.jsx & VariantMgmt.jsx — sebelumnya duplikat
// byte-identical di kedua file (~70 baris), sekarang shared di sini.
export function useDragReorder(onReorder) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const overIdRef = useRef(null);
  const itemRefs = useRef({});

  const registerRef = useCallback((id) => (el) => {
    if (el) itemRefs.current[id] = el;
    else delete itemRefs.current[id];
  }, []);

  const startDrag = useCallback((id) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* setPointerCapture tidak didukung di elemen/browser ini, aman diabaikan */ }
    overIdRef.current = id;
    setDragId(id);
    setOverId(id);
  }, []);

  useEffect(() => {
    if (dragId === null) return;
    const getY = (e) => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
    const handleMove = (e) => {
      const y = getY(e);
      if (y == null) return;
      let closestId = null;
      let closestDist = Infinity;
      Object.entries(itemRefs.current).forEach(([id, el]) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(y - mid);
        if (dist < closestDist) { closestDist = dist; closestId = id; }
      });
      if (closestId !== null && closestId !== overIdRef.current) {
        overIdRef.current = closestId;
        setOverId(closestId);
      }
    };
    const finishDrag = () => {
      const finalOverId = overIdRef.current;
      if (dragId !== null && finalOverId !== null && dragId !== finalOverId) {
        onReorder(dragId, finalOverId);
      }
      setDragId(null);
      setOverId(null);
      overIdRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [dragId, onReorder]);

  return { dragId, overId, registerRef, startDrag };
}

export function getDragRowClass(isDragging, isDropTarget, baseClass, idleClass) {
  if (isDragging) return `${baseClass} opacity-50 ring-2 ring-accent-400 z-10`;
  if (isDropTarget) return `${baseClass} border-accent-400 bg-accent-50/60 dark:bg-accent-500/10`;
  return `${baseClass} ${idleClass}`;
}
