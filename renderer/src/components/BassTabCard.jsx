export default function BassTabCard({ index, start, end, tabs }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="badge">Bar {index + 1}</span>
        <span className="text-xs text-zinc-500">{start.toFixed(2)}s → {end.toFixed(2)}s</span>
      </div>
      <div className="mt-2 text-xl font-mono font-bold">
        {tabs.map((t, i) => (
          <span key={i} className="mr-2">{t.display}</span>
        ))}
      </div>
    </div>
  );
}
