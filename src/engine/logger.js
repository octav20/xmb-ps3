const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

let threshold = LEVELS.warn;

export function setLogLevel(level) {
  threshold = LEVELS[level] ?? threshold;
}

function write(level, scope, args) {
  if (LEVELS[level] < threshold) return;
  const method = level === 'debug' ? 'log' : level;
  console[method](`[xmb:${scope}]`, ...args);
}

/**
 * @param {string} scope
 */
export function createLogger(scope) {
  return {
    debug: (...args) => write('debug', scope, args),
    info: (...args) => write('info', scope, args),
    warn: (...args) => write('warn', scope, args),
    error: (...args) => write('error', scope, args),
  };
}
