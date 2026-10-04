/**
 * Shows the `backdrop` image of the settled item on a full-screen element and
 * hides it as soon as the focus moves.
 *
 * @param {{element: HTMLElement}} options
 */
export function backdrop({ element }) {
  return (engine) => {
    const hide = () => element.classList.remove('is-visible');
    const show = ({ item }) => {
      if (!item.backdrop) return;
      element.style.backgroundImage = `url("${encodeURI(item.backdrop)}")`;
      element.classList.add('is-visible');
    };

    const offs = [engine.on('focus', hide), engine.on('settle', show)];
    return () => {
      offs.forEach((off) => off());
      hide();
    };
  };
}
