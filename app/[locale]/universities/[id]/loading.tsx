export default function Loading() {
  return (
    <>
      <div className="bg-white border-b border-border animate-pulse">
        <div className="container mx-auto px-5 pt-8 pb-0">
          <div className="h-3 w-36 bg-muted rounded mb-5" />
          <div className="h-8 bg-muted rounded w-2/3 mb-2" />
          <div className="h-4 bg-muted rounded w-1/3 mb-6" />
          <div className="h-px bg-gradient-to-r from-gold/20 via-gold/5 to-transparent" />
        </div>
      </div>
      <div className="container mx-auto px-5 py-8 max-w-3xl animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border border-t-2 border-t-primary rounded-2xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-20 mb-3" />
            <div className="h-6 bg-muted rounded w-40" />
          </div>
          <div className="bg-card border border-border border-t-2 border-t-gold rounded-2xl p-5 shadow-card">
            <div className="h-3 bg-muted rounded w-24 mb-3" />
            <div className="h-6 bg-muted rounded w-20" />
          </div>
        </div>
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
        <div className="flex gap-3 mt-8 pt-4 border-t border-border">
          <div className="flex-1 h-12 bg-muted rounded-lg" />
          <div className="flex-1 h-12 bg-muted rounded-lg" />
        </div>
      </div>
    </>
  );
}
