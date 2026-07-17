/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./features/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode colors
        primary: "#93AE72",
        secondary: "#905C36",
        muted: "#E5EAE0",
        destructive: "#B04A3A",
        foreground: "#E5EAE0",
        accent: "#DFE2CF",
        "light-brown": "#CDC8B8",
        background: "#FFFFFF",
        card: "#FFFFFF",
        text: "#333333",
        border: "#E0E0E0",
        // Dark mode specific colors
        dark: {
          primary: "#7A9455",
          secondary: "#B27A4D",
          muted: "#2E3731",
          destructive: "#D05A48",
          foreground: "#2E3731",
          accent: "#111c16",
          "light-brown": "#4A4840",
          background: "#1A1A1A",
          card: "#2A2A2A",
          text: "#E0E0E0",
          border: "#444444"
        }
      }
    },
  },
  plugins: [],
}