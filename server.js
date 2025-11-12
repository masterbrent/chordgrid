import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.post('/api/analyze', async (req, res) => {
  console.log('Received analyze request:', req.body);
  const { youtubeUrl, options } = req.body;

  const args = [
    path.join(__dirname, 'backend', 'chord_extractor.py'),
    '--url', youtubeUrl,
    ...(options?.timesig ? ['--timesig', options.timesig] : ['--timesig','4/4']),
    ...(options?.mode ? ['--mode', options.mode] : ['--mode','chords']),
    ...(options?.simplified ? ['--simplified'] : [])
  ];

  const py = spawn(process.platform === 'win32' ? 'python' : 'python3', args, {
    cwd: path.join(__dirname, 'backend')
  });

  let out = '', err = '';

  py.stdout.on('data', d => {
    const s = d.toString();
    out += s;
    console.log(s);
  });

  py.stderr.on('data', d => {
    const s = d.toString();
    err += s;
    console.error('[stderr]', s);
  });

  py.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    if (code === 0) {
      try {
        const jsonStart = out.indexOf('{');
        const jsonStr = jsonStart >= 0 ? out.slice(jsonStart) : out;
        const result = JSON.parse(jsonStr);
        res.json(result);
      } catch (e) {
        console.error('JSON parse error:', e.message);
        res.status(500).json({
          error: 'Failed to parse backend JSON: ' + e.message,
          stdout: out
        });
      }
    } else {
      console.error(`Python error. Code: ${code}, stderr: ${err}`);
      res.status(500).json({
        error: 'Backend exited with code ' + code,
        stderr: err,
        stdout: out
      });
    }
  });

  // Add timeout handling
  setTimeout(() => {
    if (!py.killed) {
      console.log('Python process timeout - killing');
      py.kill();
      res.status(504).json({ error: 'Processing timeout. Video may be too long.' });
    }
  }, 120000); // 2 minute timeout
});

// Serve static files from the built React app
app.use(express.static(path.join(__dirname, 'renderer', 'dist')));

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChordGrid server running on http://0.0.0.0:${PORT}`);
});
