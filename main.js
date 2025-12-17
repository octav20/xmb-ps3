import { log, LOG_TYPE } from './logger.js';
import * as Sfx from './sfx.js';
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const DIRECTION = {
  Left: -1,
  Right: 1,
  Up: 1,
  Down: -1,
};

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('bg'),
  powerPreference: 'low-power',
  precision: 'medium',
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const geometry = new THREE.PlaneGeometry(2, 2);
const vertexShader = `
    varying vec2 vUv;

    void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `;

const fragmentShader = `
    precision mediump float;

    uniform vec2 iResolution;
    uniform float iTime;

    varying vec2 vUv;

    #define THRESHOLD .99
    #define DUST
    #define MIN_DIST .13
    #define MAX_DIST 40.
    #define MAX_DRAWS 40

    float hash12(vec2 p)
    {
    uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673U, 3812015801U);
    uint n = (q.x ^ q.y) * 1597334673U;
    return float(n) * 2.328306437080797e-10;
    }

    float value2d(vec2 p);

    float get_stars_rough(vec2 p)
    {
    float s = smoothstep(THRESHOLD,1.,hash12(p));
    if (s >= THRESHOLD)
    s = pow((s-THRESHOLD) / (1.-THRESHOLD), 10.);
    return s;
    }

    float get_stars(vec2 p, float a, float t)
    {
    vec2 pg=floor(p), pc=p-pg, k=vec2(0,1);
    pc *= pc*pc*(3.-2.*pc);

    float s = mix(
    mix(get_stars_rough(pg+k.xx), get_stars_rough(pg+k.yx), pc.x),
    mix(get_stars_rough(pg+k.xy), get_stars_rough(pg+k.yy), pc.x),
    pc.y
    );
    return smoothstep(a,a+t, s)*pow(value2d(p*.1 + iTime)*.5+.5,8.3);
    }

    float value2d(vec2 p)
    {
    vec2 pg=floor(p),pc=p-pg,k=vec2(0,1);
    pc*=pc*pc*(3.-2.*pc);
    return mix(
    mix(hash12(pg+k.xx),hash12(pg+k.yx),pc.x),
    mix(hash12(pg+k.xy),hash12(pg+k.yy),pc.x),
    pc.y
    );
    }

    float s5(float x) {return .5+.5*sin(x);}
    float c5(float x) {return .5+.5*cos(x);}

    float get_dust(vec2 p, vec2 size, float f)
    {
    vec2 ar = vec2(iResolution.x/iResolution.y,1);
    vec2 pp=p*size*ar;
    return
    pow(.64+.46*cos(p.x*6.28), 1.7) *
    (
    get_stars(.1*pp+iTime*vec2(20.,-10.1),.11,.71)*4. +
    get_stars(.2*pp+iTime*vec2(30.,-10.1),.1,.31)*5. +
    get_stars(.32*pp+iTime*vec2(40.,-10.1),.1,.91)*2.
    ) * f;
    }

    float sdf(vec3 p)
    {
    p*=2.;
    float o =
    4.2*sin(.05*p.x+iTime*.25)+
    (.04*p.z)*
    sin(p.x*.11+iTime)*
    2.*sin(p.z*.2+iTime)*
    value2d(vec2(.03,.4)*p.xz+vec2(iTime*.5,0));
    return abs(dot(p,normalize(vec3(0,1,0.05)))+2.5+o*.5);
    }

    vec3 norm(vec3 p)
    {
    const vec2 k=vec2(1,-1);
    const float t=.001;
    return normalize(
    k.xyy*sdf(p+t*k.xyy) +
    k.yyx*sdf(p+t*k.yyx) +
    k.yxy*sdf(p+t*k.yxy) +
    k.xxx*sdf(p+t*k.xxx)
    );
    }

    vec2 raymarch(vec3 o, vec3 d, float omega)
    {
    float t =0., a =0.;
    float g =MAX_DIST, dt=0., sl=0., emin=0.03, ed=emin;
    int dr=0;
    bool hit=false;

    for (int i=0;i<100;i++) { vec3 p=o+d*t; float ndt=sdf(p); if (abs(dt)+abs(ndt) < sl) { sl -=omega*sl; omega=1.; }
        else sl=ndt*omega; dt=ndt; t+=sl; g=(t> 10.) ? min(g,abs(dt)) : MAX_DIST;

        if ((t+=dt)>=MAX_DIST) break;

        if (dt<MIN_DIST) { if(dr> MAX_DRAWS) break;
            dr++;

            float f = smoothstep(0.09, 0.11, (p.z*.9)/100.);
            if (!hit) {
            a=.01;
            hit=true;
            }

            ed=2.*max(emin,abs(ndt));
            a += .0135*f;
            t += ed;
            }
            }

            g /= 3.;
            return vec2(a, max(1.-g, 0.));
            }

            void main()
            {
            vec2 uv = vUv;

            vec3 o=vec3(0), d=(vec3(
            (uv*iResolution.xy - 0.5*iResolution.xy)/iResolution.y, 1.
            ));

            vec2 mg = raymarch(o,d,1.2);
            float m = mg.x;

            vec3 c = mix(
            mix(vec3(.7,.2,.2),vec3(.4,.1,.1),uv.x),
            mix(vec3(.45,.1,.1),vec3(.8,.3,.5),uv.x),
            uv.y
            );

            c = mix(c, vec3(1.), m);

            #ifdef DUST
            c += get_dust(uv, vec2(2000.), mg.y)*.3;
            #endif

            gl_FragColor = vec4(c,1.0);
            }
            `;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    iResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    iTime: { value: 0 },
  },
});

