export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-full mx-auto mb-6" />
          <div className="h-12 bg-white/10 rounded-lg w-80 mx-auto mb-4" />
          <div className="h-5 bg-white/10 rounded w-96 mx-auto mb-10" />
          <div className="flex justify-center gap-3">
            <div className="h-12 w-44 bg-white/10 rounded-md" />
            <div className="h-12 w-44 bg-white/10 rounded-md" />
          </div>
        </div>
        <div className="h-1.5 w-full flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`} />
          ))}
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="container mx-auto px-4 mt-6 sm:mt-20 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto sm:-mt-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border shadow-card p-6 border-t-4 border-t-gold">
              <div className="h-10 bg-muted rounded w-12 mx-auto mb-2" />
              <div className="h-4 bg-muted rounded w-24 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
