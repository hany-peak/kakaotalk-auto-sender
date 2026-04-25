import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        surface2: '#22263a',
        border: '#2e3350',
        accent: '#4f7fff',
        accent2: '#6ee7b7',
        text: '#e8eaf6',
        muted: '#7b82a8',
        danger: '#f87171',
        success: '#34d399',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
