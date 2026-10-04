/**
 * Minimal synchronous event emitter shared by the engine and its plugins.
 */
export class Emitter {
  #handlers = new Map();

  /**
   * @param {string} type
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(type, handler) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.#handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    for (const handler of [...(this.#handlers.get(type) ?? [])]) handler(payload);
  }
}
