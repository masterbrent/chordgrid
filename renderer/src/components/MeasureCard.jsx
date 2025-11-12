import { toNashville } from '../lib/nashville.js';

function formatChord(chord) {
  return chord.replace(/maj/g, 'M');
}

export default function MeasureCard({ measureIndex, chords, keyRoot, keyMode, showTimestamps, displayMode }) {
  // Calculate the total duration of the measure
  const totalDuration = chords[chords.length - 1].end - chords[0].start;

  return (
    <div className="chord-card p-0 flex overflow-hidden">
      <div className="chord-number">{measureIndex + 1}</div>
      {chords.map((chord, idx) => {
        const duration = chord.end - chord.start;
        const proportion = duration / totalDuration;
        const nash = toNashville(chord.chord, keyRoot, keyMode);

        return (
          <div
            key={idx}
            className="flex-shrink-0 flex flex-col items-center justify-center p-3 relative border-r border-zinc-300 last:border-r-0"
            style={{ flexBasis: `${proportion * 100}%` }}
          >
            {displayMode === 'chords' && (
              <div className="chord-name">{formatChord(chord.chord)}</div>
            )}
            {displayMode === 'degrees' && (
              <div className="chord-name">{nash}</div>
            )}
            {displayMode === 'both' && (
              <>
                <div className="chord-name">{formatChord(chord.chord)}</div>
                <div className="chord-nashville">{nash}</div>
              </>
            )}
            {showTimestamps && idx === 0 && (
              <div className="chord-timestamp">{chord.start.toFixed(1)}s</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
