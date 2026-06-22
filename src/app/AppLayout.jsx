import { useRef, useEffect } from 'react';

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
  const containerRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isHorizontalSwipe = useRef(false);

  // Minimal jarak swipe (px) agar dianggap gesture
  const SWIPE_THRESHOLD = 50;
  // Zona tepi kiri (px) tempat swipe-open bisa dimulai
  const EDGE_ZONE = 40;

  // Shadow ref: selalu menyimpan nilai TERBARU dari props. Listener native di
  // bawah dipasang SEKALI saja (gak dibongkar-pasang ulang tiap render), jadi
  // dia baca state lewat ref ini supaya gak kena stale closure.
  const stateRef = useRef({ isSidebarOpen, onSwipeOpen, onSwipeClose });
  useEffect(() => {
    stateRef.current = { isSidebarOpen, onSwipeOpen, onSwipeClose };
  }, [isSidebarOpen, onSwipeOpen, onSwipeClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontalSwipe.current = false;
    };

    const handleTouchMove = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      // Begitu arah gerak jelas (sudah lewat 10px), kunci apakah ini swipe
      // horizontal atau scroll vertikal — sekali kekunci, gak diubah lagi
      // sampai gesture ini selesai.
      if (!isHorizontalSwipe.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }

      // Kalau ini swipe horizontal, rebut gesture-nya dari browser/Android
      // (edge-swipe-back) — preventDefault cuma ngefek karena listener ini
      // didaftarkan passive:false di touchmove (lihat addEventListener bawah).
      if (isHorizontalSwipe.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return;

      const { isSidebarOpen: open, onSwipeOpen: openFn, onSwipeClose: closeFn } = stateRef.current;
      const dx = e.changedTouches[0].clientX - touchStartX.current;

      if (isHorizontalSwipe.current) {
        // Swipe kanan → buka sidebar (hanya dari tepi kiri layar)
        if (dx > SWIPE_THRESHOLD && touchStartX.current < EDGE_ZONE && !open) {
          openFn?.();
        }
        // Swipe kiri → tutup sidebar (dari mana saja)
        else if (dx < -SWIPE_THRESHOLD && open) {
          closeFn?.();
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
      isHorizontalSwipe.current = false;
    };

    // passive:false WAJIB di touchmove — supaya preventDefault() di atas
    // beneran ngefek, gak cuma kena warning. touchstart/touchend gak perlu
    // preventDefault jadi dibiarkan passive (lebih ringan utk scroll).
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // listener dipasang sekali; state terbaru dibaca lewat stateRef

  return (
    <div
      ref={containerRef}
      className="flex h-screen bg-slate-50 dark:bg-slate-950 font-body text-slate-800 dark:text-slate-100 overflow-hidden w-full relative"
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