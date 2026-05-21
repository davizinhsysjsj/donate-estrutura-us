/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        'primary-dark': '#2563EB',
        'primary-light': '#DBEAFE',
        'primary-soft': '#EFF6FF',
        ink: '#0a0a0a',
        muted: '#f5f5f5',
        'muted-fg': '#737373',
        border: '#e5e5e5'
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
