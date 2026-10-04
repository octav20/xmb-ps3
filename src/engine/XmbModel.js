import { Emitter } from './Emitter.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lastIndex = (list) => Math.max(0, list.length - 1);

/**
 * @typedef {object} XmbOption
 * @property {string} label
 * @property {any} [value]
 * @property {boolean} [selected]
 * @property {(ctx: object) => void} [action]
 *
 * @typedef {object} XmbItem
 * @property {string} [id]
 * @property {string} label
 * @property {string} [description]
 * @property {string} [icon]
 * @property {string} [focusIcon] Icon shown once the item has settled (e.g. a game logo).
 * @property {string} [backdrop]  Background image shown once the item has settled.
 * @property {string} [music]     Track played once the item has settled.
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
 */

function normalizeItems(items = [], prefix) {
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? `${prefix}-${index}`,
    options: item.options?.map((option) => ({ ...option })),
  }));
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
 * Events:
 * - `change`  ({reason, ...snapshot}) any state change.
 * - `focus`   ({category, item}) the focused item changed.
 * - `select`  ({category, item, option}) an option was chosen.
 * - `activate`({category, item}) an item without options was confirmed.
 * - `structure` ({categoryIndex}) the items of a category were replaced.
 */
export class XmbModel extends Emitter {
  #categoryIndex;
  #itemIndexes;
  #optionIndex = -1;

  /**
   * @param {XmbCategory[]} categories
   * @param {{initialCategory?: number}} [options]
   */
  constructor(categories, { initialCategory = 0 } = {}) {
    super();
    this.categories = normalizeCategories(categories);
    this.#categoryIndex = clamp(initialCategory, 0, this.categories.length - 1);
    this.#itemIndexes = this.categories.map((category) =>
      clamp(category.initialItem ?? 0, 0, lastIndex(category.items))
    );
  }

  get categoryIndex() {
    return this.#categoryIndex;
  }

  get category() {
    return this.categories[this.#categoryIndex];
  }

  get itemIndex() {
    return this.#itemIndexes[this.#categoryIndex];
  }

  get item() {
    return this.category.items[this.itemIndex] ?? null;
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

  itemIndexOf(categoryIndex) {
    return this.#itemIndexes[categoryIndex];
  }

  snapshot(reason = 'snapshot') {
    return {
      reason,
      categoryIndex: this.#categoryIndex,
      itemIndex: this.itemIndex,
      optionIndex: this.#optionIndex,
      category: this.category,
      item: this.item,
      option: this.option,
    };
  }

  moveCategory(step) {
    if (this.optionsOpen) return false;
    const next = clamp(this.#categoryIndex + step, 0, this.categories.length - 1);
    if (next === this.#categoryIndex) return false;
    this.#categoryIndex = next;
    this.#commitFocus('category');
    return true;
  }

  moveItem(step) {
    if (this.optionsOpen) return this.moveOption(step);
    const current = this.itemIndex;
    const next = clamp(current + step, 0, lastIndex(this.category.items));
    if (next === current) return false;
    this.#itemIndexes[this.#categoryIndex] = next;
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

    if (item.options?.length && !item.action) return this.openOptions();

    this.emit('activate', { category, item });
    return true;
  }

  back() {
    return this.closeOptions();
  }

  /**
   * Replaces the items of a category at runtime (e.g. content loaded from an API).
   * @param {string} categoryId
   * @param {XmbItem[]} items
   */
  setItems(categoryId, items) {
    const index = this.categories.findIndex((category) => category.id === categoryId);
    if (index === -1) throw new Error(`XMB: unknown category "${categoryId}"`);

    const category = this.categories[index];
    category.items = normalizeItems(items, category.id);
    this.#itemIndexes[index] = clamp(this.#itemIndexes[index], 0, lastIndex(category.items));
    this.emit('structure', { categoryIndex: index });

    if (index === this.#categoryIndex) {
      this.#optionIndex = -1;
      this.#commitFocus('structure');
    }
  }

  #commitFocus(reason) {
    this.emit('change', this.snapshot(reason));
    this.emit('focus', { category: this.category, item: this.item });
  }
}
