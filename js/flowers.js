import { state } from './state.js';
import { getFlowerFilter } from './theme.js';

const DEG = Math.PI / 180;
const CACHE_SLOTS = 72;
const HUE_STEP = 360 / CACHE_SLOTS;
let spriteCache = null;
let spriteCacheKey = '';
let spriteW = 0, spriteH = 0;

function buildSpriteCache(img) {
  const key = img.src + '|' + img.naturalWidth;
  if (spriteCache && spriteCacheKey === key) return;
  spriteCacheKey = key;

  spriteW = Math.min(img.naturalWidth, 256);
  spriteH = Math.round(spriteW * (img.naturalHeight / img.naturalWidth));
  spriteCache = new Array(CACHE_SLOTS);

  for (let i = 0; i < CACHE_SLOTS; i++) {
    const oc = document.createElement('canvas');
    oc.width = spriteW;
    oc.height = spriteH;
    const ox = oc.getContext('2d');
    const hue = i * HUE_STEP;
    ox.filter = `invert(1) sepia(1) saturate(5) hue-rotate(${hue - 50}deg)`;
    ox.drawImage(img, 0, 0, spriteW, spriteH);
    spriteCache[i] = oc;
  }
}

let singleTintCache = null;
let singleTintKey = '';

function getSingleTint(img, filter) {
  const key = img.src + '|' + filter;
  if (singleTintCache && singleTintKey === key) return singleTintCache;
  singleTintKey = key;

  spriteW = Math.min(img.naturalWidth, 256);
  spriteH = Math.round(spriteW * (img.naturalHeight / img.naturalWidth));
  const oc = document.createElement('canvas');
  oc.width = spriteW;
  oc.height = spriteH;
  const ox = oc.getContext('2d');
  ox.filter = filter;
  ox.drawImage(img, 0, 0, spriteW, spriteH);
  singleTintCache = oc;
  return oc;
}

let frameL, frameW, frameH;
let frameGradH1, frameGradDiff, frameGradValid;

export class Flower {
  constructor() {
    this.size = 76 + Math.random() * 268;
    if (state.mobilePreview) {
      this.x = state.cropX + Math.random() * state.cropW;
    } else {
      this.x = Math.random() * window.innerWidth;
    }
    this.y = Math.random() * (window.innerHeight - 50);
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = (Math.random() - 0.5) * 0.6;
    this.rot = Math.random() * 360;
    this.rotV = (Math.random() - 0.5) * 0.4;
    this.scale = 1;
    this.scaleT = 1;
    this.baseOp = 0.25 + Math.random() * 0.3;
    this.phase = Math.random() * Math.PI * 2;
    this.drift = 0.15 + Math.random() * 0.25;
    this.currentFilter = getFlowerFilter();
    this.currentOpacity = this.baseOp;
    this.hueSlot = 0;
  }

  update(t) {
    const h = this.size * this.scale * 0.5;
    const L = frameL;
    const W = frameW;
    const H = frameH;

    this.vx += Math.sin(t * this.drift + this.phase) * 0.006;
    this.vy += Math.cos(t * this.drift * 0.7 + this.phase + 1.3) * 0.006;

    if (state.bassHit) {
      const spdSq = this.vx * this.vx + this.vy * this.vy;
      if (spdSq > 0.000001) {
        const spd = Math.sqrt(spdSq);
        const s = 1.5 + Math.random() * 3;
        this.vx += (this.vx / spd) * s;
        this.vy += (this.vy / spd) * s;
      }
      this.scaleT = 1.15 + Math.random() * 0.3;
      this.rotV += (Math.random() - 0.5) * 1.5;
    }

    this.vx *= 0.98;
    this.vy *= 0.98;
    this.rotV *= 0.984;

    const spdSq = this.vx * this.vx + this.vy * this.vy;
    if (spdSq > 12.25) { const f = 3.5 / Math.sqrt(spdSq); this.vx *= f; this.vy *= f; }

    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.rotV;

    this.scale += (this.scaleT - this.scale) * 0.08;
    this.scaleT += (1 - this.scaleT) * 0.04;

    if (state.edgeWrap) {
      const margin = this.size;
      if (this.x < L - margin) this.x = W + margin;
      else if (this.x > W + margin) this.x = L - margin;
      if (this.y < -margin) this.y = H + margin;
      else if (this.y > H + margin) this.y = -margin;
    } else {
      const bounce = 0.5;
      if (this.x < L + h) { this.x = L + h; this.vx = Math.abs(this.vx) * bounce; }
      if (this.x > W - h) { this.x = W - h; this.vx = -Math.abs(this.vx) * bounce; }
      if (this.y < h) { this.y = h; this.vy = Math.abs(this.vy) * bounce; }
      if (this.y > H - h) { this.y = H - h; this.vy = -Math.abs(this.vy) * bounce; }
    }

    if (state.gradient) {
      if (frameGradValid) {
        const t01 = Math.max(0, Math.min(1, (this.x - L) / (W - L)));
        const hue = ((frameGradH1 + frameGradDiff * t01) % 360 + 360) % 360;
        this.hueSlot = Math.round(hue / HUE_STEP) % CACHE_SLOTS;
        this.currentFilter = `invert(1) sepia(1) saturate(5) hue-rotate(${Math.round(hue) - 50}deg)`;
      } else {
        this.currentFilter = getFlowerFilter();
      }
    }

    const opTarget = Math.min(1, this.baseOp + state.bassEnergy * 0.5);
    this.currentOpacity += (opTarget - this.currentOpacity) * 0.18;
  }
}

