import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../components/ui/Logo';

/* ------- Decorative live-fleet row for the brand panel ------- */

const ROWS: {
  name: string;
  os: string;
  tone: string; // tailwind classes for the dot
  status: string;
  bars: number[]; // heights in %
}[] = [
  { name: 'FIN-WS-2041', os: 'Windows 11', tone: 'bg-emerald-400', status: 'Healthy', bars: [45, 62, 38, 78, 52] },
  { name: 'FIN-WS-2047', os: 'Windows 11', tone: 'bg-emerald-400', status: 'Healthy', bars: [52, 40, 66, 44, 58] },
  { name: 'HR-WS-0112', os: 'Windows 10', tone: 'bg-amber-400', status: 'Watch', bars: [60, 74, 88, 70, 82] },
  { name: 'ENG-WS-0330', os: 'Windows 11', tone: 'bg-emerald-400', status: 'Healthy', bars: [38, 55, 42, 60, 47] },
  { name: 'ENG-WS-0336', os: 'Windows 11', tone: 'bg-red-400', status: 'Issue', bars: [92, 84, 96, 88, 90] },
  { name: 'OPS-WS-0077', os: 'Windows 10', tone: 'bg-emerald-400', status: 'Healthy', bars: [50, 46, 58, 40, 55] },
];

function LiveRow({ row, index }: { row: (typeof ROWS)[number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.35 + index * 0.09, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 shadow-sm"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`absolute h-full w-full animate-ping rounded-full opacity-40 ${row.tone}`} />
        <span className={`relative h-2 w-2 rounded-full ${row.tone}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-slate-700">{row.name}</p>
        <p className="text-[10px] text-slate-500">{row.os}</p>
      </div>
      {/* pulse equalizer */}
      <div className="flex h-4 items-end gap-[3px]" aria-hidden>
        {row.bars.map((h, i) => (
          <span
            key={i}
            className={`eq-bar w-[3px] rounded-sm ${row.tone}`}
            style={{ height: `${h}%`, animationDelay: `${(index * 137 + i * 213) % 1100}ms` }}
          />
        ))}
      </div>
      <span className="w-12 text-right text-[10px] text-slate-500">{row.status}</span>
    </motion.div>
  );
}

/* ------- Layout ------- */

export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.08fr_1fr]">
      {/* Ambient brand panel — desktop */}
      <div className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-10">
        {/* decor */}
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_90%_70%_at_20%_10%,black_35%,transparent_100%)]" />
        <motion.div
          animate={{ x: [0, 26, -14, 0], y: [0, -20, 16, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
          className="absolute -left-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-primary-600/[0.12] blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -22, 18, 0], y: [0, 18, -14, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
          className="absolute -bottom-48 -right-24 h-[24rem] w-[24rem] rounded-full bg-sky-500/[0.08] blur-3xl"
        />

        <div className="relative z-10">
          <Logo size="lg" />
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live fleet feed
          </p>
          <h1 className="font-display text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-slate-900">
            Every endpoint.
            <br />
            <span className="gradient-text">One command center.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
            Telemetry, detection and remediation for your Windows fleet — watched in real time, resolved in minutes.
          </p>
        </div>

        {/* Live feed */}
        <div className="relative z-10 space-y-2">
          {ROWS.map((row, i) => (
            <LiveRow key={row.name} row={row} index={i} />
          ))}
          <p className="pt-2 text-[10px] text-slate-600">Illustrative preview of your fleet as it appears in DEX.</p>
        </div>
      </div>

      {/* Content column */}
      <div className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="bg-grid absolute inset-0 opacity-60 lg:hidden [mask-image:radial-gradient(ellipse_90%_60%_at_50%_0%,black_20%,transparent_100%)]" />
        <div className="relative z-10 w-full max-w-[400px]">
          {/* Brand for small screens */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="md" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
