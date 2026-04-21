type Props = {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
};

export function Pagination({ page, pages, total, onPage }: Props) {
  if (pages <= 1) return null;

  const window = 2;
  const nums: number[] = [];
  for (let i = Math.max(1, page - window); i <= Math.min(pages, page + window); i++) {
    nums.push(i);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <p>{total.toLocaleString()} total</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 transition-premium hover:bg-slate-50 disabled:opacity-40"
        >
          ‹
        </button>
        {nums[0] > 1 && (
          <>
            <button type="button" onClick={() => onPage(1)} className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 transition-premium hover:bg-slate-50">1</button>
            {nums[0] > 2 && <span className="px-1">…</span>}
          </>
        )}
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            className={`rounded-xl border px-2.5 py-1.5 transition-premium ${
              n === page ? 'border-brand bg-brand-muted font-semibold text-brand' : 'border-black/10 bg-white hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
        {nums[nums.length - 1] < pages && (
          <>
            {nums[nums.length - 1] < pages - 1 && <span className="px-1">…</span>}
            <button type="button" onClick={() => onPage(pages)} className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 transition-premium hover:bg-slate-50">{pages}</button>
          </>
        )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 transition-premium hover:bg-slate-50 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );
}
