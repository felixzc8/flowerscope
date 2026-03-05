import { state } from './state.js';
import { vcanvas, vctx } from './dom.js';
import { getAccentColor } from './theme.js';

const WINDOW_MS = 1000;
const MAX_PTS = 2048;
const pxs = new Float32Array(MAX_PTS);
const pys = new Float32Array(MAX_PTS);

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function computeVScope(w, h) {
  if (!state.analyser || !state.timeBuf) return 0;

  const sr = state.analyser.context.sampleRate;
  const N = state.analyser.fftSize;
  const winSamples = Math.min(Math.round(sr * WINDOW_MS / 1000), N);
  const start = N - winSamples;

  const steps = Math.min(winSamples, MAX_PTS - 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pos = start + t * winSamples;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const buf = state.filtBuf || state.timeBuf;
    const s0 = buf[idx] || 0;
    const s1 = buf[Math.min(idx + 1, N - 1)] || 0;
    const sample = s0 + (s1 - s0) * frac;
    pxs[i] = w / 2 + sample * w * 0.42;
    pys[i] = t * h;
  }
  return steps;
}

function renderVScopeTo(c, w, h, refH) {
  const steps = computeVScope(w, h);
  if (steps === 0) { c.clearRect(0, 0, w, h); return; }

  c.clearRect(0, 0, w, h);
  const scale = h / refH;

  function makeStroke(alpha) {
    if (state.gradient) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hexAlpha(state.gradColor1, alpha));
      g.addColorStop(1, hexAlpha(state.gradColor2, alpha));
      return g;
    }
    return getAccentColor(alpha);
  }

  c.lineJoin = 'round';
  c.lineCap = 'round';

  function stroke() {
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      i === 0 ? c.moveTo(pxs[i], pys[i]) : c.lineTo(pxs[i], pys[i]);
    }
    c.stroke();
  }

  c.strokeStyle = makeStroke(0.10);
  c.lineWidth = 14 * scale;
  stroke();

  c.strokeStyle = makeStroke(0.18);
  c.lineWidth = 6 * scale;
  stroke();

  c.strokeStyle = makeStroke(1);
  c.lineWidth = 2 * scale;
  stroke();

  if (state.gradient) {
    const hl = c.createLinearGradient(0, 0, 0, h);
    hl.addColorStop(0, hexAlpha(state.gradColor1, 0.4));
    hl.addColorStop(1, hexAlpha(state.gradColor2, 0.4));
    c.strokeStyle = hl;
  } else {
    c.strokeStyle = state.activeHue === null
      ? 'rgba(255,255,255,0.4)'
      : `hsla(${state.activeHue}, 50%, 85%, 0.4)`;
  }
  c.lineWidth = 1 * scale;
  stroke();
}

export function drawVScope() {
  if (state.vDisplayH === 0) return;
  renderVScopeTo(vctx, state.vDisplayW, state.vDisplayH, state.vDisplayH);
}

export function renderVScopeToCtx(c, w, h) {
  renderVScopeTo(c, w, h, state.vDisplayH || h);
}
