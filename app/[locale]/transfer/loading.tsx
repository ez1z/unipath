export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 flex items-center justify-between animate-pulse">
          <div>
            <div className="h-9 w-64 bg-white/10 rounded mb-2" />
            <div className="h-4 w-80 bg-white/10 rounded" />
          </div>
          <div className="w-14 h-14 bg-white/10 rounded-full hidden sm:block" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`} />
          ))}
        </div>
      </div>
      <div className="container mx-auto px-4 py-10 max-w-3xl animate-pulse">
        {/* Calculator card skeleton */}
        <div className="bg-card border border-border rounded-xl p-6 mb-10 shadow-card">
          <div className="h-6 bg-muted rounded w-44 mb-2" />
          <div className="h-4 bg-muted rounded w-72 mb-6" />
          <div className="h-10 bg-muted rounded w-full mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        </div>
        {/* Steps skeleton */}
        <div className="h-6 bg-muted rounded w-48 mb-6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 mb-6">
            <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="h-5 bg-muted rounded w-48 mb-2" />
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
