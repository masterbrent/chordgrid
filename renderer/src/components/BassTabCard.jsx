export default function BassTabCard({ index, start, end, tabs, showTimestamps }) {
  return (
    <div className="chord-card">
      <div className="chord-number">{index + 1}</div>
      <div className="chord-name font-mono">
        {tabs.map((t, i) => (
          <span key={i} className="mr-1.5">{t.display}</span>
        ))}
      </div>
      {showTimestamps && (
        <div className="chord-timestamp">{start.toFixed(1)}s</div>
      )}
    </div>
  );
}
