/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Glassmorphism Dream palette
        dream: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        // Neumorphism System palette
        system: {
          ivory: {
            50: '#fefefe',
            100: '#f5f5f5',
            200: '#e5e5e5',
            300: '#d4d4d4',
            400: '#a3a3a3',
            500: '#737373',
          },
          carbon: {
            50: '#3a3a3a',
            100: '#2d2d2d',
            200: '#262626',
            300: '#1f1f1f',
            400: '#171717',
            500: '#0a0a0a',
          },
        },
        // Primary gradient
        primary: {
          from: '#ec4899', // Pink
          via: '#a855f7',  // Purple
          to: '#6366f1',   // Indigo
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-dream': 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)',
        'gradient-dream-dark': 'linear-gradient(135deg, #9d174d 0%, #7c3aed 50%, #4338ca 100%)',
      },
      boxShadow: {
        // Neumorphism shadows
        'neu-light': '8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff',
        'neu-light-inset': 'inset 8px 8px 16px #d1d1d1, inset -8px -8px 16px #ffffff',
        'neu-dark': '8px 8px 16px #0d0d0d, -8px -8px 16px #2b2b2b',
        'neu-dark-inset': 'inset 8px 8px 16px #0d0d0d, inset -8px -8px 16px #2b2b2b',
        // Glassmorphism
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      backdropBlur: {
        'glass': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
