export default function Loading() {
  return (
    <>
      <div className="bg-background border-b border-border animate-pulse">
        <div className="container mx-auto px-4 pt-7 pb-6">
          <div className="h-8 w-56 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted rounded" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 animate-pulse">
        {/* Selector */}
        <div className="h-10 w-full max-w-sm bg-muted rounded-lg mb-8" />
        {/* Compare table placeholder */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="h-14 bg-primary/20" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex border-t border-border">
              <div className="w-32 px-4 py-3 bg-muted/30 flex-shrink-0">
                <div className="h-3 bg-muted rounded w-20" />
              </div>
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex-1 px-4 py-3 border-l border-border">
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
