import { XmbEngine } from '../engine/index.js';
import {
  AudioManager,
  audio,
  backdrop,
  clock,
  debugOverlay,
  gamepad,
  shaderBackground,
} from '../plugins/index.js';
import { runBootSequence } from './boot.js';
import { categories, defaultTheme, sounds, themes, timing } from './config.js';

const $ = (selector) => document.querySelector(selector);

const sound = new AudioManager();

const engine = new XmbEngine({
  root: $('#xmb'),
  categories,
  settleDelay: timing.settleDelay,
});

engine
  .use(shaderBackground({ canvas: $('#bg'), themes, theme: defaultTheme }))
  .use(audio({ manager: sound, sounds }))
  .use(backdrop({ element: $('#backdrop') }))
  .use(clock({ element: $('#clock') }))
  .use(gamepad())
  .use(debugOverlay({ element: $('#debug-overlay') }));

await runBootSequence({
  startScreen: $('#start-screen'),
  startButton: $('#start-button'),
  splash: $('#splash'),
  onStart: () => sound.play(sounds.boot),
  duration: timing.bootDuration,
});

$('#status-bar').hidden = false;
engine.start();
