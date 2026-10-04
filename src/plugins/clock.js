const CLOCK_SVG = `
  <svg class="clock" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="clock__face" cx="50" cy="50" r="45" />
    <line class="clock__hand clock__hand--hour" x1="50" y1="50" x2="50" y2="22" />
    <line class="clock__hand clock__hand--minute" x1="50" y1="50" x2="50" y2="12" />
    <line class="clock__hand clock__hand--second" x1="50" y1="56" x2="50" y2="10" />
    <circle class="clock__center" cx="50" cy="50" r="2.5" />
  </svg>
`;

/**
 * Status-bar clock (date, time and analog hands), updated every second and
 * aligned to the wall clock.
 *
 * @param {object} options
 * @param {HTMLElement} options.element
 * @param {string} [options.locale]
 * @param {Intl.DateTimeFormatOptions} [options.dateFormat]
 * @param {Intl.DateTimeFormatOptions} [options.timeFormat]
 */
export function clock({
  element,
  locale = 'en-US',
  dateFormat = { month: '2-digit', day: '2-digit' },
  timeFormat = { hour: 'numeric', minute: '2-digit' },
}) {
  return () => {
    element.innerHTML = `<time class="clock__text"></time>${CLOCK_SVG}`;
    const text = element.querySelector('.clock__text');
    const [hour, minute, second] = ['hour', 'minute', 'second'].map((unit) =>
      element.querySelector(`.clock__hand--${unit}`)
    );
    const date = new Intl.DateTimeFormat(locale, dateFormat);
    const time = new Intl.DateTimeFormat(locale, timeFormat);
    let timer = 0;

    const rotate = (hand, degrees) => hand.setAttribute('transform', `rotate(${degrees} 50 50)`);

    const tick = () => {
      const now = new Date();
      const s = now.getSeconds();
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      rotate(hour, h * 30);
      rotate(minute, m * 6);
      rotate(second, s * 6);
      text.textContent = `${date.format(now)} ${time.format(now)}`;
      text.dateTime = now.toISOString();

      timer = setTimeout(tick, 1000 - now.getMilliseconds());
    };

    tick();
    return () => {
      clearTimeout(timer);
      element.replaceChildren();
    };
  };
}
