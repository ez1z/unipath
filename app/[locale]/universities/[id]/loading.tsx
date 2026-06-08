export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 animate-pulse">
          <div className="h-4 w-40 bg-white/10 rounded mb-5" />
          <div className="h-10 bg-white/10 rounded w-2/3 mb-2" />
          <div className="h-4 bg-white/10 rounded w-1/3" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`} />
          ))}
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 max-w-3xl animate-pulse">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border border-t-4 border-t-primary rounded-xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-20 mb-3" />
            <div className="h-6 bg-muted rounded w-40" />
          </div>
          <div className="bg-card border border-border border-t-4 border-t-gold rounded-xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-24 mb-3" />
            <div className="h-6 bg-muted rounded w-20" />
          </div>
        </div>
        {/* Sections */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-6">
            <div className="h-4 bg-muted rounded w-32 mb-3" />
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-7 w-20 bg-muted rounded-full" />
              ))}
            </div>
          </div>
        ))}
        {/* Action buttons */}
        <div className="flex gap-3 mt-8 pt-4 border-t border-border">
          <div className="flex-1 h-12 bg-muted rounded-lg" />
          <div className="flex-1 h-12 bg-muted rounded-lg" />
        </div>
      </div>
    </>
  );
}
