export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-gray-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-200" />
      <div className="h-40 rounded-2xl bg-gray-200" />
    </div>
  );
}
