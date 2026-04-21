'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <motion.div
      whileHover={interactive ? { y: -4, boxShadow: '0 18px 44px rgba(15, 23, 42, 0.14)' } : undefined}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-black/5 bg-white p-5 shadow-soft ${className}`}
    >
      {children}
    </motion.div>
  );
}
