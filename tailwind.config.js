/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#02A95C',
        'primary-dark': '#008F4C',
        'primary-light': '#C8F0DA',
        'primary-soft': '#E6F7EE',
        ink: '#1F1F1F',
        muted: '#F5F5F5',
        'muted-fg': '#6B7280',
        border: '#E5E7EB'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
