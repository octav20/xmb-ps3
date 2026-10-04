/**
 * DOM renderer for the XMB. It builds the markup from the model and maps the
 * navigation state to CSS custom properties; all geometry lives in `xmb.css`,
 * so positions are recomputed by the browser and never accumulate.
 *
 * Root vars: `--xmb-category` (active category) and `--xmb-level` (folder depth).
 * Item vars: `--rel` (index relative to the focused item) and `--depth` (|rel|).
 */

function h(tag, className, props = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return Object.assign(element, props);
}

function icon(className, src) {
  return src ? h('img', className, { src, alt: '', decoding: 'async', draggable: false }) : h('span', className);
}

function toMs(value) {
  const number = parseFloat(value);
  if (Number.isNaN(number)) return 0;
  return value.trim().endsWith('ms') ? number : number * 1000;
}

function buildItem(item) {
  const element = h('li', 'xmb-item', { role: 'option' });
  element.dataset.id = item.id;
  if (item.items !== undefined) element.classList.add('is-folder');

  const text = h('div', 'xmb-item__text');
  text.append(h('span', 'xmb-item__label', { textContent: item.label }));
  if (item.description) {
    text.append(h('span', 'xmb-item__description', { textContent: item.description }));
  }

  element.append(icon('xmb-item__icon', item.icon), text);
  return element;
}

/** Applies the relative-position classes to a column of item elements. */
function layoutColumn(elements, focused, selectable) {
  elements.forEach((element, index) => {
    const rel = index - focused;
    element.style.setProperty('--rel', rel);
    element.style.setProperty('--depth', Math.abs(rel));
    element.classList.toggle('is-before', rel < 0);
    element.classList.toggle('is-focused', rel === 0);
    element.classList.toggle('is-after', rel > 0);
    element.setAttribute('aria-selected', String(selectable && rel === 0));
  });
}

export class XmbView {
  #model;
  #root;
  #emptyLabel;
  #element = null;
  #track = null;
  #optionsPanel = null;
  #optionsList = null;
  #categories = [];
  /** @type {{owner: object, items: object[], element: HTMLElement, entries: HTMLElement[]}[]} */
  #levels = [];
  #subscriptions = [];
  #featured = null;

  /**
   * @param {HTMLElement} root
   * @param {import('./XmbModel.js').XmbModel} model
   * @param {{emptyLabel?: string}} [options]
   */
  constructor(root, model, { emptyLabel = 'There are no items.' } = {}) {
    if (!root) throw new Error('XMB: a root element is required');
    this.#root = root;
    this.#model = model;
    this.#emptyLabel = emptyLabel;
  }

  get element() {
    return this.#element;
  }

  mount() {
    if (this.#element) return;

    this.#element = h('div', 'xmb');
    this.#track = h('div', 'xmb__track');
    this.#optionsList = h('ol', 'xmb-options__list', { role: 'listbox' });
    this.#optionsPanel = h('aside', 'xmb-options');
    this.#optionsPanel.append(this.#optionsList);

    this.#categories = this.#model.categories.map((category, index) => this.#buildCategory(category, index));
    this.#track.append(...this.#categories.map((view) => view.element));
    this.#element.append(this.#track, this.#optionsPanel);
    this.#root.append(this.#element);

    this.#subscriptions = [
      this.#model.on('change', () => this.update()),
      this.#model.on('structure', ({ categoryIndex }) => this.#rebuildItems(categoryIndex)),
      this.#model.on('focus', () => this.#setFeatured(null)),
      this.#model.on('settle', ({ item }) => this.#setFeatured(item)),
    ];
    this.update();
  }

  unmount() {
    this.#subscriptions.forEach((unsubscribe) => unsubscribe());
    this.#subscriptions = [];
    this.#element?.remove();
    this.#element = null;
    this.#categories = [];
    this.#levels = [];
    this.#featured = null;
  }

  update() {
    if (!this.#element) return;
    const model = this.#model;
    const depth = model.depth;

    this.#element.style.setProperty('--xmb-category', model.categoryIndex);
    this.#element.style.setProperty('--xmb-level', depth);
    this.#element.classList.toggle('is-nested', depth > 0);
    this.#element.classList.toggle('has-options', model.optionsOpen);

    this.#categories.forEach((view, categoryIndex) => {
      const active = categoryIndex === model.categoryIndex;
      view.element.classList.toggle('is-active', active);
      view.list.classList.toggle('is-current', active && depth === 0);
      view.list.classList.toggle('is-parent', active && depth === 1);
      view.list.classList.toggle('is-ancestor', active && depth > 0);
      layoutColumn(view.items, model.itemIndexOf(categoryIndex), active && depth === 0);
    });

