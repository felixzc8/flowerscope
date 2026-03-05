import { state } from './state.js';
import { canvas, ctx } from './dom.js';
import { findBassFreq, lowPass, pinch } from './analysis.js';
import { getAccentColor, getAccentColorDim } from './theme.js';

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

let cachedRect = null;
const scopeXs = new Float32Array(2048);
const scopeYs = new Float32Array(2048);

export function cacheCanvasRect() {
  cachedRect = canvas.getBoundingClientRect();
}

export function analyseScope() {
  const sr = state.analyser.context.sampleRate;
  const N = state.analyser.fftSize;

  const detFreq = findBassFreq(sr, N);
  if (detFreq > 0) {
    const p = sr / detFreq;
    state.smoothedPeriod = state.smoothedPeriod === 0 ? p : state.smoothedPeriod * 0.92 + p * 0.08;
  }
  const period = Math.round(state.smoothedPeriod || sr / 80);

  state.analyser.getFloatTimeDomainData(state.timeBuf);
  const alpha = 200 / (200 + sr / (2 * Math.PI));
  lowPass(state.timeBuf, state.filtBuf, alpha);

  const binW = sr / N;
  const bLo = Math.ceil(30 / binW);
  const bHi = Math.floor(150 / binW);
  let bandEnergy = 0;
  let flux = 0;
  let peakBandMag = -Infinity;
  if (!state.prevBassSpectrum) state.prevBassSpectrum = new Float32Array(bHi - bLo + 1);
  for (let i = bLo; i <= bHi; i++) {
    const mag = state.freqBuf[i];
    if (mag > peakBandMag) peakBandMag = mag;
    const idx = i - bLo;
    const diff = mag - state.prevBassSpectrum[idx];
    if (diff > 0) flux += diff;
    state.prevBassSpectrum[idx] = mag;
    bandEnergy += Math.pow(10, mag / 10);
  }
  state.bassEnergy = Math.sqrt(bandEnergy / (bHi - bLo + 1));
  state.smoothedBass = state.smoothedBass * 0.93 + state.bassEnergy * 0.07;
  state.smoothedFlux = state.smoothedFlux * 0.92 + flux * 0.08;
  state.bassHit = flux > state.smoothedFlux * 1.8 && flux > 6 && peakBandMag > -30;

  const searchEnd = N - period - 16;
  const searchStart = Math.max(0, searchEnd - period * 3);
  let trigger = -1;
  for (let i = searchEnd; i >= searchStart; i--) {
    if (state.filtBuf[i] <= 0 && state.filtBuf[i + 1] > 0) {
      trigger = i + (-state.filtBuf[i]) / (state.filtBuf[i + 1] - state.filtBuf[i]);
      break;
    }
  }
  if (trigger < 0) trigger = searchStart;

  const endTarget = trigger + period;
  let endPt = endTarget;
  const r = Math.floor(period * 0.12);
  let bestDist = Infinity;
  for (let i = Math.max(0, Math.floor(endTarget) - r); i <= Math.min(N - 2, Math.floor(endTarget) + r); i++) {
    if (state.filtBuf[i] <= 0 && state.filtBuf[i + 1] > 0) {
      const zc = i + (-state.filtBuf[i]) / (state.filtBuf[i + 1] - state.filtBuf[i]);
      const d = Math.abs(zc - endTarget);
      if (d < bestDist) { bestDist = d; endPt = zc; }
    }
  }

  const span = endPt - trigger;
  if (span < 2 || trigger < 0 || endPt >= N) { state.wfActive = false; return; }

  const steps = Math.min(Math.ceil(span), state.displayW * 2);
  const cr = cachedRect || canvas.getBoundingClientRect();
  state.wfLeft = cr.left;
  state.wfRight = cr.right;
  state.wfCount = steps + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pos = trigger + t * span;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = state.timeBuf[idx] || 0;
    const s1 = state.timeBuf[Math.min(idx + 1, N - 1)] || 0;
    const sample = (s0 + (s1 - s0) * frac) * pinch(t);
    state.wfYs[i] = cr.top + (state.displayH / 2 - sample * state.displayH * 0.42);
  }
  state.wfActive = true;
}

function renderScopeTo(c, w, h) {
  if (!state.wfActive) { c.clearRect(0, 0, w, h); return; }

  c.clearRect(0, 0, w, h);

  const steps = state.wfCount - 1;
  const cr = cachedRect || canvas.getBoundingClientRect();
  for (let i = 0; i <= steps; i++) {
    scopeXs[i] = (i / steps) * w;
    scopeYs[i] = (state.wfYs[i] - cr.top) * (h / state.displayH);
  }

  c.lineJoin = 'round';
  c.lineCap = 'round';

  function makeStroke(alpha) {
    if (state.gradient) {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, hexAlpha(state.gradColor1, alpha));
      g.addColorStop(1, hexAlpha(state.gradColor2, alpha));
      return g;
    }
    return getAccentColor(alpha);
  }

  c.strokeStyle = makeStroke(0.10);
  c.lineWidth = 14 * (w / state.displayW);
  c.beginPath();
  for (let i = 0; i <= steps; i++) { i === 0 ? c.moveTo(scopeXs[i], scopeYs[i]) : c.lineTo(scopeXs[i], scopeYs[i]); }
  c.stroke();

  c.strokeStyle = makeStroke(0.18);
  c.lineWidth = 6 * (w / state.displayW);
  c.beginPath();
  for (let i = 0; i <= steps; i++) { i === 0 ? c.moveTo(scopeXs[i], scopeYs[i]) : c.lineTo(scopeXs[i], scopeYs[i]); }
  c.stroke();

  c.strokeStyle = makeStroke(1);
  c.lineWidth = 2 * (w / state.displayW);
  c.beginPath();
  for (let i = 0; i <= steps; i++) { i === 0 ? c.moveTo(scopeXs[i], scopeYs[i]) : c.lineTo(scopeXs[i], scopeYs[i]); }
  c.stroke();

  if (state.gradient) {
    const hl = c.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, hexAlpha(state.gradColor1, 0.4));
    hl.addColorStop(1, hexAlpha(state.gradColor2, 0.4));
    c.strokeStyle = hl;
  } else {
    c.strokeStyle = getAccentColor(0.4);
  }
  c.lineWidth = 1 * (w / state.displayW);
  c.beginPath();
  for (let i = 0; i <= steps; i++) { i === 0 ? c.moveTo(scopeXs[i], scopeYs[i]) : c.lineTo(scopeXs[i], scopeYs[i]); }
  c.stroke();
}

export function drawScope() {
  analyseScope();
  renderScopeTo(ctx, state.displayW, state.displayH);
}

export function renderScopeToCtx(c, w, h) {
  renderScopeTo(c, w, h);
}
