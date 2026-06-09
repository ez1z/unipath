export default function Loading() {
  return (
    <>
      <div className="bg-background border-b border-border animate-pulse">
        <div className="container mx-auto px-4 pt-7 pb-6">
          <div className="h-8 w-64 bg-muted rounded mb-2" />
          <div className="h-4 w-80 bg-muted rounded" />
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
