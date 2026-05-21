/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'black-deep': '#0A0A0A',
        'warm-charcoal': '#1F1A18',
        'snow': '#FAFAFA',
        'muted': '#7A7A7A',
        'amber-accent': '#E8A857',
        'copper': '#C9A66B',
        'urgency-red': '#D63B3B'
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'sans-serif']
      },
      boxShadow: {
        soft: '0 8px 32px rgba(232, 168, 87, 0.08), 0 2px 8px rgba(0,0,0,0.4)'
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px'
      }
    }
  },
  plugins: []
};
