import { useMemo, useState } from 'react';
import BarCard from './components/BarCard.jsx';
import BassTabCard from './components/BassTabCard.jsx';
import MeasureCard from './components/MeasureCard.jsx';
import DropdownMenu from './components/DropdownMenu.jsx';
import SegmentedControl from './components/SegmentedControl.jsx';
import { toNashville } from './lib/nashville.js';

// Group chord segments into measures based on BPM and time signature
function groupIntoMeasures(segments, bpm, timeSig = '4/4') {
  if (!segments || segments.length === 0) return [];

  const beatsPerMeasure = timeSig === '3/4' ? 3 : timeSig === '6/8' ? 6 : 4;
  const secondsPerBeat = 60 / bpm;
  const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;

  const measures = [];
  let currentMeasure = [];
  let measureStart = segments[0].start;
  let measureEnd = measureStart + secondsPerMeasure;

  for (const segment of segments) {
    // If segment starts in current measure, add it
    if (segment.start < measureEnd) {
      currentMeasure.push(segment);
    } else {
      // Save current measure and start new one
      if (currentMeasure.length > 0) {
        measures.push(currentMeasure);
      }
      currentMeasure = [segment];
      measureStart = measureEnd;
      measureEnd = measureStart + secondsPerMeasure;
    }
  }

  // Don't forget the last measure
  if (currentMeasure.length > 0) {
    measures.push(currentMeasure);
  }

  return measures;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [timeSig, setTimeSig] = useState('4/4');
  const [outputMode, setOutputMode] = useState('chords');
  const [log, setLog] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [displayMode, setDisplayMode] = useState('both'); // 'chords', 'degrees', 'both'

  const meta = useMemo(() => {
    if (!result) return null;
    const { bpm, key, time_signature, segments } = result;
    return {
      bpm: bpm ? Math.round(bpm) : '—',
      keyText: key ? `${key.tonic} ${key.mode}` : '—',
      time: time_signature || '4/4',
      changes: segments?.length || 0
    };
  }, [result]);

  const bars = result?.segments || [];
  const keyRoot = result?.key?.tonic || 'C';
  const keyMode = result?.key?.mode || 'major';

  const measures = useMemo(() => {
    if (!result || result.mode === 'bass') return [];
    return groupIntoMeasures(bars, meta?.bpm || 120, result.time_signature);
  }, [result, bars, meta]);

  async function analyze() {
    setBusy(true);
    setLog('');
    setResult(null);
    try {
      setLog('Analyzing via API server...\n');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url, options: { timesig: timeSig, mode: outputMode } })
      }).catch(err => {
        setLog((p) => p + `Fetch error: ${err.message}\n`);
        throw new Error(`Network error: ${err.message}. Is the API server running?`);
      });

      setLog((p) => p + `Response status: ${response.status}\n`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }
      const r = await response.json();
      setLog((p) => p + 'Analysis complete!\n');
      setResult(r);
    } catch (e) {
      setLog((p) => p + '\nERROR: ' + e.message + '\n');
    } finally {
      setBusy(false);
    }
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function exportJson() {
    if (!result) return;
    download('chords.json', JSON.stringify(result, null, 2));
  }

  function exportCsv() {
    if (!result) return;
    const rows = result.segments.map((s, i) => `${i+1},${s.start},${s.end},${s.chord}`);
    download('chords.csv', ['bar,start,end,chord', ...rows].join('\n'));
  }

  function exportPro() {
    if (!result) return;
    const lines = result.segments
      .filter(s => s.chord !== 'N')
      .map(s => `[${s.chord}]  # ${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s`);
    download('chords.pro', lines.join('\n'));
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">ChordGrid</h1>
            <p className="text-sm text-zinc-600 mt-1">YouTube → bar-aligned chords with Nashville numbers</p>
          </div>
          {bars.length > 0 && (
            <DropdownMenu
              trigger="Export"
              items={[
                { label: 'Export JSON', onClick: exportJson },
                { label: 'Export CSV', onClick: exportCsv },
                ...(result?.mode !== 'bass' ? [{ label: 'Export ChordPro', onClick: exportPro }] : [])
              ]}
            />
          )}
        </div>
      </header>

      <section className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className="input flex-1"
            placeholder="Paste YouTube URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <select className="select" value={outputMode} onChange={(e) => setOutputMode(e.target.value)}>
            <option value="chords">Chords</option>
            <option value="bass">Bass Tabs</option>
          </select>
          <select className="select" value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
          </select>
          <button className="btn" onClick={analyze} disabled={busy || !url}>
            {busy ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <pre className="mt-4 h-40 overflow-auto bg-zinc-900 text-emerald-100 rounded-xl p-3 text-xs">{log || 'Logs will appear here...'}</pre>
      </section>

      {bars.length > 0 && (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900">
                {result?.mode === 'bass' ? 'Bass Tablature' : 'Chord Changes'}
              </h2>
              {meta && (
                <div className="text-sm text-zinc-600 flex items-center gap-4 bg-zinc-50 px-4 py-2 rounded-lg border border-zinc-200">
                  <span>BPM: <b className="text-zinc-900">{meta.bpm}</b></span>
                  <span>Key: <b className="text-zinc-900">{meta.keyText}</b></span>
                  <span>Time: <b className="text-zinc-900">{meta.time}</b></span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-4 items-center">
                {result && result.mode === 'chords' && (
                  <SegmentedControl
                    label="Display:"
                    value={displayMode}
                    onChange={setDisplayMode}
                    options={[
                      { value: 'chords', label: 'Chords' },
                      { value: 'degrees', label: 'Degrees' },
                      { value: 'both', label: 'Both' }
                    ]}
                  />
                )}
                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTimestamps}
                    onChange={(e) => setShowTimestamps(e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                  Show timestamps
                </label>
              </div>
            </div>
          </section>

          <section className="grid-bars">
            {result?.mode === 'bass' ? (
              bars.map((b, i) => (
                <BassTabCard
                  key={i}
                  index={i}
                  start={b.start}
                  end={b.end}
                  tabs={b.tabs || []}
                  showTimestamps={showTimestamps}
                />
              ))
            ) : (
              measures.map((measureChords, i) => {
                const beatsPerMeasure = timeSig === '3/4' ? 3 : timeSig === '6/8' ? 6 : 4;
                return (
                  <MeasureCard
                    key={i}
                    measureIndex={i}
                    chords={measureChords}
                    keyRoot={keyRoot}
                    keyMode={keyMode}
                    showTimestamps={showTimestamps}
                    displayMode={displayMode}
                    beatsPerMeasure={beatsPerMeasure}
                  />
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
