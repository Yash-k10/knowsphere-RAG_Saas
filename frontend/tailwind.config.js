/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#F4F7F5',
          100: '#E6ECE8',
          200: '#D0DCD4',
          300: '#ADC4B4',
          400: '#7FA48B',
          500: '#5A8669',
          600: '#466E53',
          700: '#385843',
          800: '#2F4637',
          900: '#273B2F',
        },
        earth: {
          50: '#FAF8F5',
          100: '#F3EFE9',
          200: '#E7DFD4',
          300: '#D6C8B8',
          400: '#B8A38E',
          500: '#9B846E',
          600: '#7E6854',
          700: '#645243',
          800: '#524338',
          900: '#443830',
        },
        forest: {
          900: '#17221C',
          800: '#1E2D25',
          700: '#273A30',
          600: '#354D40',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
