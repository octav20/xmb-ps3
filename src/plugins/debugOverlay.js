/**
 * Diagnostic bar showing the navigation state. Toggled with `toggleKey`.
 *
 * @param {{element: HTMLElement, toggleKey?: string, visible?: boolean}} options
 */
export function debugOverlay({ element, toggleKey = 't', visible = false }) {
  return (engine) => {
    element.hidden = !visible;

    const render = () => {
      const { categoryIndex, itemIndex, optionIndex, category, item, path } = engine.model.snapshot();
      const rows = [
        ['Category', `${categoryIndex} (${category.id})`],
        ['Path', path.length ? path.map((folder) => folder.label).join(' › ') : '—'],
        ['Item', item ? `${itemIndex} (${item.id})` : '—'],
        ['Option', optionIndex === -1 ? '—' : String(optionIndex)],
      ];
      element.replaceChildren(
        ...rows.map(([label, value]) => {
          const row = document.createElement('p');
          row.textContent = `${label}: ${value}`;
          return row;
        })
      );
    };

    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== toggleKey || event.ctrlKey || event.metaKey) return;
      element.hidden = !element.hidden;
    };

    window.addEventListener('keydown', onKeyDown);
    const offs = [engine.on('change', render), engine.on('start', render)];
    render();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      offs.forEach((off) => off());
    };
  };
}
