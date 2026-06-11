export default function AppLayout({
  sidebar,
  header,
  content,
  bottomNav,
}) {
  return (
    <div className="flex h-screen bg-slate-50 font-body text-slate-800 overflow-hidden w-full relative">
      {sidebar}

      <main className="flex-1 flex flex-col min-w-0 relative">
        {header}

        <div className="flex-1 overflow-hidden relative print:overflow-visible flex flex-col">
          {content}
        </div>

        {bottomNav}
      </main>
    </div>
  );
}