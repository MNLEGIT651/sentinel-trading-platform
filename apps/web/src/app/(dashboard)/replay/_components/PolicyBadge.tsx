export function PolicyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-700/50 px-2 py-1">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}
