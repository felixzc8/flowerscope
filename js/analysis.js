import { state } from './state.js';

export function findBassFreq(sr, N) {
  state.analyser.getFloatFrequencyData(state.freqBuf);
  const binW = sr / N;
  const lo = Math.ceil(25 / binW);
  const hi = Math.floor(300 / binW);
  let peakMag = -Infinity, peakBin = lo;
  for (let i = lo; i <= hi; i++) {
    if (state.freqBuf[i] > peakMag) { peakMag = state.freqBuf[i]; peakBin = i; }
  }
  if (peakMag < -35) return 0;
  if (peakBin > lo && peakBin < state.freqBuf.length - 1) {
    const a = state.freqBuf[peakBin - 1], b = state.freqBuf[peakBin], c = state.freqBuf[peakBin + 1];
    const d = a - 2 * b + c;
    if (d !== 0) return (peakBin + 0.5 * (a - c) / d) * binW;
  }
  return peakBin * binW;
}

export function lowPass(input, output, alpha) {
  const n = input.length;
  output[0] = input[0];
  for (let i = 1; i < n; i++) output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
  for (let i = n - 2; i >= 0; i--) output[i] = output[i + 1] + alpha * (output[i] - output[i + 1]);
}

export function pinch(t) {
  const e = 0.05;
  if (t < e) return 0.5 * (1 - Math.cos(Math.PI * t / e));
  if (t > 1 - e) return 0.5 * (1 - Math.cos(Math.PI * (1 - t) / e));
  return 1;
}
