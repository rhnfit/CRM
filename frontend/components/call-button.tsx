'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { PostCallModal } from './post-call-modal';

export function CallButton({ phone, leadId, fullWidth = false }: { phone: string; leadId: string; fullWidth?: boolean }) {
  const [triggering, setTriggering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleCall = async () => {
    if (triggering) return;
    setTriggering(true);
    try {
      await apiFetch('/integrations/calls/trigger', {
        method: 'POST',
        json: { phone, leadId },
      }).catch(() => {
        /* optional socket trigger */
      });
      setModalOpen(true);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <>
      <PostCallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leadId={leadId}
        phone={phone}
        onLogged={() => window.dispatchEvent(new CustomEvent('crm:lead-refresh'))}
      />
    <button
      type="button"
      onClick={() => void handleCall()}
      disabled={triggering}
      className={`group relative overflow-hidden rounded-2xl px-4 py-2.5 font-semibold text-white shadow-soft transition-premium active:scale-[0.98] ${
        fullWidth ? 'flex w-full justify-center' : 'inline-flex items-center'
      } ${triggering ? 'cursor-wait bg-indigo-400' : 'bg-brand hover:bg-brand-dark'}`}
    >
      {triggering ? (
        <span className="flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Opening…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="h-5 w-5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Call Client
        </span>
      )}
      {!triggering && (
        <div className="absolute inset-0 -translate-x-full bg-white/20 transition-slow group-hover:translate-x-full" />
      )}
    </button>
    </>
  );
}
