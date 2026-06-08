export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border shadow-card p-8 animate-pulse space-y-5">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-muted rounded-full" />
            <div className="h-7 w-28 bg-muted rounded" />
          </div>
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="h-10 bg-muted rounded-md" />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-muted" />
            <div className="h-4 w-8 bg-muted rounded" />
            <div className="flex-1 h-px bg-muted" />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-10 bg-muted rounded-md" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-10 bg-muted rounded-md" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-10 bg-muted rounded-md" />
            </div>
            <div className="h-10 bg-muted rounded-md" />
          </div>
          <div className="h-4 w-48 bg-muted rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
