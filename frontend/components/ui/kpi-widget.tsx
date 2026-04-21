'use client';

import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Card } from './card';

function AnimatedNumber({ value, formatter }: { value: number; formatter?: (value: number) => string }) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const controls = animate(previous.current, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(latest) {
        setDisplay(Math.round(latest));
      },
    });
    previous.current = value;
    return controls.stop;
  }, [value]);

  return <span>{formatter ? formatter(display) : display.toLocaleString()}</span>;
}

export function KpiWidget({
  label,
  value,
  tone = 'default',
  hint,
  formatter,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  hint?: string;
  formatter?: (value: number) => string;
}) {
  const toneClass = {
    default: 'text-ink',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-rose-600',
    accent: 'text-brand',
  }[tone];

  return (
    <Card interactive className="space-y-2 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${toneClass}`}>
        <AnimatedNumber value={value} formatter={formatter} />
      </p>
      {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
    </Card>
  );
}
