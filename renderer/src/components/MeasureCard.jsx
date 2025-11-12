import { toNashville } from '../lib/nashville.js';

function formatChord(chord) {
  return chord.replace(/maj/g, 'M');
}

export default function MeasureCard({ measureIndex, chords, keyRoot, keyMode, showTimestamps, displayMode, beatsPerMeasure = 4 }) {
  // Create an array representing each beat in the measure
  const beats = Array(beatsPerMeasure).fill('.');

  // Calculate which beat each chord starts on
  const measureStart = chords[0].start;
  const measureDuration = chords[chords.length - 1].end - measureStart;
  const beatDuration = measureDuration / beatsPerMeasure;

  chords.forEach((chord) => {
    const relativeStart = chord.start - measureStart;
    const beatIndex = Math.floor(relativeStart / beatDuration);
    if (beatIndex >= 0 && beatIndex < beatsPerMeasure) {
      const nash = toNashville(chord.chord, keyRoot, keyMode);
      let displayText = '';

      if (displayMode === 'chords') {
        beats[beatIndex] = { chord: formatChord(chord.chord), nash: null };
      } else if (displayMode === 'degrees') {
        beats[beatIndex] = { chord: nash, nash: null };
      } else { // both
        beats[beatIndex] = { chord: formatChord(chord.chord), nash: nash };
      }
    }
  });

  return (
    <div className="chord-card flex items-center">
      <div className="chord-number">{measureIndex + 1}</div>
      <div className="flex-1 flex items-center justify-around px-4 py-3 gap-2">
        {beats.map((beat, idx) => (
          <div key={idx} className="flex-1 text-center flex flex-col items-center justify-center">
            {beat === '.' ? (
              <span className="text-zinc-400 text-2xl">•</span>
            ) : (
              <>
                <span className="text-lg font-bold text-zinc-900 leading-tight">{beat.chord}</span>
                {beat.nash && (
                  <span className="text-xs text-emerald-600 font-semibold mt-0.5">{beat.nash}</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {showTimestamps && (
        <div className="chord-timestamp">{chords[0].start.toFixed(1)}s</div>
      )}
    </div>
  );
}
