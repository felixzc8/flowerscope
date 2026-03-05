import { state } from './state.js';
import { canvas, ctx, overviewCanvas, ovCtx, mobileOverlayL, mobileOverlayR } from './dom.js';
import { renderOverview } from './overview.js';

export function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let sw, sh;

  if (state.mobilePreview) {
    const cropW = vh * (9 / 16);
    const cropX = (vw - cropW) / 2;
    state.cropX = cropX;
    state.cropW = cropW;

    sw = cropW * 0.92;
    sh = Math.min(vh * 0.48, 440);

    mobileOverlayL.style.display = 'block';
    mobileOverlayL.style.width = cropX + 'px';
    mobileOverlayR.style.display = 'block';
    mobileOverlayR.style.width = cropX + 'px';

    overviewCanvas.style.left = cropX + 'px';
    overviewCanvas.style.width = cropW + 'px';
  } else {
    sw = Math.min(vw * 0.82, 960);
    sh = Math.min(vh * 0.48, 440);

    state.cropX = 0;
    state.cropW = vw;

    mobileOverlayL.style.display = 'none';
    mobileOverlayR.style.display = 'none';

    overviewCanvas.style.left = '0';
    overviewCanvas.style.width = '100%';
  }

  canvas.style.width = sw + 'px';
  canvas.style.height = sh + 'px';

  const dpr = window.devicePixelRatio || 1;
  state.displayW = sw;
  state.displayH = sh;
  canvas.width = sw * dpr;
  canvas.height = sh * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ovW = state.mobilePreview ? state.cropW : vw;
  overviewCanvas.width = ovW * dpr;
  overviewCanvas.height = 50 * dpr;
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  void canvas.offsetHeight;
  const r = canvas.getBoundingClientRect();
  state.wfLeft = r.left;
  state.wfRight = r.right;
  state.scopeDirty = true;
  renderOverview();
}

export function initLayout() {
  window.addEventListener('resize', layout);
  layout();
}
