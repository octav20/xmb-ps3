import { createLogger } from '../engine/logger.js';

const log = createLogger('audio');

/**
 * Small audio service: overlapping one-shot effects and a single music track
 * that can be paused and resumed.
 */
export class AudioManager {
  #effects = new Map();
  #music = null;

  constructor({ effectsVolume = 1, musicVolume = 0.7 } = {}) {
    this.effectsVolume = effectsVolume;
    this.musicVolume = musicVolume;
  }

  play(src) {
    if (!src) return;
    let base = this.#effects.get(src);
    if (!base) {
      base = new Audio(src);
      base.preload = 'auto';
      this.#effects.set(src, base);
    }
    const node = base.paused ? base : base.cloneNode();
    node.currentTime = 0;
    node.volume = this.effectsVolume;
    node.play().catch((error) => log.debug('Effect blocked', src, error));
  }

  playMusic(src, { loop = true } = {}) {
    if (!src) return;
    if (this.#music?.dataset.src !== src) {
      this.stopMusic({ reset: true });
      this.#music = Object.assign(new Audio(src), { loop, volume: this.musicVolume });
      this.#music.dataset.src = src;
    }
    this.#music.play().catch((error) => log.warn('Music blocked', src, error));
  }

  stopMusic({ reset = false } = {}) {
    if (!this.#music) return;
    this.#music.pause();
    if (reset) this.#music = null;
  }
}

/**
 * Wires navigation sounds and per-item music to the engine.
 * `sounds` maps an action name (`left`, `confirm`, …) to a file; `navigate`
 * is the fallback for any action that changed the state.
 *
 * @param {{manager: AudioManager, sounds?: Record<string, string>}} options
 */
export function audio({ manager, sounds = {} }) {
  return (engine) => {
    const offs = [
      engine.on('navigate', ({ action, changed }) => {
        if (changed) manager.play(sounds[action] ?? sounds.navigate);
      }),
      engine.on('focus', () => manager.stopMusic()),
      engine.on('settle', ({ item }) => manager.playMusic(item.music)),
    ];
    return () => {
      offs.forEach((off) => off());
      manager.stopMusic({ reset: true });
    };
  };
}
