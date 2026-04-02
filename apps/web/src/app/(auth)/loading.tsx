export default function AuthLoading() {
  return (
    <div className="space-y-6 animate-sentinel-in">
      <div className="space-y-2">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-4 w-56 rounded" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-12 rounded" />
          <div className="skeleton h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-16 rounded" />
          <div className="skeleton h-10 w-full rounded-md" />
        </div>
        <div className="skeleton h-10 w-full rounded-md" />
      </div>
      <div className="flex justify-center">
        <div className="skeleton h-3.5 w-48 rounded" />
      </div>
    </div>
  );
}
