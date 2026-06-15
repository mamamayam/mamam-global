export default function AppLayout({
  sidebar,
  header,
  content,
  bottomNav,
  overlays,
}) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-body text-slate-800 dark:text-slate-100 overflow-hidden w-full relative">
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