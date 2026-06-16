import { useRef, useCallback } from 'react';

export default function AppLayout({
  sidebar,
  header,
  content,
  bottomNav,
  overlays,
  onSwipeOpen,
  onSwipeClose,
  isSidebarOpen,
}) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Minimal jarak swipe (px) agar dianggap gesture
  const SWIPE_THRESHOLD = 50;
  // Zona tepi kiri (px) tempat swipe-open bisa dimulai
  const EDGE_ZONE = 40;

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Abaikan jika lebih banyak scroll vertikal daripada horizontal
    if (Math.abs(dy) > Math.abs(dx)) {
      touchStartX.current = null;
      return;
    }

    // Swipe kanan → buka sidebar (hanya dari tepi kiri layar)
    if (dx > SWIPE_THRESHOLD && touchStartX.current < EDGE_ZONE && !isSidebarOpen) {
      onSwipeOpen?.();
    }

    // Swipe kiri → tutup sidebar (dari mana saja)
    if (dx < -SWIPE_THRESHOLD && isSidebarOpen) {
      onSwipeClose?.();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [isSidebarOpen, onSwipeOpen, onSwipeClose]);

  return (
    <div
      className="flex h-screen bg-slate-50 dark:bg-slate-950 font-body text-slate-800 dark:text-slate-100 overflow-hidden w-full relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {sidebar}

      <main className="flex-1 flex flex-col min-w-0 relative">
        {header}

        <div className="flex-1 overflow-hidden relative print:overflow-visible flex flex-col">
          {content}
        </div>

        {bottomNav}
      </main>

      {/* Modal, overlay, dan elemen fixed lainnya */}
      {overlays}
    </div>
  );
}
