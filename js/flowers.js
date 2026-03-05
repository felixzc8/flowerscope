import { state } from './state.js';
import { getFlowerFilter } from './theme.js';

const gradFilters = new Array(360);
for (let i = 0; i < 360; i++) {
  gradFilters[i] = `invert(1) sepia(1) saturate(5) hue-rotate(${i - 50}deg)`;
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

    this.el = document.createElement('img');
    this.el.src = state.iconSrc;
    this.el.className = 'flower';
    this.el.style.width = this.size + 'px';
    this.el.style.height = this.size + 'px';
    this.el.style.filter = this.currentFilter;
    document.body.appendChild(this.el);
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

    if (state.wfActive && state.wfCount > 1 && this.x >= state.wfLeft && this.x <= state.wfRight) {
      const t01 = (this.x - state.wfLeft) / (state.wfRight - state.wfLeft);
      const fi = t01 * (state.wfCount - 1);
      const i = Math.max(0, Math.min(Math.floor(fi), state.wfCount - 2));
      const frac = fi - i;
      const wfY = state.wfYs[i] + (state.wfYs[i + 1] - state.wfYs[i]) * frac;
      const dist = this.y - wfY;
      const repelZone = h * 0.3;
      if (Math.abs(dist) < repelZone) {
        const strength = (1 - Math.abs(dist) / repelZone) * 0.1;
        this.vy += (dist > 0 ? strength : -strength);
      }
    }

    if (state.gradient) {
      if (frameGradValid) {
        const t01 = Math.max(0, Math.min(1, this.x / W));
        const hue = ((frameGradH1 + frameGradDiff * t01) % 360 + 360) % 360;
        this.currentFilter = gradFilters[Math.round(hue) % 360];
      } else {
        this.currentFilter = getFlowerFilter();
      }
    }

    this.currentOpacity = Math.min(1, this.baseOp + state.bassEnergy * 0.5);

    if (!state.isRecording) {
      this.el.style.transform = `translate(${this.x - this.size / 2}px, ${this.y - this.size / 2}px) rotate(${this.rot}deg) scale(${this.scale})`;
      this.el.style.opacity = this.currentOpacity;
      if (state.gradient) this.el.style.filter = this.currentFilter;
    }
  }
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
    const removed = state.flowers.splice(n);
    for (const f of removed) f.el.remove();
  }
}

export function setAllFlowerSrc(src) {
  state.iconSrc = src;
  for (const f of state.flowers) f.el.src = src;
}
