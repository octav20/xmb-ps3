import { Emitter } from './Emitter.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lastIndex = (list) => Math.max(0, list.length - 1);
const isThenable = (value) => typeof value?.then === 'function';

/**
 * @typedef {object} XmbOption
 * @property {string} label
 * @property {any} [value]
 * @property {boolean} [selected]
 * @property {(ctx: object) => void} [action]
 *
 * @typedef {object} XmbItem
 * @property {string} [id]  Must be unique across the whole menu when provided.
 * @property {string} label
 * @property {string} [description]
 * @property {string} [icon]
 * @property {string} [focusIcon] Icon shown once the item has settled (e.g. a game logo).
 * @property {string} [backdrop]  Background image shown once the item has settled.
 * @property {string} [music]     Track played once the item has settled.
 * @property {XmbItem[] | ((ctx: object) => XmbItem[] | Promise<XmbItem[]>)} [items]
 *   Makes the item a folder: confirming it opens a nested list. A function is
 *   called each time the folder is opened (lazy / remote content).
 * @property {number} [initialItem] Focused child when the folder is opened.
 * @property {XmbOption[]} [options] Secondary list (PS3 "options" panel).
 * @property {(ctx: object) => void} [action]   Called on confirm.
 * @property {(ctx: object) => void} [onSelect] Called when an option is chosen.
 *
 * @typedef {object} XmbCategory
 * @property {string} [id]
 * @property {string} label
 * @property {string} [icon]
 * @property {number} [initialItem]
 * @property {XmbItem[]} [items]
 *
 * @typedef {object} XmbLevel
 * @property {XmbItem} owner  folder that opened this level
 * @property {XmbItem[]} items
 * @property {number} index
 */

export const isFolder = (item) => item?.items !== undefined;

function normalizeItems(items = [], prefix) {
  return items.map((item, index) => {
    const id = item.id ?? `${prefix}-${index}`;
    return {
      ...item,
      id,
      items: Array.isArray(item.items) ? normalizeItems(item.items, id) : item.items,
      options: item.options?.map((option) => ({ ...option })),
    };
  });
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('XMB: at least one category is required');
  }
  return categories.map((category, index) => {
    const id = category.id ?? `category-${index}`;
    return { ...category, id, items: normalizeItems(category.items, id) };
  });
}

/**
 * Pure navigation state of the XMB. It knows nothing about the DOM, audio or
 * rendering: it only validates moves and emits events.
 *
 * Navigation is a category row plus, for the active category, a stack of
 * levels: the category's own items (root) and one level per opened folder.
 *
 * Events:
 * - `change`  ({reason, ...snapshot}) any state change.
 * - `focus`   ({category, item, depth}) the focused item changed.
 * - `select`  ({category, item, option}) an option was chosen.
 * - `activate`({category, item}) a leaf item was confirmed.
 * - `loading` ({item}) an async folder started loading.
 * - `error`   ({item, error}) an async folder failed to load.
 * - `structure` ({categoryIndex}) the items of a category were replaced.
 */
export class XmbModel extends Emitter {
  #categoryIndex;
  #rootIndexes;
  /** @type {XmbLevel[]} */
  #stack = [];
  #optionIndex = -1;
  #loading = null;
  #loadToken = 0;

