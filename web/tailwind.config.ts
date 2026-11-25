import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#094be5',
          container: '#3867ff',
          fixed: '#dde1ff',
          'fixed-dim': '#b7c4ff',
        },
        'on-primary': '#ffffff',
        'on-primary-container': '#fffdff',
        'on-primary-fixed': '#001552',
        'on-primary-fixed-variant': '#0038b6',
        secondary: {
          DEFAULT: '#565e74',
          container: '#dae2fd',
          fixed: '#dae2fd',
          'fixed-dim': '#bec6e0',
        },
        'on-secondary': '#ffffff',
        'on-secondary-container': '#5c647a',
        'on-secondary-fixed': '#131b2e',
        'on-secondary-fixed-variant': '#3f465c',
        tertiary: {
          DEFAULT: '#006577',
          container: '#008096',
          fixed: '#acedff',
          'fixed-dim': '#4cd7f6',
        },
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#f9fdff',
        'on-tertiary-fixed': '#001f26',
        'on-tertiary-fixed-variant': '#004e5c',
        surface: {
          DEFAULT: '#f8f9ff',
          dim: '#cbdbf5',
          bright: '#f8f9ff',
          variant: '#d3e4fe',
          container: {
            lowest: '#ffffff',
            low: '#eff4ff',
            DEFAULT: '#e5eeff',
            high: '#dce9ff',
            highest: '#d3e4fe',
          },
        },
        background: '#f8f9ff',
        'on-background': '#0b1c30',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#434655',
        outline: '#747687',
        'outline-variant': '#c3c5d8',
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',
        'inverse-primary': '#b7c4ff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
