import { state } from './state.js';
import { ctx, menuBtn, menuPanel, edgeToggle, recFormatToggle, viewToggle, iconSelect, countDisplay, countDown, countUp, gradToggle, gradRow, gradColor1, gradColor2 } from './dom.js';
import { setPlayIcon, initSwatches, applyTheme } from './theme.js';
import { initLayout, layout } from './layout.js';
import { drawPlayhead } from './overview.js';
import { drawScope } from './scope.js';
import { initFlowers, setAllFlowerSrc, setFlowerCount, updateAllFlowers, repositionFlowersToCrop } from './flowers.js';
import { initPlaybackControls } from './playback.js';
import { initRecordButton } from './recorder.js';

menuBtn.addEventListener('click', () => {
  menuPanel.classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-wrap')) menuPanel.classList.remove('open');
});

edgeToggle.addEventListener('click', () => {
  state.edgeWrap = !state.edgeWrap;
  edgeToggle.textContent = state.edgeWrap ? 'On' : 'Off';
});

recFormatToggle.addEventListener('click', () => {
  state.recVertical = !state.recVertical;
  recFormatToggle.textContent = state.recVertical ? 'Vertical' : 'Landscape';
});

viewToggle.addEventListener('click', () => {
  state.mobilePreview = !state.mobilePreview;
  viewToggle.textContent = state.mobilePreview ? 'Mobile' : 'Desktop';
  state.recVertical = state.mobilePreview;
  recFormatToggle.textContent = state.mobilePreview ? 'Vertical' : 'Landscape';
  layout();
  repositionFlowersToCrop();
});

function updateCount(delta) {
  const n = Math.max(1, Math.min(500, state.flowers.length + delta));
  setFlowerCount(n);
  countDisplay.textContent = n;
}
countDown.addEventListener('click', () => updateCount(-10));
countUp.addEventListener('click', () => updateCount(10));

gradToggle.addEventListener('click', () => {
  state.gradient = !state.gradient;
  gradToggle.textContent = state.gradient ? 'On' : 'Off';
  gradRow.style.display = state.gradient ? 'flex' : 'none';
  applyTheme();
});
gradColor1.addEventListener('input', () => { state.gradColor1 = gradColor1.value; applyTheme(); });
gradColor2.addEventListener('input', () => { state.gradColor2 = gradColor2.value; applyTheme(); });

setPlayIcon(false);
initSwatches();
initLayout();
initPlaybackControls();
initRecordButton();

fetch('assets/manifest.json')
  .then(r => r.json())
  .then(files => {
    for (const file of files) {
      const opt = document.createElement('option');
      opt.value = 'assets/' + file;
      opt.textContent = file.replace(/\.[^.]+$/, '');
      iconSelect.appendChild(opt);
    }
  })
  .catch(() => {});

iconSelect.addEventListener('change', () => {
  setAllFlowerSrc(iconSelect.value);
});

function mainLoop(ts) {
  requestAnimationFrame(mainLoop);
  const t = ts / 1000;

  if (state.isPlaying && state.analyser) {
    try { drawScope(); } catch(e) {}
    state.scopeDirty = true;
  } else if (!state.isRecording) {
    if (state.scopeDirty) { ctx.clearRect(0, 0, state.displayW, state.displayH); state.scopeDirty = false; }
    state.bassEnergy *= 0.94;
    if (state.bassEnergy < 0.001) state.bassEnergy = 0;
    state.bassHit = false;
  }

  if (state.overviewPeaks && !state.isRecording) drawPlayhead();

  if (!state.isRecording) updateAllFlowers(t);
}

const preload = new Image();
preload.src = 'assets/shisoflower.png';
preload.onload = () => { initFlowers(); requestAnimationFrame(mainLoop); };
preload.onerror = () => { initFlowers(); requestAnimationFrame(mainLoop); };
