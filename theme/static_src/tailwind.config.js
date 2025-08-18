/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["../templates/**/*.html"],
  theme: {
    extend: {
      colors: {
        primary: {
          900: "var(--primary-900)",
          800: "var(--primary-800)",
          700: "var(--primary-700)",
          600: "var(--primary-600)",
          500: "var(--primary-500)",
          400: "var(--primary-400)",
        },
        accent: { 500: "var(--accent-500)" },
        bg: "var(--bg)",
        card: "var(--card)",
        border: "var(--border)",
        muted: "var(--muted)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      }
    }
  },
  plugins: [],
}