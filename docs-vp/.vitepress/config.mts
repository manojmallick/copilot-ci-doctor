import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitepress'

// Base path and canonical host come from the environment so the same config works
// locally (base '/') and on the GitHub Pages project site (base '/copilot-ci-doctor/').
const base = process.env.DOCS_BASE ?? '/'
const HOSTNAME = process.env.DOCS_HOSTNAME ?? 'https://manojmallick.github.io/copilot-ci-doctor'
const REPO = 'https://github.com/manojmallick/copilot-ci-doctor'
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

const TAGLINE = 'From red CI to a green pull request, with evidence, confidence scores and safe fixes.'

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'copilot-ci-doctor',
  titleTemplate: ':title · copilot-ci-doctor',
  description: `${TAGLINE} A CLI that diagnoses failing GitHub Actions runs with GitHub Copilot CLI.`,

  appearance: 'dark',
  cleanUrls: true,
  lastUpdated: true,

  sitemap: {
    hostname: HOSTNAME.endsWith('/') ? HOSTNAME : HOSTNAME + '/',
    transformItems: (items) => items.map((item) => ({ ...item, url: item.url.replace(/^\//, '') })),
  },

  head: [
    ['meta', { name: 'author', content: 'Manoj Mallick' }],
    ['meta', { name: 'keywords', content: 'github actions, ci failure, github copilot cli, ci debugging, root cause analysis, devops, cli' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'copilot-ci-doctor' }],
    ['meta', { property: 'og:title', content: 'copilot-ci-doctor: diagnose and fix failing GitHub Actions runs' }],
    ['meta', { property: 'og:description', content: TAGLINE }],
    ['meta', { property: 'og:url', content: HOSTNAME + '/' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['link', { rel: 'canonical', href: HOSTNAME + '/' }],
  ],

  themeConfig: {
    siteTitle: 'copilot-ci-doctor',

    nav: [
      { text: 'Docs', link: '/guide/commands', activeMatch: '/guide/' },
      {
        text: `v${pkg.version}`,
        items: [
          { text: 'Changelog', link: `${REPO}/blob/main/CHANGELOG.md` },
          { text: 'npm', link: 'https://www.npmjs.com/package/copilot-ci-doctor' },
        ],
      },
      { text: 'GitHub', link: REPO },
    ],

    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Documentation index', link: '/guide/' },
          { text: 'Commands', link: '/guide/commands' },
          { text: 'Worked examples', link: '/guide/examples' },
          { text: 'Configuration', link: '/guide/configuration' },
        ],
      },
      {
        text: 'In CI',
        items: [{ text: 'GitHub Action (experimental)', link: '/guide/github-action' }],
      },
      {
        text: 'Understand',
        items: [
          { text: 'How it works', link: '/guide/how-it-works' },
          { text: 'Safety and privacy', link: '/guide/safety-and-privacy' },
        ],
      },
      {
        text: 'Help',
        items: [{ text: 'Troubleshooting', link: '/guide/troubleshooting' }],
      },
      {
        text: 'Project',
        items: [
          { text: 'Releasing', link: '/guide/RELEASING' },
          { text: 'Hackathon notes', link: '/guide/HACKATHON' },
          { text: 'Contributing', link: `${REPO}/blob/main/CONTRIBUTING.md` },
          { text: 'Security policy', link: `${REPO}/blob/main/SECURITY.md` },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: REPO }],

    editLink: {
      pattern: ({ filePath }) =>
        // inlined on purpose: VitePress serialises this function, so it cannot use outer variables
        'https://github.com/manojmallick/copilot-ci-doctor/edit/main/docs/' +
        filePath.replace(/^guide\//, '').replace(/^index\.md$/, 'README.md'),
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'MIT © 2026 <a href="https://github.com/manojmallick">Manoj Mallick</a>',
    },
  },
})
