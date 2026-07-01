export default function Loading() {
  return (
    <>
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-5 pt-8 pb-6 animate-pulse">
          <div className="h-8 w-64 bg-muted rounded" />
        </div>
      </div>
      <div className="container mx-auto px-5 py-8 max-w-3xl animate-pulse space-y-4">
        <div className="h-28 bg-muted rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </>
  );
}
