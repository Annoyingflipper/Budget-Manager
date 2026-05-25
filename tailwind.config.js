/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--bg)',
        card:      'var(--card)',
        highlight: 'var(--highlight)',
        text:      'var(--text)',
        muted:     'var(--muted)',
        positive:  'var(--positive)',
        negative:  'var(--negative)',
        dashed:    'var(--dashed)',
        'hero-bg':   'var(--hero-bg)',
        'hero-text': 'var(--hero-text)',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
