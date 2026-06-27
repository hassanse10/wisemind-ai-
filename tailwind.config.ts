import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{tsx,ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          900: '#1e3a8a',
        },
        wellness: {
          green: '#10b981',
          teal: '#14b8a6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
