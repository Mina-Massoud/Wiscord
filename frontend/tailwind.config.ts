import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Four-depth surface stack ──
        canvas: '#313338',
        'surface-1': '#2B2D31',
        'surface-2': '#1E1F22',
        'surface-3': '#111214',

        // ── Text ──
        ink: '#DBDEE1',
        'ink-muted': '#949BA4',
        'ink-subtle': '#6D6F78',

        // ── Border ──
        border: '#3F4147',

        // ── Brand / accent ──
        blurple: '#5865F2',
        'blurple-hover': '#4752C4',
        'blurple-foreground': '#ffffff',

        // ── Semantic states ──
        success: '#57F287',
        warning: '#FEE75C',
        destructive: '#ED4245',

        // ── Presence ──
        'presence-online': '#23A55A',
        'presence-idle': '#F0B232',
        'presence-dnd': '#F23F43',
        'presence-offline': '#80848E',

        // ── shadcn/ui CSS-var bridge (maps to :root vars in globals.css) ──
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
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },

      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '24px',
        pill: '9999px',
        // shadcn bridge
        DEFAULT: 'calc(var(--radius))',
      },

      spacing: {
        '4px': '4px',
        '8px': '8px',
        '12px': '12px',
        '16px': '16px',
        '24px': '24px',
        '32px': '32px',
        '48px': '48px',
        '64px': '64px',
        // Layout widths
        'server-list': '72px',
        'channel-list': '240px',
        'member-panel': '240px',
      },

      fontFamily: {
        sans: [
          'Abcgintodiscord',
          'Inter',
          'GGSans',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        display: ['Abcgintodiscordnord', 'Montserrat', 'Arial', 'sans-serif'],
      },

      fontSize: {
        display: ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        body: ['16px', { lineHeight: '1.375', letterSpacing: '0', fontWeight: '400' }],
      },

      transitionDuration: {
        fast: '100ms',
        base: '200ms',
      },

      transitionTimingFunction: {
        wiscord: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3)',
        elevated: '0 8px 16px rgba(0,0,0,0.24)',
        modal: '0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.5)',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'accordion-up': 'accordion-up 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
