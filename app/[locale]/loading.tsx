export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="bg-brand-dark">
        <div className="container mx-auto px-5 py-16 sm:py-24 text-center">
          <div className="h-3 bg-white/10 rounded w-32 mx-auto mb-5" />
          <div className="h-12 bg-white/10 rounded-lg w-80 mx-auto mb-4" />
          <div className="h-5 bg-white/10 rounded w-96 mx-auto mb-10" />
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <div className="h-12 w-44 bg-white/10 rounded-lg mx-auto sm:mx-0" />
            <div className="h-12 w-44 bg-white/10 rounded-lg mx-auto sm:mx-0" />
          </div>
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="container mx-auto px-5 mt-6 sm:mt-20 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto sm:-mt-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-border shadow-card p-6 border-t-2 border-t-gold">
              <div className="h-10 bg-muted rounded w-12 mx-auto mb-2" />
              <div className="h-4 bg-muted rounded w-24 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Features skeleton */}
      <div className="container mx-auto px-5 py-16 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-3xl mx-auto">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="w-7 h-0.5 bg-gold/30 mb-5" />
              <div className="h-5 bg-muted rounded w-32 mb-3" />
              <div className="space-y-2">
                <div className="h-3.5 bg-muted rounded w-full" />
                <div className="h-3.5 bg-muted rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
