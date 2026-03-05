import { state } from './state.js';
import { fileInput, loadLabel, playBtn, infoEl, recordBtn, overviewCanvas, iconSelect } from './dom.js';
import { setPlayIcon } from './theme.js';
import { getCurrentTime, buildOverviewPeaks, renderOverview, drawPlayhead } from './overview.js';
import { setAllFlowerSrc } from './flowers.js';

export function pausePlayback() {
  if (state.isPlaying) state.playOffset = getCurrentTime();
  if (state.source) try { state.source.stop(); } catch(e) {}
  state.isPlaying = false;
  setPlayIcon(false);
}

export function startPlaybackFromOffset() {
  if (!state.audioCtx) state.audioCtx = new AudioContext({ latencyHint: 'interactive' });
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();

  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = 8192;
  state.analyser.smoothingTimeConstant = 0.6;

  state.freqBuf = new Float32Array(state.analyser.frequencyBinCount);
  state.timeBuf = new Float32Array(state.analyser.fftSize);
  state.filtBuf = new Float32Array(state.analyser.fftSize);

  state.source = state.audioCtx.createBufferSource();
  state.source.buffer = state.audioBuffer;
  state.source.connect(state.analyser);
  state.analyser.connect(state.audioCtx.destination);
  state.source.start(0, state.playOffset);
  state.playStartCtxTime = state.audioCtx.currentTime;
  state.isPlaying = true;
  setPlayIcon(true);
  const thisSource = state.source;
  thisSource.onended = () => {
    if (state.source !== thisSource) return;
    if (state.isPlaying) {
      state.playOffset = 0;
      state.isPlaying = false;
      setPlayIcon(false);
      state.wfActive = false;
      state.scopeDirty = true;
    }
  };
}

async function loadFile(file) {
  if (!state.audioCtx) state.audioCtx = new AudioContext({ latencyHint: 'interactive' });
  if (state.isPlaying) pausePlayback();
  const ab = await file.arrayBuffer();
  state.audioBuffer = await state.audioCtx.decodeAudioData(ab);
  state.playOffset = 0;
  state.audioFileName = file.name.replace(/\.[^.]+$/, '');
  loadLabel.textContent = file.name;
  infoEl.textContent = `${file.name} | ${state.audioBuffer.sampleRate} Hz | ${state.audioBuffer.duration.toFixed(1)}s`;
  playBtn.disabled = false;
  recordBtn.disabled = false;
  state.smoothedPeriod = 0;
  buildOverviewPeaks(state.audioBuffer);
  renderOverview();
}

export function initPlaybackControls() {
  overviewCanvas.addEventListener('mousedown', e => {
    const wasPlaying = state.isPlaying;
    if (state.isPlaying) {
      state.playOffset = getCurrentTime();
      if (state.source) try { state.source.stop(); } catch(e) {}
      state.isPlaying = false;
    }

    function scrub(ev) {
      const rect = overviewCanvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      state.playOffset = Math.max(0, Math.min(1, x)) * state.overviewDuration;
      drawPlayhead();
    }

    scrub(e);

    const onMove = ev => scrub(ev);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (wasPlaying) startPlaybackFromOffset();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type.startsWith('audio/')) loadFile(f);
    else if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      const name = f.name.replace(/\.[^.]+$/, '');
      const opt = document.createElement('option');
      opt.value = url;
      opt.textContent = name;
      iconSelect.appendChild(opt);
      iconSelect.value = url;
      setAllFlowerSrc(url);
    }
  });

  playBtn.addEventListener('click', () => {
    if (!state.audioCtx) state.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    if (state.isPlaying) { pausePlayback(); state.wfActive = false; state.scopeDirty = true; return; }
    if (!state.audioBuffer) return;

    for (const f of state.flowers) {
      f.vx = (Math.random() - 0.5) * 3;
      f.vy = (Math.random() - 0.5) * 3;
    }

    startPlaybackFromOffset();
  });
}
