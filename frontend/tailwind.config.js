/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        komazi: {
          black: "#0A0A0A",
          surface: "#141414",
          "surface-2": "#1E1E1E",
          border: "#2A2A2A",
          coral: {
            DEFAULT: "#FF5A4D",
            dark: "#E0453A",
            soft: "rgba(255, 90, 77, 0.15)"
          },
          teal: {
            DEFAULT: "#1F6F6B",
            light: "#2FA39C",
            soft: "rgba(31, 111, 107, 0.15)"
          },
          text: "#F5F5F5",
          muted: "#9A9A9A",
        },
        success: "#3DBE7A",
        warning: "#F5B544",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        glow: "0 0 0 3px rgba(255,90,77,0.25)",
        tealGlow: "0 0 0 3px rgba(47,163,156,0.25)",
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'steam-rise': {
          '0%': { transform: 'translateY(0) scaleX(1)', opacity: '0.1' },
          '50%': { transform: 'translateY(-8px) scaleX(1.15)', opacity: '0.6' },
          '100%': { transform: 'translateY(-18px) scaleX(0.85)', opacity: '0' },
        },
        'coffee-pour': {
          '0%': { height: '0%' },
          '100%': { height: '100%' },
        },
        'pulse-glow-coral': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(255, 90, 77, 0.25)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 90, 77, 0.6)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite linear',
        'steam-1': 'steam-rise 2s infinite ease-out',
        'steam-2': 'steam-rise 2s infinite ease-out 0.4s',
        'steam-3': 'steam-rise 2s infinite ease-out 0.8s',
        'pulse-glow': 'pulse-glow-coral 2.5s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
