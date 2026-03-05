import { state } from './state.js';
import { recordBtn } from './dom.js';
import { pausePlayback } from './playback.js';
import { updateAllFlowers } from './flowers.js';
import { analyseScope, renderScopeToCtx, cacheCanvasRect } from './scope.js';
import { renderOverviewToCtx } from './overview.js';
import { hslToRgb } from './theme.js';

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

function buildRecConfig(recW, recH, flowerImg) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cropX = 0, cropW = vw;
  if (state.recVertical) {
    cropW = vh * (recW / recH);
    cropX = (vw - cropW) / 2;
  }
  const sx = recW / cropW;
  const sy = recH / vh;

  let scopeW, scopeH, scopeX, scopeY;
  if (state.recVertical) {
    scopeW = recW * 0.92;
    scopeH = scopeW * (state.displayH / state.displayW);
  } else {
    scopeW = state.displayW * sx;
    scopeH = state.displayH * sy;
  }
  scopeX = (recW - scopeW) / 2;
  scopeY = (recH - scopeH) / 2;

  const ar = flowerImg
    ? (flowerImg.naturalHeight || flowerImg.height) / (flowerImg.naturalWidth || flowerImg.width)
    : 1;
  const col = state.activeHue === null ? '255,255,255' : hslToRgb(state.activeHue);
  const useSharedFilter = !!flowerImg && !state.gradient;

  return { recW, recH, cropX, sx, sy, scopeW, scopeH, scopeX, scopeY, ar, col, useSharedFilter, ovH: 50 * sy };
}

function compositeRecFrame(flowerImg, cfg) {
  const { recW, recH, cropX, sx, sy, scopeW, scopeH, scopeX, scopeY, ar, col, useSharedFilter, ovH } = cfg;
  const c = state.recCtx;

  c.fillStyle = '#0e0e0e';
  c.fillRect(0, 0, recW, recH);

  c.save();
  c.translate(scopeX, scopeY);
  renderScopeToCtx(c, scopeW, scopeH);
  c.restore();

  c.globalCompositeOperation = 'screen';

  if (useSharedFilter) {
    c.filter = state.flowers.length > 0 ? state.flowers[0].currentFilter : 'none';
  }

  for (const f of state.flowers) {
    c.save();
    c.globalAlpha = f.currentOpacity;
    const cx = (f.x - cropX) * sx;
    const cy = f.y * sy;

    if (flowerImg) {
      if (!useSharedFilter) c.filter = f.currentFilter;
      c.translate(cx, cy);
      c.rotate(f.rot * DEG_TO_RAD);
      c.scale(f.scale, f.scale);
      const sw = f.size * sx;
      const sh = sw * ar;
      c.drawImage(flowerImg, -sw / 2, -sh / 2, sw, sh);
    } else {
      const r = f.size * f.scale / 2 * sx;
      c.translate(cx, cy);
      c.rotate(f.rot * DEG_TO_RAD);
      c.scale(f.scale, f.scale);
      const petalLen = r * 0.85;
      const petalW = r * 0.32;
      for (let p = 0; p < 7; p++) {
        c.save();
        c.rotate((p / 7) * TWO_PI);
        c.beginPath();
        c.ellipse(0, -petalLen * 0.55, petalW, petalLen * 0.55, 0, 0, TWO_PI);
        c.fillStyle = `rgba(${col}, 0.25)`;
        c.fill();
        c.restore();
      }
      for (let p = 0; p < 7; p++) {
        c.save();
        c.rotate((p / 7) * TWO_PI + 0.25);
        c.beginPath();
        c.ellipse(0, -petalLen * 0.35, petalW * 0.6, petalLen * 0.35, 0, 0, TWO_PI);
        c.fillStyle = `rgba(${col}, 0.2)`;
        c.fill();
        c.restore();
      }
      const cg = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.22);
      cg.addColorStop(0, `rgba(${col}, 0.5)`);
      cg.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = cg;
      c.beginPath();
      c.arc(0, 0, r * 0.22, 0, TWO_PI);
      c.fill();
    }
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.filter = 'none';

  renderOverviewToCtx(c, 0, recH - ovH, recW, ovH);
}

