import { motion } from 'framer-motion';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export default function Loading({ size = 'md', fullScreen = false, text }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={`${sizeMap[size]} animate-spin rounded-full border-4 border-primary-200 border-t-primary-600`} />
          {text && <p className="text-sm text-slate-500 font-medium">{text}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className={`${sizeMap[size]} animate-spin rounded-full border-4 border-primary-200 border-t-primary-600`} />
        {text && <p className="text-sm text-slate-500 font-medium">{text}</p>}
      </motion.div>
    </div>
  );
}

// Skeleton loader for content placeholders
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div className="skeleton h-5 w-1/3 rounded" />
      <div className="skeleton h-8 w-1/4 rounded" />
      <div className="skeleton h-4 w-2/3 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-10 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}
