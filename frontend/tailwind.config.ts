import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Four-depth surface stack (modern dark theme) ──
        canvas: '#1A1A1E',
        'surface-1': '#232428',
        'surface-2': '#131316',
        'surface-3': '#0A0A0C',
        // Subtle raised card sitting directly on `canvas` (e.g. right-rail empty-state callout).
        'surface-callout': '#202024',
        // Shared "chrome" surface for the app shell — titlebar + DM/channel sidebar.
        // Sits darker than `canvas` so the main content area reads as the elevated workspace.
        'surface-chrome': '#121214',

        // ── Interactive row states (used in channel rows, tab strips, dropdown items) ──
        'surface-hover': '#2E2F34',
        'surface-active': '#393B41',
        'surface-composer': '#1F1F23',

        // ── Text ──
        ink: '#DBDEE1',
        'ink-muted': '#949BA4',
        'ink-subtle': '#6D6F78',

        // ── Border ──
        // Card / input outline — used on toaster, auth card, etc. Visible but never "gray".
        border: '#1F1F23',
        // Structural divider between shell columns / top-of-sidebar lip — barely-there, near-bg.
        'border-strong': '#17171B',
        // Translucent hairline for dividers inside the same chrome surface (e.g. server-rail / sidebar split).
        // White at low alpha so it adapts gracefully on any chrome bg shade — kept under 2%
        // so it never reads as a "drawn line", just a whisper of depth.
        'border-soft': 'rgba(255, 255, 255, 0.000)',

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
        'now-panel': '340px',
        // Layout heights
        'app-titlebar': '32px',
        'user-panel': '52px',
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
        // ── App-shell UI type scale (compact, modern — used across rails, top bar, callouts) ──
        badge: ['11px', { lineHeight: '1', letterSpacing: '0' }],
        caption: ['12px', { lineHeight: '1.45', letterSpacing: '0' }],
        control: ['13px', { lineHeight: '1.4', letterSpacing: '0' }],
        tab: ['14px', { lineHeight: '1.4', letterSpacing: '0' }],
        subhead: ['15px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
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
