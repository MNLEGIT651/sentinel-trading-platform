export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <span className="text-xs text-gray-500">{label}</span>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
