export default function Footer() {
  return (
    <footer className="border-t border-line px-6 py-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-slate-600">© 2026 DEX Platform</p>
        <div className="flex items-center gap-4">
          <a href="#" className="text-[11px] text-slate-600 transition-colors hover:text-slate-900">Privacy</a>
          <a href="#" className="text-[11px] text-slate-600 transition-colors hover:text-slate-900">Terms</a>
          <a href="#" className="text-[11px] text-slate-600 transition-colors hover:text-slate-900">Status</a>
        </div>
      </div>
    </footer>
  );
}
