import { defineConfig } from 'vitepress';

const base = process.env.DOCS_BASE || '/jubilant-journey/';

export default defineConfig({
  title: 'worker-sync-db',
  description:
    'Offline-first IndexedDB for web apps — multi-tab live updates and bring-your-own sync.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [
    // Demo is co-deployed under /demo/ by the Pages workflow; not part of VitePress outDir.
    /\/demo(?:\/|$)/,
    /\/demo\/.*\.html$/,
  ],

  head: [
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    ],
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
      // Site-relative; VitePress prefixes `base` once → /jubilant-journey/demo/
      { text: 'Demo', link: '/demo/' },
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
            { text: 'Live demo app', link: '/demo/' },
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