export async function startOfflineRecording() {
  if (typeof VideoEncoder === 'undefined') {
    alert('Recording requires WebCodecs support (Chrome/Edge 94+)');
    return;
  }
  if (!state.audioCtx) state.audioCtx = new AudioContext({ latencyHint: 'interactive' });
  if (state.isPlaying) pausePlayback();

  state.isRecording = true;
  recordBtn.textContent = '0%';
  recordBtn.disabled = true;

  let Muxer, ArrayBufferTarget;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm');
    Muxer = mod.Muxer;
    ArrayBufferTarget = mod.ArrayBufferTarget;
  } catch(e) {
    alert('Failed to load mp4-muxer. Internet connection required.');
    state.isRecording = false;
    recordBtn.textContent = 'Record';
    recordBtn.disabled = false;
    return;
  }

  const flowerImg = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = state.iconSrc;
  });

  const recW = state.recVertical ? 1080 : 1920;
  const recH = state.recVertical ? 1920 : 1080;

  state.recCanvas = document.createElement('canvas');
  state.recCanvas.width = recW;
  state.recCanvas.height = recH;
  state.recCtx = state.recCanvas.getContext('2d');

  const fps = 30;
  const sr = state.audioBuffer.sampleRate;
  const duration = state.audioBuffer.duration;
  const totalFrames = Math.ceil(duration * fps);
  const numCh = state.audioBuffer.numberOfChannels;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: recW, height: recH },
    audio: { codec: 'aac', numberOfChannels: numCh, sampleRate: sr },
    fastStart: 'in-memory'
  });

  let videoEncoderError = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { console.error('VideoEncoder:', e); videoEncoderError = e; }
  });
  videoEncoder.configure({
    codec: 'avc1.640028',
    width: recW, height: recH,
    bitrate: 8_000_000,
    framerate: fps
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: e => console.error('AudioEncoder:', e)
  });
  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sr,
    numberOfChannels: numCh,
    bitrate: 128000
  });

  const chunkSamples = Math.floor(sr);
  for (let offset = 0; offset < state.audioBuffer.length; offset += chunkSamples) {
    const frames = Math.min(chunkSamples, state.audioBuffer.length - offset);
    const data = new Float32Array(frames * numCh);
    for (let ch = 0; ch < numCh; ch++) {
      data.set(state.audioBuffer.getChannelData(ch).subarray(offset, offset + frames), ch * frames);
    }
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: sr,
      numberOfFrames: frames,
      numberOfChannels: numCh,
      timestamp: Math.round(offset / sr * 1_000_000),
      data
    });
    audioEncoder.encode(ad);
    ad.close();
  }

  const offCtx = new OfflineAudioContext(numCh, state.audioBuffer.length, sr);
  const offAnalyser = offCtx.createAnalyser();
  offAnalyser.fftSize = 8192;
  offAnalyser.smoothingTimeConstant = 0.6;
  const offSource = offCtx.createBufferSource();
  offSource.buffer = state.audioBuffer;
  offSource.connect(offAnalyser);
  offAnalyser.connect(offCtx.destination);

  state.freqBuf = new Float32Array(offAnalyser.frequencyBinCount);
  state.timeBuf = new Float32Array(offAnalyser.fftSize);
  state.filtBuf = new Float32Array(offAnalyser.fftSize);

  const savedAnalyser = state.analyser;
  const savedSmoothedPeriod = state.smoothedPeriod;
  state.analyser = offAnalyser;
  state.smoothedPeriod = 0;
  state.bassEnergy = 0;
  state.smoothedBass = 0;
  state.bassHit = false;
  state.prevBassSpectrum = null;
  state.smoothedFlux = 0;

  for (const f of state.flowers) {
    f.vx = (Math.random() - 0.5) * 3;
    f.vy = (Math.random() - 0.5) * 3;
  }

  let flowerBitmap = null;
  try { if (flowerImg) flowerBitmap = await createImageBitmap(flowerImg); } catch(e) {}
  const recFlowerImg = flowerBitmap || flowerImg;

  cacheCanvasRect();

  const recCfg = buildRecConfig(recW, recH, recFlowerImg);

  const suspendTimes = [];
  let prevSample = -1;
  for (let i = 1; i <= totalFrames; i++) {
    const t = i / fps;
    if (t >= duration) break;
    const sample = Math.round(t * sr);
    if (sample === prevSample || sample >= state.audioBuffer.length) continue;
    prevSample = sample;
    suspendTimes.push({ time: sample / sr, frame: i - 1 });
  }

  let pendingFlush = null;

  for (const { time, frame } of suspendTimes) {
    offCtx.suspend(time).then(async () => {
      try {
        if (pendingFlush) { await pendingFlush; pendingFlush = null; }

        const frameTime = frame / fps;
        state.playOffset = frameTime;
        analyseScope();
        updateAllFlowers(frameTime);
        compositeRecFrame(recFlowerImg, recCfg);

        const vf = new VideoFrame(state.recCanvas, {
          timestamp: Math.round(frame * 1_000_000 / fps)
        });
        try {
          videoEncoder.encode(vf, { keyFrame: frame % 60 === 0 });
        } finally {
          vf.close();
        }

        if (videoEncoder.encodeQueueSize > 10) {
          pendingFlush = videoEncoder.flush();
        }
      } catch(e) {
        console.error('Frame error:', e);
      }

      if (frame % 10 === 0) recordBtn.textContent = `${Math.round(frame / totalFrames * 100)}%`;
      offCtx.resume();
    });
  }

  offSource.start(0);
  await offCtx.startRendering();

  state.analyser = savedAnalyser;
  state.smoothedPeriod = savedSmoothedPeriod;
  state.playOffset = 0;

  try {
    if (videoEncoderError) throw videoEncoderError;
    if (videoEncoder.state !== 'closed') await videoEncoder.flush();
    if (audioEncoder.state !== 'closed') await audioEncoder.flush();
    if (videoEncoder.state !== 'closed') videoEncoder.close();
    if (audioEncoder.state !== 'closed') audioEncoder.close();
    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    if (blob.size < 1000) {
      alert('Recording produced no video data. Check browser console for errors.');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (state.audioFileName || 'flowerscope') + '.mp4';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 10000);
    }
  } catch(e) {
    console.error('Recording finalization error:', e);
    alert('Recording failed: ' + e.message);
  }

  if (flowerBitmap) flowerBitmap.close();
  state.isRecording = false;
  state.recCanvas = null;
  state.recCtx = null;
  recordBtn.textContent = 'Record';
  recordBtn.disabled = false;
}

export function initRecordButton() {
  recordBtn.addEventListener('click', () => {
    if (state.isRecording) return;
    if (!state.audioBuffer) return;
    startOfflineRecording();
  });
}
