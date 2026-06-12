/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0a1628', 900: '#0e1f38', 800: '#14294a', 700: '#1b3560' },
        gold: { 400: '#f5c95e', 500: '#f0b429', 600: '#d99a16' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
