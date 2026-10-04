/**
 * Content and behaviour of this particular XMB. The engine is generic: replace
 * this file (or load it from an API) to build a different menu.
 */

const ICONS = 'assets/icons';

export const themes = {
  red: {
    label: 'Red',
    bottomLeft: [0.7, 0.2, 0.2],
    bottomRight: [0.4, 0.1, 0.1],
    topLeft: [0.45, 0.1, 0.1],
    topRight: [0.8, 0.3, 0.5],
  },
  blue: {
    label: 'Blue',
    bottomLeft: [0.15, 0.3, 0.7],
    bottomRight: [0.08, 0.12, 0.4],
    topLeft: [0.1, 0.15, 0.45],
    topRight: [0.35, 0.4, 0.85],
  },
  green: {
    label: 'Green',
    bottomLeft: [0.2, 0.55, 0.25],
    bottomRight: [0.08, 0.3, 0.12],
    topLeft: [0.1, 0.32, 0.14],
    topRight: [0.35, 0.7, 0.4],
  },
  purple: {
    label: 'Purple',
    bottomLeft: [0.5, 0.2, 0.7],
    bottomRight: [0.25, 0.08, 0.4],
    topLeft: [0.28, 0.1, 0.45],
    topRight: [0.7, 0.35, 0.85],
  },
  black: {
    label: 'Black',
    bottomLeft: [0.15, 0.15, 0.18],
    bottomRight: [0.05, 0.05, 0.07],
    topLeft: [0.08, 0.08, 0.1],
    topRight: [0.25, 0.25, 0.3],
  },
};

export const defaultTheme = 'red';

const placeholders = (count, icon) =>
  Array.from({ length: count }, (_, index) => ({ label: `Item ${index + 1}`, icon }));

export const categories = [
  {
    id: 'home',
    label: 'Home',
    icon: `${ICONS}/menu_quickmenu.png`,
    items: placeholders(8, `${ICONS}/menu_quickmenu.png`),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: `${ICONS}/setting.png`,
    items: [
      {
        id: 'theme-settings',
        label: 'Theme Settings',
        icon: `${ICONS}/change-theme.png`,
        items: [
          {
            id: 'theme-color',
            label: 'Color',
            description: 'Change the background color',
            icon: `${ICONS}/change-theme.png`,
            options: Object.entries(themes).map(([value, theme]) => ({
              label: theme.label,
              value,
              selected: value === defaultTheme,
            })),
            onSelect: ({ engine, option }) => engine.emit('theme', option.value),
          },
        ],
      },
      {
        id: 'system-settings',
        label: 'System Settings',
        icon: `${ICONS}/setting.png`,
        items: [
          {
            id: 'language',
            label: 'Language',
            icon: `${ICONS}/setting.png`,
            options: [{ label: 'English', selected: true }, { label: 'Español' }],
          },
          {
            id: 'date-time-settings',
            label: 'Date and Time Settings',
            icon: `${ICONS}/setting.png`,
            items: [
              {
                id: 'time-format',
                label: 'Time Format',
                icon: `${ICONS}/setting.png`,
                options: [
                  { label: '12-Hour Clock', value: true, selected: true },
                  { label: '24-Hour Clock', value: false },
                ],
                onSelect: ({ engine, option }) => engine.emit('clock', { time: { hour12: option.value } }),
              },
            ],
          },
        ],
      },
      { id: 'users', label: 'Users', icon: `${ICONS}/menu_user.png` },
      {
        id: 'restart',
        label: 'Restart System',
        icon: `${ICONS}/menu_shutdown.png`,
        action: () => window.location.reload(),
      },
    ],
  },
  {
    id: 'photo',
    label: 'Photo',
    icon: `${ICONS}/screenshot.png`,
    items: [{ label: 'Screenshots', icon: `${ICONS}/screenshot.png` }],
  },
  {
    id: 'music',
    label: 'Music',
    icon: `${ICONS}/music.png`,
    items: [
      {
        label: 'Playlists',
        icon: `${ICONS}/music.png`,
        items: [{ label: 'All Gone', description: 'The Last of Us', icon: `${ICONS}/music.png` }],
      },
      { label: 'Downloads', icon: `${ICONS}/music.png`, items: [] },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    icon: `${ICONS}/movie.png`,
    items: [
      {
        label: 'Library',
        description: 'Loaded on demand',
        icon: `${ICONS}/movie.png`,
        // Folders can be loaded lazily (e.g. from an API); a Promise is supported.
        items: () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve(['Trailer', 'Gameplay', 'Credits'].map((label) => ({ label, icon: `${ICONS}/movie.png` }))),
              600
            )
          ),
      },
    ],
  },
  {
    id: 'game',
    label: 'Game',
    icon: `${ICONS}/default.png`,
    items: [
      {
        id: 'tlou',
        label: 'The Last of Us',
        description: 'PS3 Game',
        icon: `${ICONS}/ps3-disc-icon.png`,
        focusIcon: `${ICONS}/tlou-logo.png`,
        backdrop: 'assets/tlou-cover.webp',
        music: 'assets/sound/all-gone.mp4',
      },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: `${ICONS}/wifi.png`,
    items: [{ label: 'Internet Connection', icon: `${ICONS}/wifi.png` }],
  },
  {
    id: 'friends',
    label: 'Friends',
    icon: `${ICONS}/user.png`,
  },
];

export const sounds = {
  boot: 'assets/sound/launch.ogg',
  navigate: 'assets/sound/down.ogg',
};

export const timing = {
  bootDuration: 10000,
  settleDelay: 1000,
};
