// Neon Coast editor: wires the controls to the cover engine. Photos are read on the
// user's own machine (file input or the bundled samples) and never uploaded.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, layoutPanels, coverGutter, LAYOUTS, SIZES, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const thumbs = document.getElementById('thumbs');
const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoomVal');
const panelLabel = document.getElementById('panelLabel');

const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'Neon Shore',
  subtitle: 'a sunset heist',
  size: '1920x1080',
  photos: [], // { img, name }[]
  panels: [], // { photo, zoom, cx, cy }[], one per layout slot
  selected: 0,
};

let panelRects = [];

/** Default crops for a layout, framed by each panel's shape against its photo:
 * a tall photo in a wide panel frames the top (faces) instead of the middle. */
export function defaultPanels(layout, photoCount) {
  const count = LAYOUTS[layout].panels;
  const s = SIZES[state.size];
  const rects = layoutPanels(layout, s.w, s.h, coverGutter(s.w, s.h));
  const out = [];
  for (let i = 0; i < count; i++) {
    const photo = state.photos[photoCount ? i % photoCount : 0]?.img;
    let cx = 0.5 + ((i % 3) - 1) * 0.14;
    let cy = 0.5;
    if (photo) {
      const photoAspect = photo.naturalWidth / photo.naturalHeight;
      const panelAspect = rects[i].w / rects[i].h;
      if (photoAspect < panelAspect * 0.9) cy = 0.32; // tall photo, wide panel: favour the top
    }
    out.push({ photo: photoCount ? i % photoCount : 0, zoom: 1.15, cx, cy });
  }
  return out;
}

function previewSize() {
  const s = SIZES[state.size];
  const scale = 960 / Math.max(s.w, s.h);
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

function redraw() {
  const size = previewSize();
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  panelRects = drawCover(canvas, state);
  syncPanelControls();
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  panelLabel.textContent = panel
    ? `Panel ${state.selected + 1} of ${state.panels.length} — ${state.photos[panel.photo]?.name ?? 'no photo'}`
    : 'No panel selected';
  if (panel) {
    zoomInput.value = Math.round(panel.zoom * 100);
    zoomVal.textContent = `${Math.round(panel.zoom * 100)}%`;
  }
  for (const img of thumbs.querySelectorAll('img')) {
    img.classList.toggle('selected', Number(img.dataset.index) === panel?.photo);
  }
}

function renderThumbs() {
  thumbs.innerHTML = '';
  state.photos.forEach((p, i) => {
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    img.title = p.name;
    img.dataset.index = String(i);
    img.addEventListener('click', () => {
      const panel = state.panels[state.selected];
      if (panel) { panel.photo = i; panel.zoom = 1; panel.cx = 0.5; panel.cy = 0.5; }
      redraw();
    });
    thumbs.appendChild(img);
  });
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  if (state.photos.length) return;
  const [boulevard, pier] = await Promise.all([
    loadImage('samples/boulevard.jpg'),
    loadImage('samples/pier.jpg'),
  ]);
  state.photos = [
    { img: boulevard, name: 'Boulevard' },
    { img: pier, name: 'Pier' },
  ];
  state.panels = defaultPanels(state.layout, state.photos.length);
  renderThumbs();
}

function setLayout(layout) {
  state.layout = layout;
  state.panels = defaultPanels(layout, state.photos.length);
  state.selected = 0;
  document.querySelectorAll('#layouts button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === layout);
  });
  redraw();
}

function setGrade(grade) {
  state.grade = grade;
  document.querySelectorAll('#grades button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === grade);
  });
  redraw();
}

function setSize(size) {
  state.size = size;
  document.querySelectorAll('#sizes button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === size);
  });
  redraw();
}

/** Renders the cover at an export size and resolves with its PNG data URL. */
export async function exportPng(sizeName) {
  const s = SIZES[sizeName] || SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  return { width: s.w, height: s.h, blob, url };
}

function downloadPng(sizeName) {
  exportPng(sizeName).then(({ width, height, blob, url }) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-coast-${width}x${height}.png`;
    a.click();
    status.textContent = `Saved neon-coast-${width}x${height}.png (${width} x ${height})`;
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

// --- controls ---------------------------------------------------------------
document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  for (const file of files) {
    const img = await loadImage(URL.createObjectURL(file));
    state.photos.push({ img, name: file.name });
  }
  state.panels = defaultPanels(state.layout, state.photos.length);
  renderThumbs();
  redraw();
});
document.getElementById('samples').addEventListener('click', async () => {
  state.photos = [];
  await loadSamples();
  redraw();
});
document.querySelectorAll('#layouts button').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});
document.querySelectorAll('#grades button').forEach((b) => {
  b.addEventListener('click', () => setGrade(b.dataset.grade));
});
document.querySelectorAll('#sizes button').forEach((b) => {
  b.addEventListener('click', () => setSize(b.dataset.size));
});
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (panel) { panel.zoom = Number(zoomInput.value) / 100; redraw(); }
});
document.getElementById('fillAll').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  state.panels.forEach((p, i) => {
    const fresh = defaultPanels(state.layout, state.photos.length)[i];
    p.photo = panel.photo;
    p.zoom = panel.zoom;
    p.cx = fresh.cx;
    p.cy = fresh.cy;
  });
  redraw();
});
document.getElementById('resetCrop').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (panel) { panel.zoom = 1; panel.cx = 0.5; panel.cy = 0.5; redraw(); }
});
document.getElementById('export').addEventListener('click', () => downloadPng(state.size));
document.getElementById('exportAll').addEventListener('click', async () => {
  for (const name of Object.keys(SIZES)) {
    downloadPng(name);
    await new Promise((r) => setTimeout(r, 400));
  }
});

// --- panel picking: click to select, drag to pan, wheel to zoom --------------
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function panelAt(x, y) {
  for (let i = panelRects.length - 1; i >= 0; i--) {
    const r = panelRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const i = panelAt(x, y);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  const photo = state.photos[panel.photo]?.img;
  dragging = { x, y, panel, photo };
  canvas.setPointerCapture(e.pointerId);
  syncPanelControls();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const { x, y } = canvasPoint(e);
  const { panel, photo } = dragging;
  if (!photo) return;
  const rect = panelRects[state.selected];
  const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const dw = photo.naturalWidth * base * panel.zoom;
  const dh = photo.naturalHeight * base * panel.zoom;
  panel.cx = Math.min(1, Math.max(0, panel.cx - (x - dragging.x) / dw));
  panel.cy = Math.min(1, Math.max(0, panel.cy - (y - dragging.y) / dh));
  dragging.x = x;
  dragging.y = y;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { x, y } = canvasPoint(e);
  const i = panelAt(x, y);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  redraw();
}, { passive: false });

/** Renders the cover at an export size and resolves with its PNG as a data URL. */
export async function exportDataUrl(sizeName) {
  const s = SIZES[sizeName] || SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  drawCover(off, state);
  return { width: s.w, height: s.h, dataUrl: off.toDataURL('image/png') };
}

// --- start ------------------------------------------------------------------
window.__coverApp = { state, exportPng, exportDataUrl, redraw };

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, {
    state, canvas, loadSamples, redraw, setLayout, setGrade, setSize,
    setCaption: (v) => { state.caption = v; captionInput.value = v; },
    setSubtitle: (v) => { state.subtitle = v; subtitleInput.value = v; },
  });
} else {
  loadSamples().then(() => {
    redraw();
    document.fonts.ready.then(redraw);
    document.fonts.load('100px Anton').then(redraw);
    document.fonts.load('40px Pacifico').then(redraw);
  });
}
