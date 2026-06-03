export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-9 w-48 bg-muted rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 animate-pulse">
            <div className="h-5 bg-muted rounded mb-3 w-3/4" />
            <div className="h-4 bg-muted rounded mb-2 w-1/2" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
