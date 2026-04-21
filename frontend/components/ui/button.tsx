'use client';

import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = HTMLMotionProps<'button'> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-soft hover:bg-brand-dark focus-visible:outline-brand/40',
  secondary:
    'bg-white text-ink shadow-soft ring-1 ring-black/5 hover:bg-slate-50 focus-visible:outline-black/15',
  ghost: 'bg-transparent text-slate-600 hover:bg-white/70 focus-visible:outline-black/10',
};

export function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
