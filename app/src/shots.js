// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows the cover alone, drawn at its export size. Query knobs:
// layout, grade, size (1080x1080 | 1080x1350 | 1920x1080), caption, subtitle.
// window.__shotReady is set once the scene is painted with its fonts loaded.
import { drawCover, SIZES } from './cover.js';

export async function runShot(shot, query, api) {
  const { state } = api;
  if (query.get('layout')) api.setLayout(query.get('layout'));
  if (query.get('grade')) api.setGrade(query.get('grade'));
  if (query.get('size')) api.setSize(query.get('size'));
  if (query.get('caption')) api.setCaption(query.get('caption'));
  if (query.get('subtitle') !== null) api.setSubtitle(query.get('subtitle') ?? '');
  await api.loadSamples();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const s = SIZES[state.size];
    api.canvas.width = s.w;
    api.canvas.height = s.h;
    drawCover(api.canvas, state);
  } else {
    api.redraw();
  }
  try { await document.fonts.ready; } catch { /* fonts are best-effort */ }
  if (shot === 'cover') drawCover(api.canvas, state);
  else api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
