# XMB-PS3

Motor de interfaz inspirado en el XMB (XrossMediaBar) de PlayStation 3: fondo procedural WebGL, navegación por teclado y mando, panel de opciones, reloj y efectos de sonido. El motor es agnóstico al contenido: el menú se define con datos y las funcionalidades extra se añaden como plugins.

## Ejecutar

El proyecto es estático y usa módulos ES (Three.js se carga mediante un import map). Debe servirse por HTTP:

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080/` en un navegador con WebGL 2.

## Controles

| Teclado | Mando (layout estándar) | Acción |
| --- | --- | --- |
| `←` / `→` | D-pad / stick izq. | Cambiar de categoría |
| `↑` / `↓` | D-pad / stick izq. | Cambiar de elemento u opción |
| `Enter` | ✕ | Confirmar: ejecuta `action` o abre las opciones del elemento |
| `O` | △ | Abrir / cerrar el panel de opciones |
| `Esc` / `Backspace` / `←` | ○ | Cerrar el panel de opciones |
| `T` | — | Mostrar / ocultar la barra de diagnóstico |

`Enter` o clic en START inicia la interfaz desde la pantalla de bienvenida.

## Arquitectura

```
src/
  engine/            Núcleo reutilizable, sin dependencias externas
    XmbModel.js      Estado puro de navegación (sin DOM): valida movimientos y emite eventos
    XmbView.js       Renderiza el DOM desde el modelo; solo escribe variables CSS (--xmb-category, --rel)
    XmbEngine.js     Fachada: une modelo, vista y entrada; gestiona plugins y el evento `settle`
    KeyboardInput.js Traduce teclas a acciones (keymap configurable, auto-repeat limitado)
    actions.js       Acciones abstractas (left, right, up, down, confirm, back, options)
    xmb.css          Geometría y estilo del XMB, parametrizados con custom properties
  plugins/           Funcionalidades opcionales, cada una se activa con engine.use(...)
    shaderBackground.js  Fondo Three.js con temas (evento `theme`)
    audio.js             AudioManager + sonidos de navegación y música por elemento
    backdrop.js          Imagen de fondo del elemento enfocado
    clock.js             Reloj de la barra de estado (con segundero)
    gamepad.js           Entrada por mando (Gamepad API)
    debugOverlay.js      Barra de diagnóstico
  app/               Esta aplicación concreta
    config.js        Categorías, elementos, temas, sonidos y tiempos
    boot.js          Pantalla de inicio y splash de arranque
    main.js          Composición: crea el motor, registra plugins y arranca
```

### Definir el contenido

```js
{
  id: 'game',
  label: 'Game',
  icon: 'assets/icons/default.png',
  items: [{
    label: 'The Last of Us',
    description: 'PS3 Game',
    icon: 'assets/icons/ps3-disc-icon.png',
    focusIcon: 'assets/icons/tlou-logo.png',   // se muestra tras `settleDelay`
    backdrop: 'assets/tlou-cover.webp',        // plugin backdrop
    music: 'assets/sound/all-gone.mp4',        // plugin audio
    options: [{ label: 'Start', action: ({ engine, item }) => {} }],
    action: ({ engine, item }) => {},          // si no hay action, Enter abre las opciones
    onSelect: ({ engine, option }) => {},      // opción elegida sin `action` propia
  }],
}
```

El contenido puede cambiarse en tiempo de ejecución con `engine.model.setItems(categoryId, items)`.

### Eventos

`engine.on(type, handler)` devuelve una función para desuscribirse.

- `change`: cualquier cambio de estado (incluye `reason` y el snapshot).
- `focus`: cambió el elemento enfocado.
- `settle`: el elemento sigue enfocado tras `settleDelay` ms (logo, fondo, música).
- `navigate`: cada acción despachada, con `{ action, changed }`.
- `activate` / `select`: confirmación de un elemento o de una opción.
- `start`: el XMB se ha montado.
- Eventos propios mediante `engine.emit()`, p. ej. `theme`.

### Escribir un plugin

```js
const logger = () => (engine) => {
  const off = engine.on('focus', ({ item }) => console.log(item?.label));
  return off; // limpieza al llamar engine.destroy()
};
engine.use(logger());
```

Cualquier otra fuente de entrada (táctil, mando a distancia, WebSocket…) solo necesita llamar a `engine.dispatch(ACTIONS.X)`.

### Personalizar el aspecto

Todas las medidas del XMB son custom properties en `.xmb` (`--xmb-cat-w`, `--xmb-item-h`, `--xmb-row-top`, `--xmb-duration`, …) y se adaptan al viewport con `clamp()`. La posición de cada elemento se deriva de su índice relativo al enfocado (`--rel`), por lo que no se acumulan transformaciones ni se espera a `transitionend`.

El renderizador limita el pixel ratio a 2, usa un único `setAnimationLoop` y reduce la velocidad de la animación con `prefers-reduced-motion`, que también desactiva transiciones y el segundero.