  /**
   * @param {XmbCategory[]} categories
   * @param {{initialCategory?: number}} [options]
   */
  constructor(categories, { initialCategory = 0 } = {}) {
    super();
    this.categories = normalizeCategories(categories);
    this.#categoryIndex = clamp(initialCategory, 0, this.categories.length - 1);
    this.#rootIndexes = this.categories.map((category) =>
      clamp(category.initialItem ?? 0, 0, lastIndex(category.items))
    );
  }

  get categoryIndex() {
    return this.#categoryIndex;
  }

  get category() {
    return this.categories[this.#categoryIndex];
  }

  /** Number of opened folders (0 = category root). */
  get depth() {
    return this.#stack.length;
  }

  /** Opened folder levels, outermost first. */
  get levels() {
    return this.#stack.map((level) => ({ ...level }));
  }

  /** Folders leading to the current level, outermost first. */
  get path() {
    return this.#stack.map((level) => level.owner);
  }

  get items() {
    return this.#stack.at(-1)?.items ?? this.category.items;
  }

  get itemIndex() {
    return this.#stack.at(-1)?.index ?? this.#rootIndexes[this.#categoryIndex];
  }

  get item() {
    return this.items[this.itemIndex] ?? null;
  }

  get loading() {
    return this.#loading;
  }

  get optionsOpen() {
    return this.#optionIndex !== -1;
  }

  get optionIndex() {
    return this.#optionIndex;
  }

  get option() {
    return this.item?.options?.[this.#optionIndex] ?? null;
  }

  /** Focused root item of any category (remembered while browsing others). */
  itemIndexOf(categoryIndex) {
    return this.#rootIndexes[categoryIndex];
  }

  snapshot(reason = 'snapshot') {
    return {
      reason,
      categoryIndex: this.#categoryIndex,
      depth: this.depth,
      itemIndex: this.itemIndex,
      optionIndex: this.#optionIndex,
      category: this.category,
      path: this.path,
      item: this.item,
      option: this.option,
      loading: this.#loading,
    };
  }

  moveCategory(step) {
    if (this.optionsOpen || this.depth > 0) return false;
    const next = clamp(this.#categoryIndex + step, 0, this.categories.length - 1);
    if (next === this.#categoryIndex) return false;
    this.#categoryIndex = next;
    this.#commitFocus('category');
    return true;
  }

  moveItem(step) {
    if (this.optionsOpen) return this.moveOption(step);
    const current = this.itemIndex;
    const next = clamp(current + step, 0, lastIndex(this.items));
    if (next === current) return false;
    this.#setItemIndex(next);
    this.#commitFocus('item');
    return true;
  }

  moveOption(step) {
    const options = this.item?.options;
    if (!this.optionsOpen || !options) return false;
    const next = clamp(this.#optionIndex + step, 0, lastIndex(options));
    if (next === this.#optionIndex) return false;
    this.#optionIndex = next;
    this.emit('change', this.snapshot('option'));
    return true;
  }

  openOptions() {
    const options = this.item?.options;
    if (this.optionsOpen || !options?.length) return false;
    this.#optionIndex = Math.max(0, options.findIndex((option) => option.selected));
    this.emit('change', this.snapshot('options:open'));
    return true;
  }

  closeOptions() {
    if (!this.optionsOpen) return false;
    this.#optionIndex = -1;
    this.emit('change', this.snapshot('options:close'));
    return true;
  }

  /** Opens the focused folder. Async folders resolve later unless focus moves. */
  enter() {
    const { item, category } = this;
    if (this.optionsOpen || !isFolder(item)) return false;

    const source = typeof item.items === 'function' ? item.items({ category, item }) : item.items;
    if (!isThenable(source)) {
      this.#push(item, source);
      return true;
    }

    const token = ++this.#loadToken;
    this.#loading = item;
    this.emit('loading', { item });
    this.emit('change', this.snapshot('loading'));
    source.then(
      (items) => token === this.#loadToken && this.#push(item, items),
      (error) => {
        if (token !== this.#loadToken) return;
        this.#loading = null;
        this.emit('error', { item, error });
        this.emit('change', this.snapshot('error'));
      }
    );
    return true;
  }

  /** Leaves the current folder. */
  exit() {
    if (this.depth === 0) return false;
    this.#stack.pop();
    this.#commitFocus('exit');
    return true;
  }

  confirm() {
    const { category, item } = this;
    if (!item) return false;

    if (this.optionsOpen) {
      const option = this.option;
      item.options.forEach((entry) => (entry.selected = entry === option));
      this.closeOptions();
      this.emit('select', { category, item, option });
      return true;
    }

    if (isFolder(item)) return this.enter();
    if (item.options?.length && !item.action) return this.openOptions();

    this.emit('activate', { category, item });
    return true;
  }

  back() {
    return this.closeOptions() || this.exit();
  }

  /**
   * Replaces the items of a category at runtime (e.g. content loaded from an API).
   * Any folder opened inside that category is closed.
   * @param {string} categoryId
   * @param {XmbItem[]} items
   */
  setItems(categoryId, items) {
    const index = this.categories.findIndex((category) => category.id === categoryId);
    if (index === -1) throw new Error(`XMB: unknown category "${categoryId}"`);

    const category = this.categories[index];
    category.items = normalizeItems(items, category.id);
    this.#rootIndexes[index] = clamp(this.#rootIndexes[index], 0, lastIndex(category.items));
    this.emit('structure', { categoryIndex: index });

    if (index === this.#categoryIndex) {
      this.#stack = [];
      this.#optionIndex = -1;
      this.#commitFocus('structure');
    }
  }

  #push(owner, items) {
    const normalized = Array.isArray(owner.items) ? items : normalizeItems(items, owner.id);
    this.#stack.push({
      owner,
      items: normalized,
      index: clamp(owner.initialItem ?? 0, 0, lastIndex(normalized)),
    });
    this.#commitFocus('enter');
  }

  #setItemIndex(index) {
    const level = this.#stack.at(-1);
    if (level) level.index = index;
    else this.#rootIndexes[this.#categoryIndex] = index;
  }

  #commitFocus(reason) {
    this.#loadToken++;
    this.#loading = null;
    this.emit('change', this.snapshot(reason));
    this.emit('focus', { category: this.category, item: this.item, depth: this.depth });
  }
}
