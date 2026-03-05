import { state } from './state.js';
import { playBtn, swatchContainer, colorPicker } from './dom.js';
import { renderOverview, invalidateOverviewCache } from './overview.js';

export const colorPresets = [
  { name: 'green', hue: 135, color: '#00ff41' },
  { name: 'cyan', hue: 180, color: '#00ffff' },
  { name: 'blue', hue: 220, color: '#4488ff' },
  { name: 'pink', hue: 330, color: '#ff44aa' },
  { name: 'orange', hue: 25, color: '#ff8800' },
  { name: 'white', hue: null, color: '#ffffff' },
];

export function getThemeFill() {
  if (state.gradient) return state.gradColor1;
  if (state.activeHue === null) return '#ffffff';
  return colorPicker.value || `hsl(${state.activeHue}, 100%, 50%)`;
}

const playSVG = () => `<svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21" fill="${getThemeFill()}"/></svg>`;
const pauseSVG = () => `<svg viewBox="0 0 24 24"><rect x="5" y="3" width="4" height="18" rx="1" fill="${getThemeFill()}"/><rect x="15" y="3" width="4" height="18" rx="1" fill="${getThemeFill()}"/></svg>`;

export function setPlayIcon(playing) {
  playBtn.innerHTML = playing ? pauseSVG() : playSVG();
}

export function getAccentColor(a) {
  if (state.activeHue === null) return `rgba(255,255,255,${a})`;
  return `hsla(${state.activeHue}, 100%, 50%, ${a})`;
}

export function getAccentColorDim() {
  if (state.activeHue === null) return '#aaaaaa';
  return `hsl(${state.activeHue}, 80%, 35%)`;
}

export function hslToRgb(h) {
  const s = 1, l = 0.7;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return `${Math.round((r+m)*255)},${Math.round((g+m)*255)},${Math.round((b+m)*255)}`;
}

export function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return null;
  let h;
  const d = max - min;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

export function getFlowerFilter() {
  if (state.activeHue === null) return 'invert(1)';
  return `invert(1) sepia(1) saturate(5) hue-rotate(${state.activeHue - 50}deg)`;
}

export function applyTheme() {
  const accent = state.activeHue === null ? '#ffffff' : `hsl(${state.activeHue}, 100%, 50%)`;
  const accentDim = state.activeHue === null ? '#aaaaaa' : `hsl(${state.activeHue}, 80%, 35%)`;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', accentDim);
  state.gradHue1 = hexToHue(state.gradColor1);
  state.gradHue2 = hexToHue(state.gradColor2);
  if (!state.gradient) {
    const filter = getFlowerFilter();
    for (const f of state.flowers) {
      f.currentFilter = filter;
      f.el.style.filter = filter;
    }
  }
  setPlayIcon(state.isPlaying);
  invalidateOverviewCache();
  renderOverview();
}

function clearSwatchActive() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
}

export function initSwatches() {
  colorPresets.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'swatch' + (i === 0 ? ' active' : '');
    el.style.background = p.color;
    el.addEventListener('click', () => {
      state.activeHue = p.hue;
      clearSwatchActive();
      el.classList.add('active');
      colorPicker.value = p.color;
      applyTheme();
    });
    swatchContainer.insertBefore(el, colorPicker);
  });

  colorPicker.addEventListener('input', () => {
    clearSwatchActive();
    state.activeHue = hexToHue(colorPicker.value);
    applyTheme();
  });
}
