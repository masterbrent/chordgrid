import { useMemo, useState } from 'react';
import BarCard from './components/BarCard.jsx';
import BassTabCard from './components/BassTabCard.jsx';
import { toNashville } from './lib/nashville.js';

export default function App() {
  const [url, setUrl] = useState('');
  const [timeSig, setTimeSig] = useState('4/4');
  const [outputMode, setOutputMode] = useState('chords');
  const [log, setLog] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);

  const meta = useMemo(() => {
    if (!result) return null;
    const { bpm, key, time_signature, segments } = result;
    return {
      bpm: bpm ? Math.round(bpm) : '—',
      keyText: key ? `${key.tonic} ${key.mode}` : '—',
      time: time_signature || '4/4',
      bars: segments?.length || 0
    };
  }, [result]);

  const bars = result?.segments || [];
  const keyRoot = result?.key?.tonic || 'C';
  const keyMode = result?.key?.mode || 'major';

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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ChordGrid</h1>
          <p className="text-sm text-zinc-600">YouTube → bar-aligned chords with Nashville numbers</p>
        </div>
        <div className="text-right">
          {meta && (
            <div className="text-sm text-zinc-600">
              <span className="mr-3">BPM: <b>{meta.bpm}</b></span>
              <span className="mr-3">Key: <b>{meta.keyText}</b></span>
              <span>Time: <b>{meta.time}</b></span>
            </div>
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
          <section className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {result?.mode === 'bass' ? 'Bass Tablature' : 'Bars'}
            </h2>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="rounded"
                />
                Show timestamps
              </label>
              <button className="btn" onClick={exportJson}>Export JSON</button>
              <button className="btn" onClick={exportCsv}>Export CSV</button>
              {result?.mode !== 'bass' && (
                <button className="btn" onClick={exportPro}>Export ChordPro</button>
              )}
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
              bars.map((b, i) => (
                <BarCard
                  key={i}
                  index={i}
                  chord={b.chord}
                  start={b.start}
                  end={b.end}
                  nash={toNashville(b.chord, keyRoot, keyMode)}
                  showTimestamps={showTimestamps}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
