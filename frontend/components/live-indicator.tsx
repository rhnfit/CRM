'use client';

import { useState } from 'react';
import { CrmEvent, useCrmSocket } from '../lib/socket';

export function LiveIndicator({
  onEvent,
}: {
  onEvent?: (evt: CrmEvent) => void;
}) {
  const [last, setLast] = useState<CrmEvent | null>(null);
  const { connected } = useCrmSocket((evt) => {
    setLast(evt);
    onEvent?.(evt);
  });

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      />
      {connected ? 'Live' : 'Offline'}
      {last ? (
        <span className="truncate">
          · last {last.resource} {last.action}
        </span>
      ) : null}
    </div>
  );
}
