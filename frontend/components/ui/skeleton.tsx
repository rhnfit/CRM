export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-2xl bg-slate-100 ${className}`} />;
}

export function SkeletonKpiGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-3 h-10 w-28" />
          <SkeletonBlock className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
