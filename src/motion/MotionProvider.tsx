import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { defaultTransition } from './tokens';

/**
 * Wraps the app once. Every motion element that does not set its own transition uses the console's default, and
 * people who asked their system for reduced motion get fades instead of movement (`reducedMotion="user"`).
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig transition={defaultTransition} reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