export function drawFlowersOnCanvas(c, w, h) {
  const img = state.flowerImg;
  c.clearRect(0, 0, w, h);
  if (!img || !img.complete || !img.naturalWidth) return;

  const ar = img.naturalHeight / img.naturalWidth;

  if (state.gradient) {
    buildSpriteCache(img);
    c.globalCompositeOperation = 'screen';
    for (const f of state.flowers) {
      c.save();
      c.globalAlpha = f.currentOpacity;
      c.translate(f.x, f.y);
      c.rotate(f.rot * DEG);
      c.scale(f.scale, f.scale);
      const sw = f.size;
      const sh = sw * ar;
      c.drawImage(spriteCache[f.hueSlot], -sw / 2, -sh / 2, sw, sh);
      c.restore();
    }
  } else {
    const tinted = getSingleTint(img, state.flowers.length > 0 ? state.flowers[0].currentFilter : 'none');
    c.globalCompositeOperation = 'screen';
    for (const f of state.flowers) {
      c.save();
      c.globalAlpha = f.currentOpacity;
      c.translate(f.x, f.y);
      c.rotate(f.rot * DEG);
      c.scale(f.scale, f.scale);
      const sw = f.size;
      const sh = sw * ar;
      c.drawImage(tinted, -sw / 2, -sh / 2, sw, sh);
      c.restore();
    }
  }

  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

export function invalidateSpriteCache() {
  spriteCacheKey = '';
  singleTintKey = '';
}

export function repositionFlowersToCrop() {
  if (!state.mobilePreview) return;
  const left = state.cropX;
  const right = state.cropX + state.cropW;
  const H = window.innerHeight - 50;
  for (const f of state.flowers) {
    if (f.x < left || f.x > right) {
      f.x = left + Math.random() * state.cropW;
      f.y = Math.random() * H;
    }
  }
}

export function updateAllFlowers(t) {
  frameL = state.mobilePreview ? state.cropX : 0;
  frameW = state.mobilePreview ? state.cropX + state.cropW : window.innerWidth;
  frameH = window.innerHeight - 50;
  if (state.gradient) {
    const h1 = state.gradHue1;
    const h2 = state.gradHue2;
    frameGradValid = h1 !== null && h2 !== null;
    if (frameGradValid) {
      frameGradH1 = h1;
      frameGradDiff = h2 - h1;
      if (frameGradDiff > 180) frameGradDiff -= 360;
      else if (frameGradDiff < -180) frameGradDiff += 360;
    }
  }
  for (const f of state.flowers) f.update(t);
}

export function initFlowers(count = 200) {
  for (let i = 0; i < count; i++) state.flowers.push(new Flower());
}

export function setFlowerCount(n) {
  const current = state.flowers.length;
  if (n > current) {
    for (let i = current; i < n; i++) state.flowers.push(new Flower());
  } else if (n < current) {
    state.flowers.splice(n);
  }
}

export function setAllFlowerSrc(src) {
  state.iconSrc = src;
  invalidateSpriteCache();
  const img = new Image();
  img.src = src;
  img.onload = () => { state.flowerImg = img; };
}