let animationId;
function animate(t) {
  material.uniforms.iTime.value = t * 0.001;
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
}
animate();

scene.add(new THREE.Mesh(geometry, material));

renderer.setAnimationLoop(() => renderer.render(scene, camera));
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.iResolution.value.x = window.innerWidth;
  material.uniforms.iResolution.value.y = window.innerHeight;
});

const HORIZONTAL_MOVEMENT_AMOUNT = 170;
const VERTICAL_MOVEMENT_AMOUNT = 130;
const VERTICAL_MOVEMENT_OFFSET = 130;
const NO_SUB_MENU_ITEM_COUNT = -1;

let isTransitioningHorizontally = false;
let isTransitioningVertically = false;
let isStatusBarVisible = false;
let activeMenuItemIndex = 0;
const menuItemsData = [];

/**
 * Builds menu items data.
 * It is used to keep track of menu items and sub menu items
 */
function buildMenuItemsData() {
  // Get all menu items
  const menuItems = document.querySelectorAll('.menu-item');

  menuItems.forEach((menuItem, index) => {
    // Get sub menu item count
    // First get sub menu items container
    const subMenuItemContainer = menuItem.querySelector(
      '.sub-menu-item-container'
    );
    let subMenuItemCount = subMenuItemContainer
      ? subMenuItemContainer.children.length
      : NO_SUB_MENU_ITEM_COUNT;

    // Get menu item index
    const menuItemIndex = index;
    // By default active sub menu item index is 0
    // This is used to keep track of active sub menu item index
    const activeSubMenuItemIndex = 0;

    menuItemsData.push({
      subMenuItemCount,
      menuItemIndex,
      activeSubMenuItemIndex,
      subMenuItemContainer,
    });
  });
}

/**
 * Adds event listener to the body
 * All interactions are handled here
 */
function addBodyListener() {
  document.body.addEventListener('keydown', async (event) => {
    let direction;
    if (event.key === 's') {
    }
    if (event.key === 'ArrowLeft') {
      direction = DIRECTION.Left;
      await moveMenuItemsHorizontally(direction);
    } else if (event.key === 'ArrowRight') {
      direction = DIRECTION.Right;
      await moveMenuItemsHorizontally(direction);
    } else if (event.key === 'ArrowUp') {
      direction = DIRECTION.Up;
      await moveSubMenuItemsVertically(direction);
    } else if (event.key === 'ArrowDown') {
      direction = DIRECTION.Down;
      await moveSubMenuItemsVertically(direction);
    }

    if (event.key === 't') {
      toggleStatusBar();
    }

    updateStatusBar();
  });
}

