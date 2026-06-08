export default function Loading() {
  return (
    <>
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10">
          <div className="h-9 w-44 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`} />
          ))}
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
