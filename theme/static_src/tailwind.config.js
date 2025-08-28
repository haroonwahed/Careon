
import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    '../templates/**/*.html',
    './src/**/*.{css,js}',
    '../../contracts/templates/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0C',
        stroke: '#E5E7EB',
        accent: '#0E9F6E',
        warn: '#F59E0B',
        danger: '#DC2626',
        muted: '#6B7280',
        'gray-50': '#F9FAFB',
        'gray-100': '#F3F4F6',
        'gray-200': '#E5E7EB',
        'gray-300': '#D1D5DB',
        'gray-400': '#9CA3AF',
        'gray-500': '#6B7280',
        'gray-600': '#4B5563',
        'gray-700': '#374151',
        'gray-800': '#1F2937',
        'gray-900': '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '0.875rem', // 14px base
        'lg': '1rem',
        'xl': '1.125rem',
        '2xl': '1.5rem', // 24px section headers
        '3xl': '2rem', // 32px page titles
      },
      lineHeight: {
        'base': '1.25', // 16/14
        'section': '1.167', // 28/24
        'title': '1.125', // 36/32
      },
      spacing: {
        '0.5': '0.125rem', // 2px
        '1': '0.25rem',    // 4px
        '2': '0.5rem',     // 8px base
        '3': '0.75rem',    // 12px
        '4': '1rem',       // 16px
        '5': '1.25rem',    // 20px
        '6': '1.5rem',     // 24px
        '8': '2rem',       // 32px
        '10': '2.5rem',    // 40px
        '12': '3rem',      // 48px
        '16': '4rem',      // 64px
      },
      maxWidth: {
        'container': '1200px',
      },
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
