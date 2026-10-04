/**
 * DOM renderer for the XMB. It builds the markup from the model and maps the
 * navigation state to CSS custom properties; all geometry lives in `xmb.css`,
 * so positions are recomputed by the browser on resize and never accumulate.
 */

function h(tag, className, props = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return Object.assign(element, props);
}

function icon(className, src) {
  return src ? h('img', className, { src, alt: '', decoding: 'async', draggable: false }) : h('span', className);
}

export class XmbView {
  #model;
  #root;
  #element = null;
  #track = null;
  #optionsPanel = null;
  #optionsList = null;
  #categories = [];
  #subscriptions = [];
  #featured = null;

  /**
   * @param {HTMLElement} root
   * @param {import('./XmbModel.js').XmbModel} model
   */
  constructor(root, model) {
    if (!root) throw new Error('XMB: a root element is required');
    this.#root = root;
    this.#model = model;
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
  }

  update() {
    if (!this.#element) return;
    const model = this.#model;

    this.#element.style.setProperty('--xmb-category', model.categoryIndex);
    this.#element.classList.toggle('has-options', model.optionsOpen);

    this.#categories.forEach((view, categoryIndex) => {
      const active = categoryIndex === model.categoryIndex;
      const focused = model.itemIndexOf(categoryIndex);
      view.element.classList.toggle('is-active', active);

      view.items.forEach((element, itemIndex) => {
        const rel = itemIndex - focused;
        element.style.setProperty('--rel', rel);
        element.style.setProperty('--depth', Math.abs(rel));
        element.classList.toggle('is-before', rel < 0);
        element.classList.toggle('is-focused', rel === 0);
        element.classList.toggle('is-after', rel > 0);
        element.setAttribute('aria-selected', String(active && rel === 0));
      });
    });

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

    const list = h('ol', 'xmb-category__items', { role: 'listbox' });
    element.append(header, list);

    const view = { element, list, items: [] };
    this.#fillItems(view, category.items);
    return view;
  }

  #fillItems(view, items) {
    view.items = items.map((item) => {
      const element = h('li', 'xmb-item', { role: 'option' });
      element.dataset.id = item.id;

      const text = h('div', 'xmb-item__text');
      text.append(h('span', 'xmb-item__label', { textContent: item.label }));
      if (item.description) {
        text.append(h('span', 'xmb-item__description', { textContent: item.description }));
      }

      element.append(icon('xmb-item__icon', item.icon), text);
      return element;
    });
    view.list.replaceChildren(...view.items);
  }

  #rebuildItems(categoryIndex) {
    const view = this.#categories[categoryIndex];
    if (!view) return;
    this.#fillItems(view, this.#model.categories[categoryIndex].items);
    this.update();
  }

  #findItemElement(item) {
    return this.#element?.querySelector(`.xmb-item[data-id="${CSS.escape(item.id)}"]`);
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
