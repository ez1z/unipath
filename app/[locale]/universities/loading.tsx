export default function Loading() {
  return (
    <>
      <div className="bg-background border-b border-border animate-pulse">
        <div className="container mx-auto px-4 pt-7 pb-6">
          <div className="h-8 w-44 bg-muted rounded" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 animate-pulse">
        {/* Filter bar skeleton */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm flex gap-3 flex-wrap">
          <div className="h-10 flex-1 min-w-48 bg-muted rounded-lg" />
          <div className="h-10 w-44 bg-muted rounded-lg" />
          <div className="h-10 w-40 bg-muted rounded-lg" />
          <div className="h-10 w-52 bg-muted rounded-lg" />
        </div>
        {/* Count */}
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border border-l-[3px] border-l-primary/30 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-24 bg-muted rounded" />
                <div className="h-10 w-20 bg-muted rounded" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-12 bg-muted rounded" />
                <div className="h-5 w-14 bg-muted rounded" />
              </div>
              <div className="h-4 w-20 bg-muted rounded mt-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
