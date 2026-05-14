import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

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

        // ── Glassmorphism stack (translucent siblings of the four-depth surfaces) ──
        // Used when the app sits on top of a photographic background (auth-bg.webp).
        // Component code uses these tokens; never embeds rgba() literals directly.
        // The outer shell/card owns the only backdrop-blur; inner zones layer on top of it.
        'glass-shell': 'rgba(18, 18, 22, 0.62)',
        'glass-canvas': 'rgba(26, 26, 30, 0.55)',
        'glass-chrome': 'rgba(14, 14, 17, 0.55)',
        'glass-surface-1': 'rgba(35, 36, 40, 0.55)',
        'glass-surface-2': 'rgba(19, 19, 22, 0.6)',
        'glass-callout': 'rgba(32, 32, 36, 0.55)',
        'glass-hover': 'rgba(255, 255, 255, 0.06)',
        'glass-active': 'rgba(255, 255, 255, 0.1)',
        // Dark veil between the photo and the glass card — keeps legibility regardless of
        // the wallpaper's local luminance.
        'glass-veil': 'rgba(10, 10, 13, 0.45)',
        // Hairlines on glass — low-alpha white reads as a "glass edge" on any photo tint.
        'glass-border': 'rgba(255, 255, 255, 0.08)',
        'glass-border-strong': 'rgba(255, 255, 255, 0.14)',

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

        // ── Calendar category swatches ──
        // Eight slugs covering the six study-domain built-ins plus two extras
        // for user-defined categories. Component code uses a static lookup
        // map (CATEGORY_COLOR_CLASSES) so Tailwind's purger picks every
        // resulting class up at build time.
        calendar: {
          blurple: '#5865F2',
          destructive: '#ED4245',
          success: '#57F287',
          warning: '#FEE75C',
          violet: '#9D6BFF',
          teal: '#3DDBD9',
          pink: '#EB459E',
          amber: '#F0B232',
        },

        // ── Whiteboard ──
        // Canvas-specific surfaces and cursor palette. The 8 cursor colors
        // are pre-tinted to read against a glass dark canvas — saturated
        // enough to spot, never neon. `pickCursorColor(userId)` hashes a
        // user id into one of these slots.
        whiteboard: {
          'canvas-tint': 'rgba(20, 20, 26, 0.42)',
          'grid-dot': 'rgba(255, 255, 255, 0.06)',
          'selection-ring': '#7B86F5',
          'cursor-1': '#5865F2',
          'cursor-2': '#EB459E',
          'cursor-3': '#57F287',
          'cursor-4': '#FEE75C',
          'cursor-5': '#F0B232',
          'cursor-6': '#23A55A',
          'cursor-7': '#9D6BFF',
          'cursor-8': '#3DDBD9',
          'swatch-ink': '#DBDEE1',
          'swatch-paper': '#F4ECD8',
        },

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
        'now-panel': '280px',
        // Quiz workshop — left rail with the question list (wider than the
        // channel list so titles + meta can breathe in two-line rows).
        'quiz-list': '280px',
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
        // Hand-written face for the whiteboard's text shapes + sticky notes —
        // the "this is a study session, not a Figma file" signal. Loaded via
        // tldraw-theme.css's @import so non-whiteboard routes don't pay for
        // it.
        handwritten: ['Caveat', 'Patrick Hand', 'Comic Neue', 'cursive'],
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
        // Glassmorphism — lifts a translucent card off a photographic ground plane.
        // Outer drop shadow + 1px inner highlight ("glass edge") on the top border.
        glass:
          '0 30px 60px -20px rgba(0,0,0,0.6), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
      },

      backdropBlur: {
        glass: '24px',
        'glass-sm': '12px',
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
  plugins: [
    // shadcn/ui animations (`animate-in`, `fade-in-0`, `slide-in-from-top-2`,
    // `data-[state=open]:…`) — required by DropdownMenu, Tooltip, Dialog, etc.
    // Without this plugin those classes are no-ops and the components render
    // without enter/exit transitions.
    tailwindcssAnimate,
    // Tiny utility plugin: `cv-auto` opts in to content-visibility off-screen
    // skipping. Used on long virtualizable-but-not-yet-virtualized lists so the
    // browser skips render/layout/paint work for rows below the fold.
    function ({ addUtilities }: { addUtilities: (u: Record<string, unknown>) => void }) {
      addUtilities({
        '.cv-auto': {
          'content-visibility': 'auto',
          'contain-intrinsic-size': 'auto 200px',
        },
      });
    },
  ],
};

export default config;
