export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="h-7 w-56 bg-ink-200 rounded mb-2 animate-pulse" />
      <div className="h-4 w-72 bg-ink-100 rounded mb-6 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-ink-100 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-72 bg-ink-100 rounded-2xl animate-pulse mb-6" />
      <div className="h-48 bg-ink-100 rounded-2xl animate-pulse" />
    </main>
  );
}
