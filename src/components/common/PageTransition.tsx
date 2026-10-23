import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../motion';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" exit="leave" className={className}>
      {children}
    </motion.div>
  );
}
