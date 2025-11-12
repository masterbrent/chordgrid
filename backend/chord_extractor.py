#!/usr/bin/env python3
"""
Chord and bass extraction from YouTube videos using librosa and yt-dlp
Refactored for use as a library (not just CLI)
"""
import subprocess, os, sys, json, tempfile, numpy as np, librosa, soundfile as sf

MAJ_TPL = np.array([1,0,0,0,1,0,0,1,0,0,0,0], float)  # Major: Root, M3, P5
MIN_TPL = np.array([1,0,0,1,0,0,0,1,0,0,0,0], float)  # Minor: Root, m3, P5
DOM7_TPL = np.array([1,0,0,0,1,0,0,1,0,0,1,0], float)  # Dom7: Root, M3, P5, m7
MIN7_TPL = np.array([1,0,0,1,0,0,0,1,0,0,1,0], float)  # Min7: Root, m3, P5, m7
MAJ7_TPL = np.array([1,0,0,0,1,0,0,1,0,0,0,1], float)  # Maj7: Root, M3, P5, M7
PITCHES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

TEMPLATES = []
LABELS = []
for r in range(12):
    # Major and minor triads
    TEMPLATES.append(np.roll(MAJ_TPL, r)); LABELS.append(PITCHES[r])
    TEMPLATES.append(np.roll(MIN_TPL, r)); LABELS.append(PITCHES[r] + "m")
    # 7th chords
    TEMPLATES.append(np.roll(DOM7_TPL, r)); LABELS.append(PITCHES[r] + "7")
    TEMPLATES.append(np.roll(MIN7_TPL, r)); LABELS.append(PITCHES[r] + "m7")
    TEMPLATES.append(np.roll(MAJ7_TPL, r)); LABELS.append(PITCHES[r] + "maj7")
TEMPLATES = np.vstack(TEMPLATES)
# Note: We now have 60 chord templates (12 pitches × 5 chord types)

def download_audio(url, outwav):
    cmd = [
        "yt-dlp",
        "-f", "bestaudio/best",
        "-x",
        "--audio-format", "wav",
        "--extractor-args", "youtube:player_client=android,web",
        "-o", outwav,
        url
    ]
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return outwav
    except subprocess.CalledProcessError as e:
        error_msg = f"yt-dlp failed: {e.stderr if e.stderr else e.stdout}"
        raise Exception(error_msg)

def key_estimate_from_chroma(chroma):
    maj = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
    min = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
    v = chroma.mean(axis=1)
    sims_maj = [np.corrcoef(v, np.roll(maj, i))[0,1] for i in range(12)]
    sims_min = [np.corrcoef(v, np.roll(min, i))[0,1] for i in range(12)]
    if max(sims_maj) >= max(sims_min):
        tonic = PITCHES[int(np.argmax(sims_maj))]
        return {"tonic": tonic, "mode": "major"}
    else:
        tonic = PITCHES[int(np.argmax(sims_min))]
        return {"tonic": tonic, "mode": "minor"}

def loglik(vec):
    v = vec / (np.linalg.norm(vec) + 1e-9)
    templ = TEMPLATES / (np.linalg.norm(TEMPLATES, axis=1, keepdims=True) + 1e-9)
    sims = templ @ v
    # Convert similarity to cost (higher similarity = lower cost)
    # Use negative correlation as cost
    return 1.0 - sims

def viterbi(costs, stay=0.975, change=0.025):
    T, S = costs.shape
    trans = np.full((S, S), change, float)
    np.fill_diagonal(trans, stay)
    trans = -np.log(trans / trans.sum(axis=1, keepdims=True))
    dp = np.zeros((T, S)); back = np.zeros((T, S), int)
    dp[0] = costs[0]
    for t in range(1, T):
        prev = dp[t-1][:, None] + trans
        back[t] = prev.argmin(axis=0)
        dp[t] = costs[t, np.arange(S)] + prev.min(axis=0)
    path = [int(dp[-1].argmin())]
    for t in range(T-1, 0, -1):
        path.append(int(back[t, path[-1]]))
    return path[::-1]

