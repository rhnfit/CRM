'use client';

/** Pure SVG/CSS charts — no extra dependencies. */

type BarProps = {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
  height?: number;
};

export function BarChart({ data, color = '#15803d', unit = '', height = 160 }: BarProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.floor(100 / data.length);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${data.length * 40} ${height + 30}`}
        className="w-full"
        style={{ minWidth: data.length * 30 }}
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * height);
          const x = i * 40 + 4;
          const y = height - h;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW - 8}
                height={h}
                fill={color}
                opacity={0.85}
                rx={2}
              />
              <title>{`${d.label}: ${d.value}${unit}`}</title>
              <text
                x={x + (barW - 8) / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize={8}
                fill="#64748b"
              >
                {d.label.length > 5 ? d.label.slice(-5) : d.label}
              </text>
              {h > 12 ? (
                <text
                  x={x + (barW - 8) / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize={7}
                  fill={color}
                >
                  {d.value > 0
                    ? d.value >= 1000
                      ? `${(d.value / 1000).toFixed(1)}k`
                      : String(d.value)
                    : ''}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type LineProps = {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
};

export function LineChart({ data, color = '#15803d', height = 120 }: LineProps) {
  if (data.length < 1) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 400;
  const padX = 10;
  const padY = 10;
  const innerW = w - padX * 2;
  const innerH = height - padY * 2;

  const pts = data.map((d, i) => {
    const denom = Math.max(1, data.length - 1);
    const x = padX + (i / denom) * innerW;
    const y = padY + (1 - d.value / max) * innerH;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${height + 20}`}
        className="w-full"
        aria-label="Line chart"
      >
        {data.length >= 2 ? (
          <polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <circle cx={padX + innerW / 2} cy={padY + (1 - data[0].value / max) * innerH} r={4} fill={color} />
        )}
        {data.map((d, i) => {
          const denom = Math.max(1, data.length - 1);
          const x = padX + (i / denom) * innerW;
          const y = padY + (1 - d.value / max) * innerH;
          return (
            <g key={d.label}>
              <circle cx={x} cy={y} r={3} fill={color} />
              <title>{`${d.label}: ${d.value}`}</title>
            </g>
          );
        })}
        {data.map((d, i) => {
          const denom = Math.max(1, data.length - 1);
          if (i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
          const x = padX + (i / denom) * innerW;
          return (
            <text
              key={`lbl-${d.label}`}
              x={x}
              y={height + 16}
              textAnchor="middle"
              fontSize={7}
              fill="#94a3b8"
            >
              {d.label.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

type DonutSlice = { label: string; value: number; color: string };

export function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const r = 50;
  const cx = 60;
  const cy = 60;
  let cumAngle = -Math.PI / 2;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-28 shrink-0" aria-label="Donut chart">
        {slices.map((s) => {
          const angle = (s.value / total) * 2 * Math.PI;
          const x1 = cx + r * Math.cos(cumAngle);
          const y1 = cy + r * Math.sin(cumAngle);
          cumAngle += angle;
          const x2 = cx + r * Math.cos(cumAngle);
          const y2 = cy + r * Math.sin(cumAngle);
          const largeArc = angle > Math.PI ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return (
            <g key={s.label}>
              <path d={d} fill={s.color} opacity={0.85} />
              <title>{`${s.label}: ${s.value}`}</title>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={28} fill="white" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#334155" fontWeight="600">
          {total}
        </text>
      </svg>
      <ul className="space-y-1 text-xs text-slate-700">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