/**
 * Mueve los elementos del menú horizontalmente en la dirección especificada.
 *
 * @param {number} direction - La dirección del movimiento (e.g., DIRECTION.Right para 1, DIRECTION.Left para -1).
 */
async function moveMenuItemsHorizontally(direction) {
  // 1. **Guard Clause: Verificación de movimiento y transición**

  const canMoveRight =
    direction === DIRECTION.Right &&
    activeMenuItemIndex < menuItemsData.length - 1;
  const canMoveLeft = direction === DIRECTION.Left && activeMenuItemIndex > 0;

  if (!canMoveRight && !canMoveLeft) {
    log(
      LOG_TYPE.WARNING,
      'No se puede mover horizontalmente en esta dirección.'
    );
    return;
  }

  if (isTransitioningHorizontally) {
    log(LOG_TYPE.WARNING, 'Transición en curso, esperando...');
    return;
  }

  // 2. **Inicio de la transición y actualización del estado**
  isTransitioningHorizontally = true;

  // Actualiza el índice del elemento activo
  changeActiveMenuItemIndex(direction);

  // Actualiza el estilo del elemento activo (énfasis/foco)
  updateStyleActiveMenuItem();

  // 3. **Manejo de UI/SFX específico del estado (separación de preocupaciones)**
  await Sfx.playClick();
  updateBackgroundAndMusic(activeMenuItemIndex);

  // 4. **Movimiento visual de los elementos del menú**
  const menuItems = document.querySelectorAll('.menu-item');
  const movementDistance = HORIZONTAL_MOVEMENT_AMOUNT * -direction; // Distancia de movimiento única

  menuItems.forEach((menuItem) => {
    // Es más limpio y eficiente usar `movementDistance` directamente
    const currentTranslateX = getTranslateX(menuItem);
    menuItem.style.transform = `translateX(${
      currentTranslateX + movementDistance
    }px)`;
  });

  // 5. **Finalización de la transición**
  await waitForAllTransitions(menuItems);

  isTransitioningHorizontally = false;
}

/**
 * Función auxiliar para manejar la lógica de la cubierta de fondo y la música.
 * Esto separa la lógica de UI/SFX de la lógica principal del movimiento.
 * @param {number} index - El índice actual del elemento de menú activo.
 */
function updateBackgroundAndMusic(index) {
  const bgCover = document.querySelector('#bg-cover');
  const gameIcon = document.querySelector('.game.sub-menu-item-icon');

  if (index === 5) {
    setTimeout(() => {
      // Lógica para el elemento de menú especial (índice 5)
      if (bgCover) {
        bgCover.style.display = 'block';
        bgCover.classList.add('bg-cover-fade-in');
      }
      // Asume que gameIcon existe
      if (gameIcon) {
        gameIcon.style.width = 'auto';
        gameIcon.style.marginRight = '3rem';
        gameIcon.style.paddingLeft = '3rem';
        gameIcon.src = 'assets/icons/tlou-logo.png';
      }
      Sfx.playTheme();
    }, 1000);
  } else {
    // Lógica para todos los demás elementos de menú
    Sfx.stopTheme();
    if (bgCover) {
      bgCover.classList.remove('bg-cover-fade-in');
      bgCover.style.display = 'none';
    }
    if (gameIcon) {
      gameIcon.style.width = '100px';
      gameIcon.style.marginRight = '0';
      gameIcon.style.paddingLeft = '0';
      gameIcon.src = 'assets/icons/ps3-disc-icon.png';
    }
  }
}

