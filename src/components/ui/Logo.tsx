import sntecxLogo from '../../assets/sntecx-logo.png';

interface LogoProps {
  /** Mark + wordmark, or just the mark */
  iconOnly?: boolean;
  /** Mark size (wordmark scales with md) */
  size?: 'sm' | 'md' | 'lg';
  /** Subtitle line under the wordmark */
  tagline?: string;
  className?: string;
}

const tileSize = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' };

/**
 * SNTecX brand logo — the 3D hexagon mark is cropped from the artwork
 * (`sntecx-logo.png`), with the wordmark rendered as crisp text so it stays
 * readable at every size.
 */
export function Logo({ iconOnly = false, size = 'md', tagline, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Hexagon mark (cropped to the icon portion of the artwork) */}
      <div
        role="img"
        aria-label="SNTecX"
        className={`relative shrink-0 overflow-hidden rounded-[10px] bg-black shadow-cta ${tileSize[size]}`}
        style={{
          backgroundImage: `url(${sntecxLogo})`,
          backgroundSize: '160% auto',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <span className="pointer-events-none absolute -inset-px rounded-[10px] ring-1 ring-inset ring-white/20" />
      </div>

      {!iconOnly && (
        <div className="min-w-0 leading-none">
          <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-slate-900">
            DEX
          </p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {tagline ?? 'IT Operations'}
          </p>
        </div>
      )}
    </div>
  );
}