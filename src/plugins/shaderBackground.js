import { createLogger } from '../engine/logger.js';
import * as waves from './shaders/waves.js';

const log = createLogger('background');

/**
 * @typedef {object} BackgroundTheme
 * @property {[number, number, number]} bottomLeft  linear RGB 0..1
 * @property {[number, number, number]} bottomRight
 * @property {[number, number, number]} topLeft
 * @property {[number, number, number]} topRight
 */

/**
 * Full-screen WebGL background rendered with Three.js. Listens to the `theme`
 * engine event to recolor the gradient.
 *
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {Record<string, BackgroundTheme>} options.themes
 * @param {string} [options.theme] initial theme key
 * @param {{vertexShader: string, fragmentShader: string}} [options.shader]
 * @param {number} [options.maxPixelRatio]
 * @param {number} [options.reducedMotionSpeed] time scale under prefers-reduced-motion
 */
export function shaderBackground({
  canvas,
  themes,
  theme = Object.keys(themes)[0],
  shader = waves,
  maxPixelRatio = 2,
  reducedMotionSpeed = 0.15,
}) {
  return (engine) => {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer = null;
    let material = null;
    let disposed = false;
    let currentTheme = theme;

    const applyTheme = (name) => {
      const colors = themes[name];
      if (!colors) return log.warn(`Unknown theme "${name}"`);
      currentTheme = name;
      if (!material) return;
      for (const [key, value] of Object.entries(colors)) {
        const uniform = material.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`];
        uniform?.value.fromArray(value);
      }
    };

    const resize = () => {
      if (!renderer) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.getDrawingBufferSize(material.uniforms.iResolution.value);
    };

    const init = async () => {
      const THREE = await import('three');
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'low-power', antialias: false });
      material = new THREE.ShaderMaterial({
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        uniforms: {
          iResolution: { value: new THREE.Vector2() },
          iTime: { value: 0 },
          uBottomLeft: { value: new THREE.Vector3() },
          uBottomRight: { value: new THREE.Vector3() },
          uTopLeft: { value: new THREE.Vector3() },
          uTopRight: { value: new THREE.Vector3() },
        },
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

      applyTheme(currentTheme);
      resize();

      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const speed = reducedMotion.matches ? reducedMotionSpeed : 1;
        material.uniforms.iTime.value += clock.getDelta() * speed;
        renderer.render(scene, camera);
      });
    };

    init().catch((error) => {
      log.error('WebGL background unavailable', error);
      canvas.classList.add('is-unsupported');
    });

    window.addEventListener('resize', resize);
    const offTheme = engine.on('theme', applyTheme);

    return () => {
      disposed = true;
      offTheme();
      window.removeEventListener('resize', resize);
      renderer?.setAnimationLoop(null);
      material?.dispose();
      renderer?.dispose();
    };
  };
}
