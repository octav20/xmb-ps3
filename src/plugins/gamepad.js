import { ACTIONS, DIRECTIONAL_ACTIONS } from '../engine/actions.js';

/** W3C "standard" gamepad layout (DualShock: ✕ confirm, ○ back, △ options). */
export const STANDARD_MAPPING = Object.freeze({
  0: ACTIONS.CONFIRM,
  1: ACTIONS.BACK,
  3: ACTIONS.OPTIONS,
  12: ACTIONS.UP,
  13: ACTIONS.DOWN,
  14: ACTIONS.LEFT,
  15: ACTIONS.RIGHT,
});

/**
 * Gamepad input source with D-pad / left-stick auto-repeat. Polling only runs
 * while at least one gamepad is connected.
 */
export function gamepad({
  mapping = STANDARD_MAPPING,
  axisThreshold = 0.5,
  repeatDelay = 350,
  repeatInterval = 120,
} = {}) {
  return (engine) => {
    const held = new Map();
    let frame = 0;

    const readPressed = () => {
      const pressed = new Set();
      for (const pad of navigator.getGamepads?.() ?? []) {
        if (!pad) continue;
        for (const [button, action] of Object.entries(mapping)) {
          if (pad.buttons[button]?.pressed) pressed.add(action);
        }
        const [x = 0, y = 0] = pad.axes;
        if (x < -axisThreshold) pressed.add(ACTIONS.LEFT);
        if (x > axisThreshold) pressed.add(ACTIONS.RIGHT);
        if (y < -axisThreshold) pressed.add(ACTIONS.UP);
        if (y > axisThreshold) pressed.add(ACTIONS.DOWN);
      }
      return pressed;
    };

    const poll = (now) => {
      const pressed = readPressed();
      for (const action of pressed) {
        const next = held.get(action);
        if (next === undefined) {
          engine.dispatch(action);
          held.set(action, now + repeatDelay);
        } else if (DIRECTIONAL_ACTIONS.has(action) && now >= next) {
          engine.dispatch(action);
          held.set(action, now + repeatInterval);
        }
      }
      for (const action of held.keys()) if (!pressed.has(action)) held.delete(action);
      frame = requestAnimationFrame(poll);
    };

    const hasPads = () => [...(navigator.getGamepads?.() ?? [])].some(Boolean);
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = hasPads() ? requestAnimationFrame(poll) : 0;
      if (!frame) held.clear();
    };

    window.addEventListener('gamepadconnected', sync);
    window.addEventListener('gamepaddisconnected', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', sync);
      window.removeEventListener('gamepaddisconnected', sync);
    };
  };
}
