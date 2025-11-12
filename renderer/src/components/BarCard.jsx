export default function BarCard({ index, chord, start, end, nash }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="badge">Bar {index + 1}</span>
        <span className="text-xs text-zinc-500">{start.toFixed(2)}s → {end.toFixed(2)}s</span>
      </div>
      <div className="mt-2 text-2xl font-bold">{chord}</div>
      <div className="text-emerald-700 font-semibold">{nash}</div>
    </div>
  );
}
