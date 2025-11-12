export default function BarCard({ index, chord, start, end, nash, showTimestamps }) {
  return (
    <div className="chord-card">
      <div className="chord-number">{index + 1}</div>
      <div className="chord-name">{chord}</div>
      <div className="chord-nashville">{nash}</div>
      {showTimestamps && (
        <div className="chord-timestamp">{start.toFixed(1)}s</div>
      )}
    </div>
  );
}
