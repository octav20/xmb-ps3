// Variable para almacenar la referencia al objeto Audio del tema.
let themeAudio = null;

async function playClick() {
  // Para sonidos cortos y efectos, crear una nueva instancia está bien.
  const audio = new Audio('assets/sound/down.ogg');
  // No necesitamos 'await' aquí, ya que el 'click' es un efecto rápido
  // y no queremos que bloquee otras operaciones.
  audio.play();
}

async function playIntro() {
  const audio = new Audio('assets/sound/launch.ogg');
  audio.play();
}

/**
 * Inicia la reproducción del tema principal. Si ya está en pausa, lo reanuda.
 */
async function playTheme() {
  // 1. Si no existe una instancia, la crea.
  if (!themeAudio) {
    themeAudio = new Audio('assets/sound/all-gone.mp4');
    // Opcional: Para temas de fondo, a menudo quieres que se repita (loop).
  }

  // 2. Reproduce el audio (lo reanuda si estaba pausado).
  await themeAudio.play().catch((error) => {
    console.error('Error al intentar reproducir el tema:', error);
    // Nota: El navegador puede requerir interacción del usuario para reproducir audio.
  });
}

/**
 * Pausa el tema principal sin reiniciarlo.
 */
async function stopTheme() {
  if (themeAudio) {
    themeAudio.pause();
    // Opcional: Si quieres reiniciar el tema al principio (detener),
    // podrías añadir: themeAudio.currentTime = 0;
  }
}

export { playClick, playIntro, playTheme, stopTheme };
