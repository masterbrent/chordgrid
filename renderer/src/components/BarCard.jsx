export default function BarCard({ index, chord, start, end, nash, showTimestamps, displayMode }) {
  return (
    <div className="chord-card">
      <div className="chord-number">{index + 1}</div>
      {displayMode === 'chords' && (
        <div className="chord-name">{chord}</div>
      )}
      {displayMode === 'degrees' && (
        <div className="chord-name">{nash}</div>
      )}
      {displayMode === 'both' && (
        <>
          <div className="chord-name">{chord}</div>
          <div className="chord-nashville">{nash}</div>
        </>
      )}
      {showTimestamps && (
        <div className="chord-timestamp">{start.toFixed(1)}s</div>
      )}
    </div>
  );
}