    this.#syncLevels();
    this.#element.querySelectorAll('.xmb-item.is-loading').forEach((el) => el.classList.remove('is-loading'));
    if (model.loading) this.#findItemElement(model.loading)?.classList.add('is-loading');
    this.#renderOptions();
  }

  #buildCategory(category, index) {
    const element = h('section', 'xmb-category');
    element.setAttribute('aria-label', category.label);
    element.dataset.id = category.id;
    element.style.setProperty('--index', index);

    const header = h('header', 'xmb-category__header');
    header.append(
      icon('xmb-category__icon', category.icon),
      h('span', 'xmb-category__label', { textContent: category.label })
    );

    const list = h('ol', 'xmb-category__items xmb-column', { role: 'listbox' });
    const levels = h('div', 'xmb-category__levels');
    element.append(header, list, levels);

    const view = { element, list, levels, items: [] };
    this.#fillItems(view, category.items);
    return view;
  }

  #fillItems(view, items) {
    view.items = items.map(buildItem);
    view.list.replaceChildren(...view.items);
  }

  #rebuildItems(categoryIndex) {
    const view = this.#categories[categoryIndex];
    if (!view) return;
    if (categoryIndex === this.#model.categoryIndex) this.#removeLevels(0);
    this.#fillItems(view, this.#model.categories[categoryIndex].items);
    this.update();
  }

  /** Reconciles the rendered folder columns with the model's level stack. */
  #syncLevels() {
    const levels = this.#model.levels;
    let keep = 0;
    while (
      keep < this.#levels.length &&
      keep < levels.length &&
      this.#levels[keep].owner === levels[keep].owner &&
      this.#levels[keep].items === levels[keep].items
    ) {
      keep++;
    }
    this.#removeLevels(keep);

    const container = this.#categories[this.#model.categoryIndex].levels;
    for (let index = keep; index < levels.length; index++) {
      const { owner, items } = levels[index];
      const element = h('ol', 'xmb-level xmb-column', { role: 'listbox' });
      element.setAttribute('aria-label', owner.label);
      element.style.setProperty('--n', index + 1);
      const entries = items.map(buildItem);
      element.append(...entries);
      if (!entries.length) element.append(h('li', 'xmb-level__empty', { textContent: this.#emptyLabel }));
      container.append(element);
      this.#levels.push({ owner, items, element, entries });
    }

    const last = levels.length - 1;
    this.#levels.forEach((view, index) => {
      view.element.classList.toggle('is-current', index === last);
      view.element.classList.toggle('is-parent', index === last - 1);
      view.element.classList.toggle('is-ancestor', index < last);
      layoutColumn(view.entries, levels[index].index, index === last);
    });
  }

  #removeLevels(from) {
    const removed = this.#levels.splice(from);
    if (!removed.length) return;
    const delay = toMs(getComputedStyle(this.#element).getPropertyValue('--xmb-duration'));
    for (const { element } of removed) {
      element.classList.add('is-leaving');
      setTimeout(() => element.remove(), delay);
    }
  }

  #findItemElement(item) {
    return this.#element?.querySelector(
      `.xmb-column:not(.is-leaving) > .xmb-item[data-id="${CSS.escape(item.id)}"]`
    );
  }

  #setFeatured(item) {
    if (this.#featured) {
      const { element, item: previous } = this.#featured;
      element.classList.remove('is-featured');
      const img = element.querySelector('img.xmb-item__icon');
      if (img && previous.icon) img.src = previous.icon;
      this.#featured = null;
    }

    if (!item?.focusIcon) return;
    const element = this.#findItemElement(item);
    const img = element?.querySelector('img.xmb-item__icon');
    if (!img) return;
    img.src = item.focusIcon;
    element.classList.add('is-featured');
    this.#featured = { element, item };
  }

  #renderOptions() {
    const model = this.#model;
    this.#optionsPanel.setAttribute('aria-hidden', String(!model.optionsOpen));
    if (!model.optionsOpen) return;

    const entries = model.item.options.map((option, index) => {
      const element = h('li', 'xmb-option', { role: 'option', textContent: option.label });
      element.classList.toggle('is-focused', index === model.optionIndex);
      element.classList.toggle('is-selected', Boolean(option.selected));
      element.setAttribute('aria-selected', String(index === model.optionIndex));
      return element;
    });
    this.#optionsList.replaceChildren(...entries);
  }
}
