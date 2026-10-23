/** Console colors that can be customized (area "theme"): the main color, the surfaces, and an accent per section of the app. */
export interface ThemeConfig {
  /** Main color: buttons, links, the active menu entry. */
  primary?: string;
  /** Page background. */
  canvas?: string;
  /** Cards. */
  panel?: string;
  sidebar?: string;
  header?: string;
  /** A different main color while a section is open, keyed by the first part of its address ("dashboard", "devices", "tickets", ...). */
  sections?: Record<string, string>;
}

/** The sections that can have their own color, by the first part of their address. */
export const THEME_SECTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'devices', label: 'Devices' },
  { key: 'groups', label: 'Groups' },
  { key: 'issues', label: 'Issues' },
  { key: 'tickets', label: 'ITSM' },
  { key: 'knowledge', label: 'Knowledge Base' },
  { key: 'ai-chat', label: 'AI Chat' },
  { key: 'reports', label: 'Reports' },
  { key: 'security', label: 'Security' },
];

export const PRESETS: { name: string; theme: ThemeConfig }[] = [
  { name: 'DEX sky (default)', theme: {} },
  { name: 'Ocean', theme: { primary: '#2563eb', canvas: '#eef2fb' } },
  { name: 'Forest', theme: { primary: '#15803d', canvas: '#eef6f0' } },
  { name: 'Sunset', theme: { primary: '#ea580c', canvas: '#fbf3ec' } },
  { name: 'Berry', theme: { primary: '#9333ea', canvas: '#f5f0fb' } },
  { name: 'Graphite', theme: { primary: '#334155', canvas: '#f1f3f5', sidebar: '#f8fafc' } },
];

const HEX = /^#([0-9a-f]{6})$/i;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function mix(hex: string, other: [number, number, number], amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = rgb.map((c, i) => Math.round(c + (other[i] - c) * amount));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** A full 50…950 scale from one color, the same steps Tailwind uses for the built-in sky. */
export function scaleOf(hex: string): Record<string, string> {
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  return {
    50: mix(hex, white, 0.94),
    100: mix(hex, white, 0.87),
    200: mix(hex, white, 0.73),
    300: mix(hex, white, 0.52),
    400: mix(hex, white, 0.25),
    500: hex,
    600: mix(hex, black, 0.15),
    700: mix(hex, black, 0.3),
    800: mix(hex, black, 0.45),
    900: mix(hex, black, 0.58),
    950: mix(hex, black, 0.72),
  };
}

const VARS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

/** Applies a theme to the page (or clears it when empty). `section` is the first part of the current address. */
export function applyTheme(theme: ThemeConfig | null, section: string) {
  const root = document.documentElement.style;
  const primary = (theme?.sections && isHex(theme.sections[section]) ? theme.sections[section] : null) ?? (isHex(theme?.primary) ? theme!.primary! : null);
  if (primary) {
    const scale = scaleOf(primary);
    VARS.forEach((v) => root.setProperty(`--color-primary-${v}`, scale[v]));
  } else {
    VARS.forEach((v) => root.removeProperty(`--color-primary-${v}`));
  }
  const surfaces: [keyof ThemeConfig, string][] = [
    ['canvas', '--color-canvas'],
    ['panel', '--color-panel'],
    ['sidebar', '--dex-sidebar-bg'],
    ['header', '--dex-header-bg'],
  ];
  for (const [key, cssVar] of surfaces) {
    const value = theme?.[key];
    if (isHex(value)) root.setProperty(cssVar, value);
    else root.removeProperty(cssVar);
  }
}
