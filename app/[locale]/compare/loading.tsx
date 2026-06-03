export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-9 w-64 bg-muted rounded animate-pulse mb-8" />
      <div className="grid grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-6 h-64 bg-muted" />
        ))}
      </div>
    </div>
  );
}
