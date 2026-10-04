import { ACTIONS } from './actions.js';

export const DEFAULT_KEYMAP = Object.freeze({
  ArrowLeft: ACTIONS.LEFT,
  ArrowRight: ACTIONS.RIGHT,
  ArrowUp: ACTIONS.UP,
  ArrowDown: ACTIONS.DOWN,
  Enter: ACTIONS.CONFIRM,
  Escape: ACTIONS.BACK,
  Backspace: ACTIONS.BACK,
  o: ACTIONS.OPTIONS,
});

/**
 * Translates keyboard events into engine actions. Auto-repeat is throttled so
 * holding a key scrolls at a steady, PS3-like pace.
 */
export class KeyboardInput {
  #lastRepeat = 0;

  /**
   * @param {(action: string) => void} dispatch
   * @param {{keymap?: Record<string, string>, repeatInterval?: number, target?: EventTarget}} [options]
   */
  constructor(dispatch, { keymap = DEFAULT_KEYMAP, repeatInterval = 110, target = window } = {}) {
    this.dispatch = dispatch;
    this.keymap = keymap;
    this.repeatInterval = repeatInterval;
    this.target = target;
  }

  #onKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const action = this.keymap[event.key] ?? this.keymap[event.key.toLowerCase()];
    if (!action) return;

    event.preventDefault();
    if (event.repeat) {
      const now = performance.now();
      if (now - this.#lastRepeat < this.repeatInterval) return;
      this.#lastRepeat = now;
    }
    this.dispatch(action);
  };

  attach() {
    this.target.addEventListener('keydown', this.#onKeyDown);
  }

  detach() {
    this.target.removeEventListener('keydown', this.#onKeyDown);
  }
}
