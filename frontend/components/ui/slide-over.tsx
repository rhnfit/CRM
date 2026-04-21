'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg overflow-y-auto border-l border-black/10 bg-white p-6 shadow-lift"
                initial={{ x: 48, opacity: 0.75 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 48, opacity: 0.75 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-2xl font-semibold text-ink">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-sm text-slate-500">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </Dialog.Close>
                </div>
                {children}
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
