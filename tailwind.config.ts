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
          50:  '#fff1f3',
          100: '#ffe0e5',
          200: '#ffb8c3',
          300: '#f07889',
          400: '#D63A52',
          500: '#C02840',
          600: '#B01E36',
          700: '#8A1228',
          800: '#6E0D20',
          900: '#4A0818',
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
