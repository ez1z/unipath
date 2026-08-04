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
        {/* Toolbar: add-university picker, columns, export */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="h-10 flex-1 bg-muted rounded-md" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-muted rounded-md" />
            <div className="h-10 w-28 bg-muted rounded-md" />
          </div>
        </div>
        {/* Rows */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="h-11 bg-muted/40 border-b border-border" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-4 border-b border-border last:border-0">
              <div className="h-4 bg-muted rounded w-40 flex-shrink-0" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-4 bg-muted rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
