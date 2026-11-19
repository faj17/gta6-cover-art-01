// Neon Coast cover engine: multi-panel poster layouts, gradient-map colour grades
// (a lookup table built from a sunset/neon ramp, applied to each photo's pixels),
// grain, vignette and bold Anton caption lettering with a Pacifico subtitle.
// Everything is drawn on a 2D canvas, offline, from the user's own photos.

export const LAYOUTS = {
  hero: { panels: 4, label: 'Hero + three' },
  grid4: { panels: 4, label: 'Four panels' },
  grid9: { panels: 9, label: 'Nine panels' },
  full: { panels: 1, label: 'Full bleed' },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
};

// A grade is a ramp of [stop, colour] pairs: a pixel's luminance picks its colour.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    stops: [[0, '#160a2e'], [0.25, '#5b1a5e'], [0.5, '#c22a6e'], [0.75, '#ff7a3d'], [1, '#ffd166']],
    mix: 0.85,
  },
  neon: {
    label: 'Neon night',
    stops: [[0, '#02141f'], [0.25, '#0b3d5c'], [0.5, '#d63384'], [0.75, '#ff5fa2'], [1, '#7df9ff']],
    mix: 0.85,
  },
  vice: {
    label: 'Vice glow',
    stops: [[0, '#12041f'], [0.3, '#4c1d95'], [0.55, '#db2777'], [0.8, '#fb923c'], [1, '#fcd34d']],
    mix: 0.85,
  },
  noir: {
    label: 'Noir',
    stops: [[0, '#050505'], [0.5, '#6b6b6b'], [1, '#f5f5f5']],
    mix: 0.9,
  },
  none: { label: 'Original', stops: null, mix: 0 },
};

export function coverGutter(w, h) {
  return Math.max(4, Math.round(Math.min(w, h) * 0.008));
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Builds a 256-entry gradient-map lookup table from a grade's ramp. */
export function gradeLookup(grade) {
  const table = new Uint8Array(256 * 3);
  const stops = grade.stops.map(([at, hex]) => [at, hexRgb(hex)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let c = 0; c < 3; c++) table[i * 3 + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * f);
  }
  return table;
}

/** Panel rectangles for a layout, in cover coordinates. Gutter is the white gap. */
export function layoutPanels(layout, w, h, gutter) {
  const g = gutter;
  const inset = (x, y, pw, ph) => ({ x, y, w: pw, h: ph });
  if (layout === 'full') return [inset(g, g, w - 2 * g, h - 2 * g)];
  if (layout === 'grid4') {
    const cw = (w - 3 * g) / 2;
    const ch = (h - 3 * g) / 2;
    return [
      inset(g, g, cw, ch), inset(2 * g + cw, g, cw, ch),
      inset(g, 2 * g + ch, cw, ch), inset(2 * g + cw, 2 * g + ch, cw, ch),
    ];
  }
  if (layout === 'grid9') {
    const cw = (w - 4 * g) / 3;
    const ch = (h - 4 * g) / 3;
    const out = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      out.push(inset(g + c * (cw + g), g + r * (ch + g), cw, ch));
    }
    return out;
  }
  // hero: one big panel plus three small ones. Portrait covers stack them vertically.
  if (h > w) {
    const heroH = (h - 3 * g) * 0.58;
    const rowH = h - heroH - 3 * g;
    const cw = (w - 4 * g) / 3;
    return [
      inset(g, g, w - 2 * g, heroH),
      inset(g, 2 * g + heroH, cw, rowH),
      inset(2 * g + cw, 2 * g + heroH, cw, rowH),
      inset(3 * g + 2 * cw, 2 * g + heroH, cw, rowH),
    ];
  }
  const heroW = (w - 3 * g) * 0.62;
  const colW = w - heroW - 3 * g;
  const ch = (h - 4 * g) / 3;
  return [
    inset(g, g, heroW, h - 2 * g),
    inset(2 * g + heroW, g, colW, ch),
    inset(2 * g + heroW, 2 * g + ch, colW, ch),
    inset(2 * g + heroW, 3 * g + 2 * ch, colW, ch),
  ];
}

/** Draws one photo into a panel, cover-fit, with the panel crop's zoom and centre.
 * The centre is clamped so the photo always covers the whole panel. */
