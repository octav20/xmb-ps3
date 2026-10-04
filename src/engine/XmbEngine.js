import { ACTIONS } from './actions.js';
import { KeyboardInput } from './KeyboardInput.js';
import { createLogger } from './logger.js';
import { XmbModel } from './XmbModel.js';
import { XmbView } from './XmbView.js';

const log = createLogger('engine');

/**
 * @typedef {(engine: XmbEngine) => (void | (() => void))} XmbPlugin
 * A plugin receives the engine, subscribes to its events and may return a
 * cleanup function that runs on `engine.destroy()`.
 *
 * Engine events (in addition to the model events):
 * - `start`    snapshot, emitted once the XMB is mounted.
 * - `navigate` ({action, changed}) every dispatched action.
 * - `settle`   ({category, item}) the focused item stayed focused for `settleDelay` ms.
 * - any custom event emitted through `engine.emit()` (e.g. `theme`).
 */
export class XmbEngine {
  #input;
  #cleanups = [];
  #settleTimer = 0;
  #started = false;

  /**
   * @param {object} options
   * @param {HTMLElement} options.root
   * @param {import('./XmbModel.js').XmbCategory[]} options.categories
   * @param {number} [options.initialCategory]
   * @param {number} [options.settleDelay] ms before an item is considered "settled".
   * @param {Record<string, string>} [options.keymap]
   * @param {number} [options.repeatInterval]
   * @param {string} [options.emptyLabel] text shown in an empty folder.
   */
  constructor({ root, categories, initialCategory = 0, settleDelay = 1000, keymap, repeatInterval, emptyLabel }) {
    this.settleDelay = settleDelay;
    this.model = new XmbModel(categories, { initialCategory });
    this.view = new XmbView(root, this.model, { emptyLabel });
    this.#input = new KeyboardInput((action) => this.dispatch(action), { keymap, repeatInterval });

    this.#cleanups.push(
      this.on('focus', (payload) => this.#scheduleSettle(payload)),
      this.on('activate', (ctx) => ctx.item.action?.({ ...ctx, engine: this })),
      this.on('select', (ctx) => (ctx.option.action ?? ctx.item.onSelect)?.({ ...ctx, engine: this }))
    );
  }

  get started() {
    return this.#started;
  }

  on(type, handler) {
    return this.model.on(type, handler);
  }

  emit(type, payload) {
    this.model.emit(type, payload);
  }

  /**
   * @param {XmbPlugin} plugin
   */
  use(plugin) {
    const cleanup = plugin(this);
    if (typeof cleanup === 'function') this.#cleanups.push(cleanup);
    return this;
  }

  /**
   * Entry point for every input source.
   * @param {string} action one of ACTIONS
   * @returns {boolean} whether the state changed
   */
  dispatch(action) {
    if (!this.#started) return false;
    const model = this.model;

    let changed;
    switch (action) {
      case ACTIONS.LEFT:
        changed = model.back() || model.moveCategory(-1);
        break;
      case ACTIONS.RIGHT:
        changed = model.moveCategory(1);
        break;
      case ACTIONS.UP:
        changed = model.moveItem(-1);
        break;
      case ACTIONS.DOWN:
        changed = model.moveItem(1);
        break;
      case ACTIONS.CONFIRM:
        changed = model.confirm();
        break;
      case ACTIONS.BACK:
        changed = model.back();
        break;
      case ACTIONS.OPTIONS:
        changed = model.optionsOpen ? model.closeOptions() : model.openOptions();
        break;
      default:
        log.warn(`Unknown action "${action}"`);
        return false;
    }

    this.emit('navigate', { action, changed });
    return changed;
  }

  start() {
    if (this.#started) return;
    this.view.mount();
    this.#input.attach();
    this.#started = true;
    this.emit('start', this.model.snapshot('start'));
    this.emit('focus', { category: this.model.category, item: this.model.item });
  }

  destroy() {
    clearTimeout(this.#settleTimer);
    this.#input.detach();
    this.view.unmount();
    this.#cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    this.#started = false;
  }

  #scheduleSettle(payload) {
    clearTimeout(this.#settleTimer);
    if (!payload.item) return;
    this.#settleTimer = setTimeout(() => this.emit('settle', payload), this.settleDelay);
  }
}
