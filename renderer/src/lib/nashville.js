const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const DEG_ROM = ["I","bII","II","bIII","III","IV","bV","V","bVI","VI","bVII","VII"];

function normalizeRootLabel(chord) {
  const m = chord.match(/^[A-G](#|b)?/);
  if (!m) return null;
  const r = m[0];
  return r
    .replace('Db','C#')
    .replace('Eb','D#')
    .replace('Gb','F#')
    .replace('Ab','G#')
    .replace('Bb','A#');
}

export function toNashville(chordLabel, keyRoot = 'C', keyMode = 'major') {
  if (!chordLabel || chordLabel === 'N') return '—';
  const root = normalizeRootLabel(chordLabel);
  if (!root) return '?';
  const quality = chordLabel.slice(root.length).toLowerCase();

  const rootIdx = NAMES.indexOf(root);
  const keyIdx = NAMES.indexOf(keyRoot);
  const diff = (rootIdx - keyIdx + 12) % 12;

  let roman = DEG_ROM[diff] || '?';
  const isMinorish = quality.startsWith('m') || quality.includes('dim');
  if (isMinorish) roman = roman.toLowerCase();

  if (quality.includes('maj7')) roman += 'maj7';
  else if (quality.includes('m7')) roman += '7';
  else if (quality.includes('7')) roman += '7';

  return roman;
}
