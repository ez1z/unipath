export default function Loading() {
  return (
    <>
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-5 pt-8 pb-6 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded" />
        </div>
      </div>
      <div className="container mx-auto px-5 py-8 max-w-3xl animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
    </>
  );
}
