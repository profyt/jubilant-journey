import { defineConfig } from 'vitepress';

/** Pages project path; docs are served under `${base}` (…/docs/). */
const base = process.env.DOCS_BASE || '/jubilant-journey/docs/';
/**
 * Co-deployed demo at the Pages root (sibling of /docs/).
 * Must be an absolute http(s) URL so VitePress treats it as external
 * and does not prefix `base` (which would yield /docs/jubilant-journey/).
 */
const demoUrl =
  process.env.DEMO_URL || 'https://profyt.github.io/jubilant-journey/';

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

  themeConfig: {
    siteTitle: 'worker-sync-db',
    logo: false,
    nav: [
      { text: 'Docs', link: '/guide/getting-started' },
      { text: 'Examples', link: '/examples/typescript' },
      // Absolute URL → treated as external; full navigation to the demo app.
      { text: 'Demo', link: demoUrl },
      {
        text: 'npm',
        link: 'https://www.npmjs.com/package/worker-sync-db',
      },
      {
        text: 'GitHub',
        link: 'https://github.com/profyt/jubilant-journey',
      },
    ],

    sidebar: {
      '/guide/': [
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
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'TypeScript (vanilla)', link: '/examples/typescript' },
            { text: 'React hooks', link: '/examples/react' },
            { text: 'Live demo app', link: demoUrl },
          ],
        },
      ],
    },

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
    },

    editLink: {
      pattern:
        'https://github.com/profyt/jubilant-journey/edit/main/site/:path',
      text: 'Edit this page',
    },

    footer: {
      message: 'MIT License · offline-first IndexedDB with SharedWorker sync',
      copyright: 'Copyright © worker-sync-db contributors',
    },

    outline: {
      level: [2, 3],
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
});
