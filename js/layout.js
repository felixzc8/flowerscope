import { state } from './state.js';
import { flowerCanvas, fctx, canvas, ctx, vcanvas, vctx, overviewCanvas, ovCtx, mobileOverlayL, mobileOverlayR, bgWrap } from './dom.js';
import { renderOverview } from './overview.js';

export function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const vsH = (vh - 50) * 0.78;
  const vsW = vsH * 0.2;
  state.vDisplayW = vsW;
  state.vDisplayH = vsH;

  let sw, sh;

  if (state.mobilePreview) {
    const cropW = vh * (9 / 16);
    const cropX = (vw - cropW) / 2;
    state.cropX = cropX;
    state.cropW = cropW;

    const remainW = cropW - vsW;
    sw = remainW * 0.85;
    sh = Math.min(vh * 0.18, 180);

    vcanvas.style.left = cropX + 'px';

    const pad = 16;
    const scopeCenterX = cropX + vsW + (remainW - sw) / 2 + sw / 2 - pad;
    const scopeBottom = vh - 50;
    canvas.style.left = scopeCenterX + 'px';
    canvas.style.top = (scopeBottom - sh / 2 - pad) + 'px';
    canvas.style.transform = 'translate(-50%, -50%)';

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

    vcanvas.style.left = '0px';

    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';

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

  vcanvas.style.width = vsW + 'px';
  vcanvas.style.height = vsH + 'px';
  vcanvas.width = vsW * dpr;
  vcanvas.height = vsH * dpr;
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ovW = state.mobilePreview ? state.cropW : vw;
  overviewCanvas.width = ovW * dpr;
  overviewCanvas.height = 50 * dpr;
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  flowerCanvas.width = vw * dpr;
  flowerCanvas.height = vh * dpr;
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  void canvas.offsetHeight;
  const r = canvas.getBoundingClientRect();
  state.wfLeft = r.left;
  state.wfRight = r.right;
  if (state.bgImageSrc) {
    bgWrap.style.left = state.bgX + 'px';
    bgWrap.style.top = state.bgY + 'px';
    bgWrap.style.width = state.bgW + 'px';
    bgWrap.style.height = state.bgH + 'px';
  }

  state.scopeDirty = true;
  renderOverview();
}

export function initLayout() {
  window.addEventListener('resize', layout);
  layout();
}
