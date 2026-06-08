export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 animate-pulse">
          <div className="h-4 w-32 bg-white/10 rounded mb-5" />
          <div className="flex gap-2 items-start mb-2">
            <div className="h-10 bg-white/10 rounded w-2/3" />
            <div className="h-6 w-20 bg-white/10 rounded-full mt-1" />
          </div>
          <div className="h-4 bg-white/10 rounded w-24" />
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
          <div className="bg-card border border-border border-t-4 border-t-tk-green rounded-xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-20 mb-3" />
            <div className="h-6 bg-muted rounded w-44" />
          </div>
          <div className="bg-card border border-border border-t-4 border-t-gold rounded-xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-16 mb-3" />
            <div className="h-6 bg-muted rounded w-24" />
          </div>
        </div>
        {/* Coverage */}
        <div className="mb-6">
          <div className="h-4 bg-muted rounded w-28 mb-3" />
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-7 w-24 bg-muted rounded-full" />
            ))}
          </div>
        </div>
        {/* Apply button */}
        <div className="h-12 w-36 bg-muted rounded-lg mt-8" />
      </div>
    </>
  );
}
