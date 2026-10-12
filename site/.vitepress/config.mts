import { defineConfig, type DefaultTheme } from 'vitepress';

/** Pages project path; docs are served under `${base}` (…/docs/). */
const base = process.env.DOCS_BASE || '/jubilant-journey/docs/';
/**
 * Co-deployed demo at the Pages root (sibling of /docs/).
 * Must be an absolute http(s) URL so VitePress treats it as external
 * and does not prefix `base` (which would yield /docs/jubilant-journey/).
 */
const demoUrl =
  process.env.DEMO_URL || 'https://profyt.github.io/jubilant-journey/';

function guideSidebar(prefix: '' | '/ru'): DefaultTheme.SidebarItem[] {
  const p = prefix;
  if (prefix === '/ru') {
    return [
      {
        text: 'С чего начать',
        items: [
          { text: 'Быстрый старт', link: `${p}/guide/getting-started` },
          { text: 'Установка и бандлеры', link: `${p}/guide/bundlers` },
          { text: 'Обзор API', link: `${p}/guide/api` },
        ],
      },
      {
        text: 'Возможности',
        items: [
          { text: 'React-хуки', link: `${p}/guide/react` },
          { text: 'Свой бэкенд (BYO sync)', link: `${p}/guide/sync` },
          { text: 'Несколько вкладок', link: `${p}/guide/multi-tab` },
        ],
      },
      {
        text: 'Справка',
        items: [
          { text: 'Архитектура', link: `${p}/guide/architecture` },
          { text: 'Устранение проблем', link: `${p}/guide/troubleshooting` },
          { text: 'Производительность', link: `${p}/guide/performance` },
        ],
      },
    ];
  }
  return [
    {
      text: 'Start here',
      items: [
        { text: 'Getting started', link: '/guide/getting-started' },
        { text: 'Install & bundlers', link: '/guide/bundlers' },
        { text: 'API overview', link: '/guide/api' },
      ],
    },
    {
      text: 'Features',
      items: [
        { text: 'React hooks', link: '/guide/react' },
        { text: 'Remote / BYO sync', link: '/guide/sync' },
        { text: 'Multi-tab', link: '/guide/multi-tab' },
      ],
    },
    {
      text: 'Reference',
      items: [
        { text: 'Architecture', link: '/guide/architecture' },
        { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        { text: 'Performance notes', link: '/guide/performance' },
      ],
    },
  ];
}

function examplesSidebar(prefix: '' | '/ru'): DefaultTheme.SidebarItem[] {
  if (prefix === '/ru') {
    return [
      {
        text: 'Примеры',
        items: [
          { text: 'TypeScript (vanilla)', link: '/ru/examples/typescript' },
          { text: 'React-хуки', link: '/ru/examples/react' },
          { text: 'Живое демо', link: demoUrl },
        ],
      },
    ];
  }
  return [
    {
      text: 'Examples',
      items: [
        { text: 'TypeScript (vanilla)', link: '/examples/typescript' },
        { text: 'React hooks', link: '/examples/react' },
        { text: 'Live demo app', link: demoUrl },
      ],
    },
  ];
}

function nav(prefix: '' | '/ru'): DefaultTheme.NavItem[] {
  if (prefix === '/ru') {
    return [
      { text: 'Документация', link: '/ru/guide/getting-started' },
      { text: 'Примеры', link: '/ru/examples/typescript' },
      { text: 'Демо', link: demoUrl },
      {
        text: 'npm',
        link: 'https://www.npmjs.com/package/worker-sync-db',
      },
      {
        text: 'GitHub',
        link: 'https://github.com/profyt/jubilant-journey',
      },
    ];
  }
  return [
    { text: 'Docs', link: '/guide/getting-started' },
    { text: 'Examples', link: '/examples/typescript' },
    { text: 'Demo', link: demoUrl },
    {
      text: 'npm',
      link: 'https://www.npmjs.com/package/worker-sync-db',
    },
    {
      text: 'GitHub',
      link: 'https://github.com/profyt/jubilant-journey',
    },
  ];
}

export default defineConfig({
  title: 'worker-sync-db',
  description:
    'Offline-first IndexedDB for web apps — multi-tab live updates and bring-your-own sync.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md'],
  ignoreDeadLinks: [
    // Demo lives at the Pages root, outside this VitePress tree.
    /^https?:\/\/profyt\.github\.io\/jubilant-journey\/?/,
    /^\.\.\/?$/,
    /\/jubilant-journey\/?(?:$|\?|#)/,
  ],

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    ],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap',
        rel: 'stylesheet',
      },
    ],
    ['meta', { name: 'theme-color', content: '#062a2f' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'worker-sync-db',
      description:
        'Offline-first IndexedDB for web apps — multi-tab live updates and bring-your-own sync.',
      themeConfig: {
        siteTitle: 'worker-sync-db',
        nav: nav(''),
        sidebar: {
          '/guide/': guideSidebar(''),
          '/examples/': examplesSidebar(''),
        },
        editLink: {
          pattern:
            'https://github.com/profyt/jubilant-journey/edit/main/site/:path',
          text: 'Edit this page',
        },
        footer: {
          message:
            'MIT License · offline-first IndexedDB with SharedWorker sync',
          copyright: 'Copyright © worker-sync-db contributors',
        },
        outline: {
          label: 'On this page',
          level: [2, 3],
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        lastUpdated: {
          text: 'Updated',
        },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        langMenuLabel: 'Change language',
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      link: '/ru/',
      title: 'worker-sync-db',
      description:
        'Offline-first IndexedDB для веб-приложений — живые обновления во всех вкладках и синхронизация с вашим API.',
      themeConfig: {
        siteTitle: 'worker-sync-db',
        nav: nav('/ru'),
        sidebar: {
          '/ru/guide/': guideSidebar('/ru'),
          '/ru/examples/': examplesSidebar('/ru'),
        },
        editLink: {
          pattern:
            'https://github.com/profyt/jubilant-journey/edit/main/site/:path',
          text: 'Редактировать страницу',
        },
        footer: {
          message:
            'MIT License · offline-first IndexedDB и синхронизация через SharedWorker',
          copyright: '© участники worker-sync-db',
        },
        outline: {
          label: 'На этой странице',
          level: [2, 3],
        },
        docFooter: {
          prev: 'Предыдущая страница',
          next: 'Следующая страница',
        },
        lastUpdated: {
          text: 'Обновлено',
        },
        returnToTopLabel: 'Наверх',
        sidebarMenuLabel: 'Меню',
        darkModeSwitchLabel: 'Оформление',
        lightModeSwitchTitle: 'Светлая тема',
        darkModeSwitchTitle: 'Тёмная тема',
        langMenuLabel: 'Сменить язык',
      },
    },
  },

  themeConfig: {
    logo: false,
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/profyt/jubilant-journey',
      },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/worker-sync-db',
      },
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          ru: {
            translations: {
              button: {
                buttonText: 'Поиск',
                buttonAriaLabel: 'Поиск по документации',
              },
              modal: {
                displayDetails: 'Показать подробности',
                resetButtonTitle: 'Сбросить',
                backButtonTitle: 'Закрыть',
                noResultsText: 'Ничего не найдено',
                footer: {
                  selectText: 'выбрать',
                  navigateText: 'перейти',
                  closeText: 'закрыть',
                },
              },
            },
          },
        },
      },
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
});