def segment(labels, times):
    out = []
    cur = labels[0]; start = times[0]
    for i in range(1, len(labels)):
        if labels[i] != cur:
            out.append({"start": float(start), "end": float(times[i]), "chord": cur})
            cur = labels[i]; start = times[i]
    out.append({"start": float(start), "end": float(times[-1]), "chord": cur})
    return out

def bars_from_beats(segments, beats, timesig="4/4"):
    if timesig == "3/4": beats_per_bar = 3
    elif timesig == "6/8": beats_per_bar = 6
    else: beats_per_bar = 4
    if len(beats) < beats_per_bar + 1:
        return segments
    bar_edges = beats[::beats_per_bar]
    if bar_edges[-1] < beats[-1]:
        bar_edges = np.append(bar_edges, beats[-1])
    bars = []
    for b in range(len(bar_edges)-1):
        start = float(bar_edges[b]); end = float(bar_edges[b+1])
        best = "N"; best_ov = 0.0
        for seg in segments:
            ov = max(0.0, min(end, seg["end"]) - max(start, seg["start"]))
            if ov > best_ov:
                best_ov = ov; best = seg["chord"]
        bars.append({"start": start, "end": end, "chord": best})
    return bars

def extract_bass_notes(y, sr, beat_times):
    """Extract bass notes from audio using pitch tracking on low frequencies"""
    # Filter for bass frequencies (40-250 Hz roughly E1 to B3)
    from scipy import signal
    nyquist = sr / 2
    low_cutoff = 40 / nyquist
    high_cutoff = 250 / nyquist
    b, a = signal.butter(4, [low_cutoff, high_cutoff], btype='band')
    y_bass = signal.filtfilt(b, a, y)

    # Extract pitch using piptrack (more accurate for bass)
    pitches, magnitudes = librosa.piptrack(y=y_bass, sr=sr, fmin=40, fmax=250, threshold=0.1)

    # Sync to beats
    times_with_end = np.append(beat_times, librosa.get_duration(y=y, sr=sr))
    beat_frames = librosa.time_to_frames(beat_times, sr=sr)

    bass_notes = []
    for i in range(len(beat_times)):
        start_frame = beat_frames[i]
        end_frame = beat_frames[i+1] if i+1 < len(beat_frames) else pitches.shape[1]

        # Get the strongest pitch in this beat segment
        segment_pitches = pitches[:, start_frame:end_frame]
        segment_mags = magnitudes[:, start_frame:end_frame]

        # Find the bin with highest magnitude
        max_idx = np.unravel_index(np.argmax(segment_mags), segment_mags.shape)
        pitch = segment_pitches[max_idx]

        if pitch > 0:
            # Convert Hz to MIDI note
            midi_note = librosa.hz_to_midi(pitch)
            bass_notes.append({
                "start": float(beat_times[i]),
                "end": float(times_with_end[i+1]),
                "pitch_hz": float(pitch),
                "midi_note": int(round(midi_note)),
                "note_name": librosa.midi_to_note(int(round(midi_note)))
            })
        else:
            bass_notes.append({
                "start": float(beat_times[i]),
                "end": float(times_with_end[i+1]),
                "pitch_hz": 0,
                "midi_note": 0,
                "note_name": "N"
            })

    return bass_notes

