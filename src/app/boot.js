const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForStart(button) {
  return new Promise((resolve) => {
    const done = () => {
      button.removeEventListener('click', done);
      window.removeEventListener('keydown', onKeyDown);
      resolve();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      done();
    };
    button.addEventListener('click', done);
    window.addEventListener('keydown', onKeyDown);
    button.focus();
  });
}

/**
 * Start screen → PS3 splash. Resolves once the splash has finished.
 *
 * @param {object} options
 * @param {HTMLElement} options.startScreen
 * @param {HTMLElement} options.startButton
 * @param {HTMLElement} options.splash
 * @param {() => void} [options.onStart] runs right after the user interaction (unlocks audio).
 * @param {number} options.duration
 */
export async function runBootSequence({ startScreen, startButton, splash, onStart, duration }) {
  await waitForStart(startButton);
  onStart?.();

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = reducedMotion ? Math.min(duration, 1500) : duration;

  startScreen.remove();
  splash.style.setProperty('--boot-duration', `${ms}ms`);
  splash.hidden = false;
  splash.classList.add('is-playing');

  await wait(ms);
  splash.remove();
}
