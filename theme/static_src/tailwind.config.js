/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '../templates/**/*.html',
    '../../contracts/templates/**/*.html',
    './src/**/*.{js,css}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0C',
        bg: '#FFFFFF',
        stroke: '#E5E7EB',
        accent: '#0E9F6E',
        warn: '#F59E0B',
        danger: '#DC2626',
        muted: '#6B7280',
        surface: '#F9FAFB',
        border: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'base': ['14px', '20px'],
        'lg': ['16px', '24px'],
        'xl': ['18px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['32px', '40px'],
      },
      spacing: {
        'unit': '8px',
      },
      maxWidth: {
        'container': '1200px',
      },
    },
  },
  plugins: [],
}