def note_to_bass_tab(midi_note):
    """Convert MIDI note to bass guitar tablature (4-string: E1=28, A1=33, D2=38, G2=43)"""
    if midi_note == 0:
        return {"string": 0, "fret": -1, "display": "—"}

    # Standard bass tuning: E1(28), A1(33), D2(38), G2(43)
    strings = [
        ("G", 43),  # String 1 (highest)
        ("D", 38),  # String 2
        ("A", 33),  # String 3
        ("E", 28),  # String 4 (lowest)
    ]

    # Find the best string for this note
    for string_idx, (string_name, open_note) in enumerate(strings):
        if midi_note >= open_note and midi_note < open_note + 20:  # Up to 20 frets
            fret = midi_note - open_note
            return {"string": 4 - string_idx, "fret": fret, "display": f"{string_name}{fret}"}

    # If out of range, show on closest string
    if midi_note < 28:
        fret = midi_note - 28
        return {"string": 4, "fret": fret, "display": f"E{fret}"}
    else:
        fret = midi_note - 43
        return {"string": 1, "fret": fret, "display": f"G{fret}"}


def analyze_youtube_url(url, timesig="4/4", mode="chords"):
    """
    Main analysis function - downloads and analyzes YouTube audio

    Args:
        url: YouTube URL
        timesig: Time signature like "4/4", "3/4", "6/8"
        mode: "chords" or "bass"

    Returns:
        Dictionary with analysis results
    """
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "audio.wav")
        download_audio(url, wav)
        y, sr = librosa.load(wav, sr=22050, mono=True)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr, trim=False)
        beat_times = librosa.frames_to_time(beats, sr=sr)

        if mode == 'bass':
            # Extract bass notes and convert to tablature
            bass_notes = extract_bass_notes(y, sr, beat_times)
            # Convert to bar format and add tab info
            bars = []
            if timesig == "3/4": beats_per_bar = 3
            elif timesig == "6/8": beats_per_bar = 6
            else: beats_per_bar = 4

            # Group beats into bars
            for bar_idx in range(0, len(bass_notes), beats_per_bar):
                bar_notes = bass_notes[bar_idx:bar_idx + beats_per_bar]
                if bar_notes:
                    tabs = [note_to_bass_tab(note["midi_note"]) for note in bar_notes]
                    bars.append({
                        "start": bar_notes[0]["start"],
                        "end": bar_notes[-1]["end"],
                        "notes": bar_notes,
                        "tabs": tabs
                    })

            result = {
                "source": url,
                "title": None,
                "bpm": float(tempo.item()) if hasattr(tempo, 'item') else float(tempo),
                "key": None,
                "time_signature": timesig,
                "mode": "bass",
                "segments": bars
            }
        else:
            # Original chord detection
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=36)
            # Use mean instead of median for better chord change sensitivity
            chroma_sync = librosa.util.sync(chroma, beats, aggregate=np.mean)
            chroma_sync = chroma_sync / (chroma_sync.sum(axis=0, keepdims=True) + 1e-9)
            key = key_estimate_from_chroma(chroma_sync)
            costs = np.stack([loglik(chroma_sync[:, t]) for t in range(chroma_sync.shape[1])], axis=0)
            # Use viterbi with balanced probabilities to allow more chord variety
            # stay=0.4 means 40% stay, 60% distributed among 59 other chords (~1% each)
            path = viterbi(costs, stay=0.4, change=0.6)
            labels = [LABELS[s] for s in path]
            # Append audio duration as the end time for the last segment
            duration = librosa.get_duration(y=y, sr=sr)
            times_with_end = np.append(beat_times, duration)
            segs = segment(labels, times_with_end)
            # Return raw segments to capture all chord changes
            result = {
                "source": url,
                "title": None,
                "bpm": float(tempo.item()) if hasattr(tempo, 'item') else float(tempo),
                "key": key,
                "time_signature": timesig,
                "mode": "chords",
                "segments": segs
            }

        return result


def main():
    """CLI entry point - kept for backward compatibility"""
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', required=True)
    ap.add_argument('--timesig', default='4/4')
    ap.add_argument('--mode', default='chords', choices=['chords', 'bass'])
    args = ap.parse_args()

    result = analyze_youtube_url(args.url, args.timesig, args.mode)
    print(json.dumps(result))
    sys.exit(0)

if __name__ == "__main__":
    main()
