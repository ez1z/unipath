export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-6" />
      <div className="h-9 w-2/3 bg-muted rounded mb-2" />
      <div className="h-4 w-1/3 bg-muted rounded mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-4 h-20 bg-muted" />
        <div className="border rounded-lg p-4 h-20 bg-muted" />
      </div>
    </div>
  );
}
