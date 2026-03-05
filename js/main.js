import { state } from './state.js';
import { fctx, ctx, vctx, menuBtn, menuPanel, edgeToggle, recFormatToggle, viewToggle, iconInput, countDisplay, countDown, countUp, gradToggle, gradRow, gradColor1, gradColor2, bgWrap, bgImage, bgResize, bgInput } from './dom.js';
import { setPlayIcon, initSwatches, applyTheme } from './theme.js';
import { initLayout, layout } from './layout.js';
import { drawPlayhead } from './overview.js';
import { drawScope } from './scope.js';
import { drawVScope } from './vscope.js';
import { initFlowers, setAllFlowerSrc, setFlowerCount, updateAllFlowers, repositionFlowersToCrop, drawFlowersOnCanvas } from './flowers.js';
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

iconInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  setAllFlowerSrc(url);
});

bgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (state.bgImageSrc) URL.revokeObjectURL(state.bgImageSrc);
  state.bgImageSrc = URL.createObjectURL(file);
  bgImage.src = state.bgImageSrc;
  bgImage.onload = () => {
    state.bgAspect = bgImage.naturalWidth / bgImage.naturalHeight;
    const initH = window.innerHeight * 0.4;
    state.bgW = initH * state.bgAspect;
    state.bgH = initH;
    state.bgX = window.innerWidth * 0.6;
    state.bgY = 20;
    bgWrap.style.display = 'block';
    layout();
  };
});

bgWrap.addEventListener('mousedown', e => {
  if (e.target === bgResize) return;
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const origX = state.bgX, origY = state.bgY;
  const onMove = ev => {
    state.bgX = origX + ev.clientX - startX;
    state.bgY = origY + ev.clientY - startY;
    bgWrap.style.left = state.bgX + 'px';
    bgWrap.style.top = state.bgY + 'px';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

bgResize.addEventListener('mousedown', e => {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX, startY = e.clientY;
  const origW = state.bgW, origH = state.bgH;
  const onMove = ev => {
    state.bgW = Math.max(60, origW + ev.clientX - startX);
    state.bgH = Math.max(60, origH + ev.clientY - startY);
    bgWrap.style.width = state.bgW + 'px';
    bgWrap.style.height = state.bgH + 'px';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

function mainLoop(ts) {
  requestAnimationFrame(mainLoop);
  const t = ts / 1000;

  if (state.isPlaying && state.analyser) {
    try { drawScope(); } catch(e) {}
    try { drawVScope(); } catch(e) {}
    state.scopeDirty = true;
  } else if (!state.isRecording) {
    if (state.scopeDirty) {
      ctx.clearRect(0, 0, state.displayW, state.displayH);
      vctx.clearRect(0, 0, state.vDisplayW, state.vDisplayH);
      state.scopeDirty = false;
    }
    state.bassEnergy *= 0.94;
    if (state.bassEnergy < 0.001) state.bassEnergy = 0;
    state.bassHit = false;
  }

  if (state.overviewPeaks && !state.isRecording) drawPlayhead();

  if (!state.isRecording) {
    updateAllFlowers(t);
    drawFlowersOnCanvas(fctx, window.innerWidth, window.innerHeight);
  }
}

const preload = new Image();
preload.src = 'assets/shisoflower.png';
preload.onload = () => { state.flowerImg = preload; initFlowers(); requestAnimationFrame(mainLoop); };
preload.onerror = () => { initFlowers(); requestAnimationFrame(mainLoop); };
