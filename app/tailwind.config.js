/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8f9ff',
          dim: '#d8dae0',
          bright: '#f8f9ff',
          'container-lowest': '#ffffff',
          'container-low': '#f2f3f9',
          DEFAULT2: '#eceef3',
          'container-high': '#e7e8ee',
          'container-highest': '#e1e2e8',
        },
        on: {
          surface: '#191c20',
          'surface-variant': '#4f434b',
        },
        outline: {
          DEFAULT: '#81737b',
          variant: '#d3c2cb',
        },
        'surface-tint': '#854b76',
        primary: {
          DEFAULT: '#854b76',
          container: '#ffb7e9',
          fixed: '#ffd7f0',
          'fixed-dim': '#f8b1e2',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#7c436e',
          fixed: '#37062f',
          'fixed-variant': '#6a335d',
        },
        secondary: {
          DEFAULT: '#006971',
          container: '#94f1fb',
          fixed: '#94f1fb',
          'fixed-dim': '#77d5de',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#006f78',
          fixed: '#002022',
          'fixed-variant': '#004f55',
        },
        tertiary: {
          DEFAULT: '#506600',
          container: '#b1dd00',
          fixed: '#c3f400',
          'fixed-dim': '#abd600',
        },
        'on-tertiary': {
          DEFAULT: '#ffffff',
          container: '#4a5e00',
          fixed: '#161e00',
          'fixed-variant': '#3c4d00',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': {
          DEFAULT: '#ffffff',
          container: '#93000a',
        },
        pillar: {
          tecna: '#77d5de',
          flora: '#b1dd00',
          musa: '#f8b1e2',
          bloom: '#ffb7e9',
          stella: '#ffd7f0',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        label: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
        'headline-lg': ['32px', { lineHeight: '40px' }],
        'headline-lg-mobile': ['28px', { lineHeight: '34px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'label-caps': [
          '12px',
          { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '600' },
        ],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'gutter': '16px',
        'container-pad': '24px',
        'section': '40px',
      },
      maxWidth: {
        content: '1440px',
      },
      backdropBlur: {
        glass: '12px',
        modal: '20px',
      },
      keyframes: {
        'drift': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(2%, -1%) rotate(1deg)' },
          '66%': { transform: 'translate(-1%, 2%) rotate(-1deg)' },
        },
        'twinkle': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        'bloom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        'sheen': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(133, 75, 118, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(133, 75, 118, 0.6)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'drift': 'drift 60s ease-in-out infinite',
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'bloom': 'bloom 200ms ease-out forwards',
        'sheen': 'sheen 1.5s ease-in-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      boxShadow: {
        'glass':
          '0 8px 32px rgba(133, 75, 118, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-hover':
          '0 12px 40px rgba(133, 75, 118, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'glow-primary': '0 0 24px rgba(133, 75, 118, 0.3)',
        'glow-secondary': '0 0 24px rgba(0, 105, 113, 0.3)',
        'glow-tertiary': '0 0 24px rgba(80, 102, 0, 0.3)',
        'glow-pink': '0 0 32px rgba(255, 183, 233, 0.5)',
        'glow-lime': '0 0 32px rgba(177, 221, 0, 0.5)',
        'glow-blue': '0 0 32px rgba(148, 241, 251, 0.5)',
      },
    },
  },
  plugins: [],
};
