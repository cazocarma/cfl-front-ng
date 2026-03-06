/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f3faf4',
          100: '#e3f5e6',
          200: '#c8eacd',
          300: '#9fd8a8',
          400: '#6dbc7a',
          500: '#45a054',
          600: '#348040',
          700: '#2b6734',
          800: '#25522b',
          900: '#1e4424',
          950: '#102614',
        },
        sage: {
          50:  '#f6f8f2',
          100: '#eaefdf',
          200: '#d5e0c1',
          300: '#b7ca97',
          400: '#97b06d',
          500: '#7b9650',
          600: '#62793f',
          700: '#4d5f33',
          800: '#404e2c',
          900: '#374327',
          950: '#1c2312',
        },
        earth: {
          50:  '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bc',
          300: '#e8be8e',
          400: '#dc9c5e',
          500: '#d48040',
          600: '#c56831',
          700: '#a35129',
          800: '#834127',
          900: '#6a3723',
          950: '#391b10',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      boxShadow: {
        'nature': '0 4px 24px -4px rgba(45, 111, 58, 0.18)',
        'nature-lg': '0 8px 40px -8px rgba(45, 111, 58, 0.25)',
      },
    },
  },
  safelist: [
    'translate-x-0',
    '-translate-x-full',
    'shadow-2xl',
  ],
  plugins: [],
};
