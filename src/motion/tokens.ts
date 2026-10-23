import type { Transition, Variants } from 'framer-motion';

/**
 * One motion language for the whole console.
 *
 * Rules that keep it smooth on a 60, 144 or 240 Hz screen:
 *  - animate only `transform` and `opacity` (the browser runs those on the GPU, off the main thread);
 *  - short durations: 120-220 ms, so every click answers at once;
 *  - ease OUT (fast start, soft landing) for things that appear, ease IN only for things that leave;
 *  - springs for things that follow the pointer or settle (they stay smooth if the frame rate dips).
 */

/** Fast start, long soft landing - the default for anything that appears. */
export const easeOut = [0.16, 1, 0.3, 1] as const;
/** Balanced curve for movement between two places. */
export const easeInOut = [0.45, 0, 0.2, 1] as const;
/** Quick exit. */
export const easeIn = [0.4, 0, 1, 1] as const;

export const duration = { instant: 0.08, fast: 0.14, base: 0.2, slow: 0.28 } as const;

export const spring = {
  /** Buttons, toggles, chips: reacts at once, almost no overshoot. */
  snappy: { type: 'spring', stiffness: 700, damping: 42, mass: 0.7 },
  /** Panels, drawers, modals: settles softly. */
  smooth: { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 },
  /** Layout changes (list reorder, expanding rows). */
  layout: { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 },
} as const satisfies Record<string, Transition>;

export const tween = {
  enter: { duration: duration.base, ease: easeOut },
  exit: { duration: duration.fast, ease: easeIn },
  fade: { duration: duration.fast, ease: easeOut },
} as const satisfies Record<string, Transition>;

/** Default for every motion element that does not set its own transition. */
export const defaultTransition: Transition = tween.enter;

// ── ready-made variants ────────────────────────────────────────────────────────────

/** A page or a block rising into place. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: tween.enter },
  leave: { opacity: 0, y: -4, transition: tween.exit },
};

/** A dialog or popover. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.smooth },
  leave: { opacity: 0, scale: 0.98, y: 4, transition: tween.exit },
};

/** A side drawer (from the right). */
export const drawerRight: Variants = {
  hidden: { x: 32, opacity: 0 },
  show: { x: 0, opacity: 1, transition: spring.smooth },
  leave: { x: 24, opacity: 0, transition: tween.exit },
};

/** The dimmed layer behind a dialog or drawer. */
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tween.fade },
  leave: { opacity: 0, transition: tween.fade },
};

/** Children appear one after another, quickly (total stays under ~250 ms for 8 items). */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: tween.enter },
};

/** A toast sliding in from the right and leaving to it. */
export const toastSlide: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: spring.smooth },
  leave: { opacity: 0, x: 24, scale: 0.98, transition: tween.exit },
};

/** Press and hover feedback for anything clickable: `<motion.button {...pressable}>`. */
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const;
