import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f8cff',
          muted: '#eaf1ff',
          dark: '#3a6fdd',
        },
        ink: '#111111',
        surface: '#ffffff',
        mist: '#f6f8fc',
        borderSoft: 'rgba(17,17,17,0.08)',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
        lift: '0 18px 44px rgba(15, 23, 42, 0.14)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
