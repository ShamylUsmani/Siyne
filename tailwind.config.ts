import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#fff1f1',
          100: '#ffdede',
          200: '#ffbcbc',
          300: '#ff8888',
          400: '#ff4545',
          500: '#ff1a1a',
          600: '#e00000',
          700: '#b80000',
          800: '#950000',
          900: '#5c0000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(40px, -40px) scale(1.07)' },
          '66%':       { transform: 'translate(-30px, 25px) scale(0.95)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'aurora': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'float-slow':     'float-slow 10s ease-in-out infinite',
        'float-slow-rev': 'float-slow 13s ease-in-out infinite reverse',
        'fade-up':        'fade-up 0.6s ease both',
        'marquee':        'marquee 28s linear infinite',
        'aurora':         'aurora 12s ease infinite',
      },
    },
  },
  plugins: [],
};

export default config;
