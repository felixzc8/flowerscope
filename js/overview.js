import { state } from './state.js';
import { overviewCanvas, ovCtx, colorPicker } from './dom.js';

function lerpHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

let cachedWaveform = null;

export function getCurrentTime() {
  if (!state.audioBuffer) return 0;
  let t = state.playOffset;
  if (state.isPlaying && state.audioCtx) t = state.audioCtx.currentTime - state.playStartCtxTime + state.playOffset;
  return Math.max(0, Math.min(t, state.audioBuffer.duration));
}

export function buildOverviewPeaks(buf) {
  const data = buf.getChannelData(0);
  const buckets = 2000;
  const samplesPerBucket = Math.floor(data.length / buckets);
  state.overviewPeaks = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * samplesPerBucket;
    for (let j = start; j < start + samplesPerBucket && j < data.length; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    state.overviewPeaks[i] = peak;
  }
  state.overviewDuration = buf.duration;
  cachedWaveform = null;
}

export function renderOverview() {
  const w = overviewCanvas.width / (window.devicePixelRatio || 1);
  const h = 50;
  ovCtx.clearRect(0, 0, w, h);
  if (!state.overviewPeaks) return;

  const n = state.overviewPeaks.length;
  let fillColor;
  if (state.gradient) {
    const g = ovCtx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, state.gradColor1 + '66');
    g.addColorStop(1, state.gradColor2 + '66');
    fillColor = g;
  } else {
    const hex = colorPicker.value;
    const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
    fillColor = `rgba(${cr},${cg},${cb},0.4)`;
  }
  ovCtx.fillStyle = fillColor;
  ovCtx.beginPath();
  ovCtx.moveTo(0, h / 2);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * w;
    const amp = state.overviewPeaks[i] * h * 0.45;
    ovCtx.lineTo(x, h / 2 - amp);
  }
  ovCtx.lineTo(w, h / 2);
  for (let i = n - 1; i >= 0; i--) {
    const x = (i / n) * w;
    const amp = state.overviewPeaks[i] * h * 0.45;
    ovCtx.lineTo(x, h / 2 + amp);
  }
  ovCtx.closePath();
  ovCtx.fill();
}

export function invalidateOverviewCache() {
  cachedWaveform = null;
}

function ensureWaveformCached() {
  if (cachedWaveform) return;
  renderOverview();
  cachedWaveform = ovCtx.getImageData(
    0, 0,
    overviewCanvas.width,
    overviewCanvas.height
  );
}

export function renderOverviewToCtx(c, x0, y0, w, h) {
  if (!state.overviewPeaks || !state.audioBuffer) return;

  const n = state.overviewPeaks.length;
  let fillColor;
  if (state.gradient) {
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, state.gradColor1 + '66');
    g.addColorStop(1, state.gradColor2 + '66');
    fillColor = g;
  } else {
    const hex = colorPicker.value;
    const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
    fillColor = `rgba(${cr},${cg},${cb},0.4)`;
  }
  c.fillStyle = fillColor;
  c.beginPath();
  c.moveTo(x0, y0 + h / 2);
  for (let i = 0; i < n; i++) {
    const px = x0 + (i / n) * w;
    const amp = state.overviewPeaks[i] * h * 0.45;
    c.lineTo(px, y0 + h / 2 - amp);
  }
  c.lineTo(x0 + w, y0 + h / 2);
  for (let i = n - 1; i >= 0; i--) {
    const px = x0 + (i / n) * w;
    const amp = state.overviewPeaks[i] * h * 0.45;
    c.lineTo(px, y0 + h / 2 + amp);
  }
  c.closePath();
  c.fill();

  const t = getCurrentTime();
  const px = x0 + (t / state.overviewDuration) * w;
  const frac = t / state.overviewDuration;
  let headColor;
  if (state.gradient) {
    headColor = lerpHex(state.gradColor1, state.gradColor2, frac);
  } else {
    headColor = colorPicker.value;
  }
  c.strokeStyle = headColor;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(px, y0);
  c.lineTo(px, y0 + h);
  c.stroke();
}

export function drawPlayhead() {
  if (!state.overviewPeaks || !state.audioBuffer) return;
  const w = overviewCanvas.width / (window.devicePixelRatio || 1);
  const h = 50;

  if (state.isRecording) {
    ensureWaveformCached();
    ovCtx.putImageData(cachedWaveform, 0, 0);
  } else {
    renderOverview();
  }

  const t = getCurrentTime();
  const x = (t / state.overviewDuration) * w;
  const frac = t / state.overviewDuration;
  let headColor;
  if (state.gradient) {
    headColor = lerpHex(state.gradColor1, state.gradColor2, frac);
  } else {
    headColor = colorPicker.value;
  }
  ovCtx.strokeStyle = headColor;
  ovCtx.lineWidth = 2;
  ovCtx.beginPath();
  ovCtx.moveTo(x, 0);
  ovCtx.lineTo(x, h);
  ovCtx.stroke();
}