async function moveSubMenuItemsVertically(direction) {
  const activeMenuItem = menuItemsData.find(
    (item) => item.menuItemIndex === activeMenuItemIndex
  );
  const subMenuItemsCount = activeMenuItem.subMenuItemCount;
  const activeSubMenuItemIndex = activeMenuItem.activeSubMenuItemIndex;

  //Check if menu item has sub menu items
  if (!activeMenuItem.subMenuItemCount === NO_SUB_MENU_ITEM_COUNT) {
    log(LOG_TYPE.WARNING, 'No sub menu items');

    return;
  }

  if (
    !(
      (direction === DIRECTION.Down &&
        activeSubMenuItemIndex < subMenuItemsCount - 1) ||
      (direction === DIRECTION.Up && activeSubMenuItemIndex > 0)
    )
  ) {
    log(LOG_TYPE.WARNING, 'Can not move vertically');

    return;
  }

  if (isTransitioningVertically) {
    log(LOG_TYPE.WARNING, 'Transitioning');

    return;
  }

  //Start transitioning
  isTransitioningVertically = true;

  changeActiveSubMenuItemIndex(direction);
  updateActiveSubMenuItemStyle();

  await Sfx.playClick();

  //Get selected menu item's children (sub menu items)
  const subMenuItems = Array.from(activeMenuItem.subMenuItemContainer.children);
  subMenuItems.forEach((selectionItem, index) => {
    const currentTranslateY = getTranslateY(selectionItem);
    let applyOffsetIndex;
    if (direction === DIRECTION.Down) {
      applyOffsetIndex = activeSubMenuItemIndex;
    } else if (direction === DIRECTION.Up) {
      applyOffsetIndex = activeSubMenuItemIndex - 1;
    }
    const applyOffset = index === applyOffsetIndex;
    let transformAmount = applyOffset
      ? currentTranslateY +
        (VERTICAL_MOVEMENT_AMOUNT + VERTICAL_MOVEMENT_OFFSET) * direction
      : currentTranslateY + VERTICAL_MOVEMENT_AMOUNT * direction;
    selectionItem.style.transform = `translateY(${transformAmount}px)`;
  });

  // Wait for the transition to complete
  await waitForAllTransitions(subMenuItems);

  //End transitioning
  isTransitioningVertically = false;
}

/**
 *
 * @param {Element} element
 * @returns x coordinate of the element
 */
function getTranslateX(element) {
  const style = window.getComputedStyle(element);
  const matrix = new WebKitCSSMatrix(style.transform);
  return matrix.m41;
}

/**
 *
 * @param {Element} element
 * @returns y coordinate of the element
 */
function getTranslateY(element) {
  const style = window.getComputedStyle(element);
  const matrix = new WebKitCSSMatrix(style.transform);
  return matrix.m42;
}

function changeActiveMenuItemIndex(direction) {
  if (direction === 1 && activeMenuItemIndex < menuItemsData.length - 1) {
    activeMenuItemIndex++;
  } else if (direction === -1 && activeMenuItemIndex > 0) {
    activeMenuItemIndex--;
  }
}

function changeActiveSubMenuItemIndex(direction) {
  //Get active sub menu item index
  const activeMenuItem = menuItemsData.find(
    (item) => item.menuItemIndex === activeMenuItemIndex
  );

  if (direction === DIRECTION.Down) {
    activeMenuItem.activeSubMenuItemIndex++;
  } else if (direction === DIRECTION.Up) {
    activeMenuItem.activeSubMenuItemIndex--;
  }
}

function updateStatusBar() {
  //Update active menu item index display
  const activeMenuItemIndexDisplay = document.querySelector(
    '#active-menu-item-index-display'
  );
  activeMenuItemIndexDisplay.innerHTML = activeMenuItemIndex;

  //Update active sub menu item index display
  const activeSubMenuItemIndexDisplayElement = document.querySelector(
    '#active-sub-menu-item-index-display'
  );
  const activeMenuItem = getActiveMenuItem();
  activeSubMenuItemIndexDisplayElement.innerHTML =
    activeMenuItem.activeSubMenuItemIndex;
}

function updateStyleActiveMenuItem() {
  const menuItems = document.querySelectorAll('.menu-item');

  // remove active class from all menu items
  menuItems.forEach((menuItem) => {
    menuItem.classList.remove('active-menu-item');
  });

  // add active class to the active menu item
  menuItems[activeMenuItemIndex].classList.add('active-menu-item');
}

