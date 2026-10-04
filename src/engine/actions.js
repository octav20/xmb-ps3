/**
 * Abstract input actions. Every input source (keyboard, gamepad, touch, remote…)
 * translates its events into one of these and calls `engine.dispatch(action)`.
 */
export const ACTIONS = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
  CONFIRM: 'confirm',
  BACK: 'back',
  OPTIONS: 'options',
});

export const DIRECTIONAL_ACTIONS = new Set([
  ACTIONS.LEFT,
  ACTIONS.RIGHT,
  ACTIONS.UP,
  ACTIONS.DOWN,
]);
