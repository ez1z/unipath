export default function Loading() {
  return (
    <>
      <div className="bg-background border-b border-border animate-pulse">
        <div className="container mx-auto px-4 pt-7 pb-6">
          <div className="h-8 w-44 bg-muted rounded" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl animate-pulse space-y-5">
        {[80, 200, 140, 280, 80].map((h, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6">
            <div className="h-5 w-40 bg-muted rounded mb-4" />
            <div style={{ height: h }} className="bg-muted rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-36 bg-muted rounded-lg" />
      </div>
    </>
  );
}
