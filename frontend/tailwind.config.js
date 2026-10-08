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
    },
  },
  plugins: [],
};
