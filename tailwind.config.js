/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // EnjoyHub Brand Colors - Energetic & Entertaining
        primary: {
          50: '#FFF8F2',
          100: '#FFE9D9',
          200: '#FFD3B3',
          300: '#FFB580',
          400: '#FF9040',
          500: '#FF6B00', // Base orange
          600: '#D95B00',
          700: '#B34B00',
          800: '#803600',
          900: '#592500',
          950: '#331500',
          light: '#FFB580',
          dark: '#B34B00',
          DEFAULT: '#FF6B00',
        },
        secondary: {
          50: '#FFFDF6',
          100: '#FFF9E3',
          200: '#FFF2C6',
          300: '#FFEAA0',
          400: '#FFDF71',
          500: '#FFD441', // Base yellow
          600: '#D9B437',
          700: '#B3942E',
          800: '#806A21',
          900: '#594A17',
          950: '#332A0D',
          light: '#FFEAA0',
          dark: '#B3942E',
          DEFAULT: '#FFD441',
        },
        accent: {
          50: '#F2FBFF',
          100: '#D9F4FF',
          200: '#B3E9FF',
          300: '#80DAFF',
          400: '#40C7FF',
          500: '#00B4FF', // Base blue
          600: '#0099D9',
          700: '#007EB3',
          800: '#005A80',
          900: '#003F59',
          950: '#002433',
          light: '#80DAFF',
          dark: '#007EB3',
          DEFAULT: '#00B4FF',
        },
        neutral: {
          50: '#F4F4F4',
          100: '#DDDDDD',
          200: '#BCBCBC',
          300: '#8F8F8F',
          400: '#575757',
          500: '#1F1F1F', // Base dark/graphite
          600: '#1A1A1A',
          700: '#161616',
          800: '#101010',
          900: '#0B0B0B',
          950: '#060606',
          light: '#8F8F8F',
          dark: '#161616',
          DEFAULT: '#1F1F1F',
        },
        // Keep existing shadcn/ui colors for compatibility
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      backgroundImage: {
        // Brand Gradients
        'hero-gradient': 'linear-gradient(135deg, #FF6B00 0%, #FFD441 100%)',
        'hero-gradient-vertical': 'linear-gradient(180deg, #FF6B00 0%, #FFD441 100%)',
        'accent-gradient': 'linear-gradient(135deg, #00B4FF 0%, #FF6B00 100%)',
        'accent-gradient-vertical': 'linear-gradient(180deg, #00B4FF 0%, #FF6B00 100%)',
        'dark-gradient': 'linear-gradient(135deg, #1F1F1F 0%, #101010 100%)',
        'category-gradient': 'linear-gradient(135deg, #00B4FF 0%, #80DAFF 100%)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [
    function ({ addComponents, theme }) {
      addComponents({
        // Button Components
        '.btn-primary': {
          '@apply bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3':
            {},
        },
        '.btn-accent': {
          '@apply bg-accent text-white font-semibold rounded-xl shadow-md hover:bg-accent-dark hover:shadow-lg transition-all duration-300 px-6 py-3':
            {},
        },
        '.btn-outline-primary': {
          '@apply border-2 border-primary text-primary font-semibold rounded-xl hover:bg-primary hover:text-white transition-all duration-300 px-6 py-3':
            {},
        },
        
        // Badge Components
        '.badge-primary': {
          '@apply bg-primary text-white text-xs font-semibold rounded-lg px-3 py-1 inline-block':
            {},
        },
        '.badge-secondary': {
          '@apply bg-secondary text-neutral-700 text-xs font-semibold rounded-lg px-3 py-1 inline-block':
            {},
        },
        '.badge-accent': {
          '@apply bg-accent text-white text-xs font-semibold rounded-lg px-3 py-1 inline-block':
            {},
        },
        
        // Card Components
        '.card': {
          '@apply rounded-2xl bg-white shadow-xl border border-neutral-100 overflow-hidden transition-all duration-300 hover:shadow-2xl':
            {},
        },
        '.card-dark': {
          '@apply rounded-2xl bg-neutral-800 shadow-xl border border-neutral-700 overflow-hidden transition-all duration-300 hover:shadow-2xl':
            {},
        },
        '.card-gradient': {
          '@apply rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 shadow-xl border border-neutral-100 overflow-hidden transition-all duration-300 hover:shadow-2xl':
            {},
        },
        
        // Typography Components
        '.section-title': {
          '@apply text-neutral-900 dark:text-neutral-50 font-bold tracking-tight text-3xl md:text-4xl mb-6':
            {},
        },
        '.section-subtitle': {
          '@apply text-neutral-600 dark:text-neutral-300 font-medium text-lg md:text-xl mb-4':
            {},
        },
        '.heading-gradient': {
          '@apply bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-bold':
            {},
        },
        
        // Category Icon Components
        '.category-icon': {
          '@apply w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-white shadow-lg':
            {},
        },
        '.category-icon-primary': {
          '@apply w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-lg':
            {},
        },
        
        // Slider/Carousel Components
        '.slider-section': {
          '@apply py-12 md:py-16 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-800':
            {},
        },
        '.slider-card': {
          '@apply card p-0 hover:scale-105 transform transition-transform duration-300':
            {},
        },
        
        // Feature Section Components
        '.feature-card': {
          '@apply card p-6 hover:border-primary-300 transition-all duration-300':
            {},
        },
        '.feature-card-gradient': {
          '@apply rounded-2xl p-6 bg-gradient-to-br from-white to-primary-50 dark:from-neutral-800 dark:to-neutral-700 shadow-lg border border-primary-100 dark:border-neutral-600 hover:shadow-xl transition-all duration-300':
            {},
        },
      });
    },
  ],
};
