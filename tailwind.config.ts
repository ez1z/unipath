import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Turkmen literal tokens — support opacity modifiers */
        gold: {
          DEFAULT: '#C49A1E',
          light: '#F7E9B9',
          dark: '#8B6B10',
        },
        crimson: {
          DEFAULT: '#8B1A1A',
          light: '#F5DADA',
          dark: '#5C1010',
        },
        'tk-green': {
          DEFAULT: '#1A6344',
          light: '#D4EDE1',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px 0 rgba(139, 26, 26, 0.07), 0 1px 2px 0 rgba(0,0,0,0.05)',
        'card-hover': '0 6px 20px 0 rgba(139, 26, 26, 0.12), 0 2px 6px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
