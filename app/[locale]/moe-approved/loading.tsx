export default function MoeApprovedLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-8 w-64 bg-muted rounded animate-pulse mb-8" />
      <div className="h-4 w-96 bg-muted rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