export function drawPanelPhoto(ctx, rect, photo, crop) {
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (crop.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const minCx = (rect.w / 2) / dw;
  const minCy = (rect.h / 2) / dh;
  const cx = Math.min(1 - minCx, Math.max(minCx, crop.cx ?? 0.5));
  const cy = Math.min(1 - minCy, Math.max(minCy, crop.cy ?? 0.5));
  const dx = rect.x + rect.w / 2 - dw * cx;
  const dy = rect.y + rect.h / 2 - dh * cy;
  ctx.drawImage(photo, dx, dy, dw, dh);
}

/** Applies a grade's gradient map to every pixel inside the panel rectangles. */
export function applyGrade(ctx, rects, gradeName) {
  const grade = GRADES[gradeName];
  if (!grade || !grade.stops) return;
  const lut = gradeLookup(grade);
  const mix = grade.mix;
  const canvas = ctx.canvas;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const W = canvas.width;
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(W, Math.ceil(r.x + r.w));
    const y1 = Math.min(canvas.height, Math.ceil(r.y + r.h));
    for (let y = y0; y < y1; y++) {
      let i = (y * W + x0) * 4;
      for (let x = x0; x < x1; x++, i += 4) {
        const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
        const li = lum * 3;
        data[i] = data[i] + (lut[li] - data[i]) * mix;
        data[i + 1] = data[i + 1] + (lut[li + 1] - data[i + 1]) * mix;
        data[i + 2] = data[i + 2] + (lut[li + 2] - data[i + 2]) * mix;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

let grainPattern = null;
function grain(ctx, w, h) {
  if (!grainPattern) {
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
    }
    tctx.putImageData(img, 0, 0);
    grainPattern = ctx.createPattern(tile, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vignette(ctx, w, h) {
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  grad.addColorStop(0, 'rgba(8, 0, 18, 0)');
  grad.addColorStop(1, 'rgba(8, 0, 18, 0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Bold caption lettering: sunset-gradient Anton capitals, dark outline, script subtitle. */
export function drawCaption(ctx, w, h, caption, subtitle) {
  const text = (caption || '').trim().toUpperCase();
  if (!text) return;
  const bottom = h * 0.055;
  // Soft dark bed so the letters read on any photo.
  const bed = ctx.createLinearGradient(0, h * 0.68, 0, h);
  bed.addColorStop(0, 'rgba(10, 0, 22, 0)');
  bed.addColorStop(1, 'rgba(10, 0, 22, 0.55)');
  ctx.fillStyle = bed;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  ctx.save();
  ctx.translate(w / 2, h - bottom);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let size = w * 0.115;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (ctx.measureText(text).width > w * 0.92 && size > 16) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  const titleY = 0;
  const fill = ctx.createLinearGradient(0, -size, 0, size * 0.15);
  fill.addColorStop(0, '#fff3b0');
  fill.addColorStop(0.45, '#ffb347');
  fill.addColorStop(0.75, '#ff5e78');
  fill.addColorStop(1, '#d946ef');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16, 0, 28, 0.92)';
  ctx.lineWidth = Math.max(3, size * 0.07);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  ctx.strokeText(text, 0, titleY);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(14, size * 0.30);
    ctx.font = `${subSize}px Pacifico, cursive`;
    const subY = -size * 1.02;
    ctx.lineWidth = Math.max(2, subSize * 0.12);
    ctx.strokeStyle = 'rgba(16, 0, 28, 0.85)';
    ctx.strokeText(sub, 0, subY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, 0, subY);
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size.
 * state: { layout, grade, caption, subtitle, photos: [{img}], panels: [{photo, zoom, cx, cy}] }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const gutter = coverGutter(w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h, gutter);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const panel = state.panels[i] || { photo: 0, zoom: 1, cx: 0.5, cy: 0.5 };
    const photo = state.photos[panel.photo] && state.photos[panel.photo].img;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#1b1030';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (photo) {
      drawPanelPhoto(ctx, r, photo, panel);
    } else {
      ctx.fillStyle = '#241335';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }
  applyGrade(ctx, rects, state.grade);
  grain(ctx, w, h);
  vignette(ctx, w, h);
  drawCaption(ctx, w, h, state.caption, state.subtitle);
  return rects;
}
