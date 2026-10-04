/**
 * Fixed-resolution design surface. Everything inside `element` is laid out in
 * design pixels (1920×1080 by default, the PS3 1080p canvas) and scaled to fit
 * the viewport while preserving the aspect ratio. Backgrounds stay outside the
 * stage so they still cover the whole screen.
 *
 * @param {HTMLElement} element
 * @param {{width?: number, height?: number, fit?: 'contain' | 'cover'}} [options]
 * @returns {() => void} cleanup
 */
export function fitStage(element, { width = 1920, height = 1080, fit = 'contain' } = {}) {
  element.classList.add('xmb-stage');
  element.style.setProperty('--xmb-stage-w', `${width}px`);
  element.style.setProperty('--xmb-stage-h', `${height}px`);

  const resize = () => {
    const ratios = [window.innerWidth / width, window.innerHeight / height];
    const scale = fit === 'cover' ? Math.max(...ratios) : Math.min(...ratios);
    element.style.setProperty('--xmb-scale', String(scale));
  };

  resize();
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}
