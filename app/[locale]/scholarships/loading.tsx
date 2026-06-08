export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 flex items-center justify-between">
          <div className="h-9 w-44 bg-white/10 rounded animate-pulse" />
          <div className="w-14 h-14 bg-white/10 rounded-full hidden sm:block animate-pulse" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`} />
          ))}
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 animate-pulse">
        {/* Filter bar skeleton */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm flex gap-3 flex-wrap">
          <div className="h-10 flex-1 min-w-48 bg-muted rounded-lg" />
          <div className="h-10 w-44 bg-muted rounded-lg" />
          <div className="h-10 w-44 bg-muted rounded-lg" />
          <div className="h-10 w-52 bg-muted rounded-lg" />
        </div>
        {/* Count */}
        <div className="h-4 w-40 bg-muted rounded mb-4" />
        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border border-l-[3px] border-l-tk-green/30 rounded-xl p-5 flex flex-col gap-3">
              <div>
                <div className="flex justify-between gap-2 mb-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-5 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="h-5 w-20 bg-muted rounded" />
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-28 bg-muted rounded" />
                <div className="h-10 w-20 bg-muted rounded" />
              </div>
              <div className="h-4 w-16 bg-muted rounded mt-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