function updateActiveSubMenuItemStyle() {
  //Get active menu item
  const activeMenuItem = getActiveMenuItem();
  if (activeMenuItem.subMenuItemCount === NO_SUB_MENU_ITEM_COUNT) {
    log(LOG_TYPE.WARNING, 'No sub menu items');

    return;
  }

  //Get all sub menu items
  const subMenuItems = Array.from(activeMenuItem.subMenuItemContainer.children);

  //Remove active class from all menu items
  subMenuItems.forEach((subMenuItem) => {
    subMenuItem.classList.remove('active-sub-menu-item');
  });

  //Add active class to the active menu item
  subMenuItems[activeMenuItem.activeSubMenuItemIndex].classList.add(
    'active-sub-menu-item'
  );
}

function toggleStatusBar() {
  isStatusBarVisible = !isStatusBarVisible;
  const statusBar = document.querySelector('.status-bar');
  statusBar.style.display = isStatusBarVisible ? 'block' : 'none';
}

function getActiveMenuItem() {
  return menuItemsData.find(
    (item) => item.menuItemIndex === activeMenuItemIndex
  );
}

/**
 * waits for all transitions to complete
 * !IMPORTANT!: If all transitions are not awaited,
 * this causes some elements not position correctly.
 * Very crucial function for the transitions.
 * @param {any[]} elements
 */
function waitForAllTransitions(elements) {
  return new Promise((resolve) => {
    let completedTransitions = 0;
    const totalTransitions = elements.length;

    const onTransitionEnd = (event) => {
      completedTransitions++;
      if (completedTransitions === totalTransitions) {
        elements.forEach((el) =>
          el.removeEventListener('transitionend', onTransitionEnd)
        );
        resolve();
      }
    };

    elements.forEach((element) => {
      element.addEventListener('transitionend', onTransitionEnd);
    });
  });
}

/**
 * Setup active menu item at startup
 */
function setupActiveMenuItem() {
  const activeMenuItem = document.querySelector('.menu-item');
  activeMenuItem.classList.add('active-menu-item');
}

/**
 * Setup active sub menu items at startup
 */
function setupActiveSubMenuItems() {
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach((menuItem) => {
    const subMenuItemContainer = menuItem.querySelector(
      '.sub-menu-item-container'
    );
    //Check if menu item has sub menu items
    if (!subMenuItemContainer || subMenuItemContainer.children.length === 0) {
      return;
    }
    const firstSubMenuItem = subMenuItemContainer.children[0];
    firstSubMenuItem.classList.add('active-sub-menu-item');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const startButton = document.getElementById('start-button');
  const ps3Logo = document.getElementById('ps3-logo1');

  const overlay = document.getElementById('page-overlay');

  if (startButton && overlay) {
    // 1. Añadir el escuchador de eventos al botón
    startButton.addEventListener('click', function () {
      Sfx.playIntro();
      // 2. INICIAR LA ANIMACIÓN: Agrega la clase 'fade-out'
      overlay.classList.add('fade-out');
      ps3Logo.classList.add('slidefromleft');

      // Opcional: Ocultar el botón y el texto de bienvenida
      document.getElementById('start-screen').style.display = 'none';

      setTimeout(() => {
        overlay.remove();
        document.querySelector('.main-container').style.display = 'flex';
        document.querySelector('.main-container').classList.add('fade-in');

        document.querySelector('.ps3-status-bar').style.display = 'flex';
        document.querySelector('.ps3-status-bar').classList.add('fade-in');
        buildMenuItemsData();
        addBodyListener();
        setupActiveMenuItem();
        setupActiveSubMenuItems();
        function updateClock() {
          const now = new Date();

          const hours = now.getHours() % 12;
          const minutes = now.getMinutes();
          const seconds = now.getSeconds();

          const hourDeg = (hours + minutes / 60 + seconds / 3600) * 30;

          const minuteDeg = (minutes + seconds / 60) * 6;

          document
            .getElementById('hourHand')
            .setAttribute('transform', `rotate(${hourDeg} 50 50)`);

          document
            .getElementById('minuteHand')
            .setAttribute('transform', `rotate(${minuteDeg} 50 50)`);

          // Texto tipo "12/12 9:39 PM"
          document.getElementById('timeText').textContent =
            now.toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
            }) +
            ' ' +
            now.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });
        }

        updateClock();
        setInterval(updateClock, 60000);
      }, 900);
    });
  } else {
    console.error('No se encontró el botón de inicio o el overlay.');
  }
});
