/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF8F4",
        ink: "#16130F",
        earth: "#3B342C",
        bone: "#F5F1EA",
      },
      fontFamily: {
        serif: ["Source Serif 4", "Georgia", "Times New Roman", "serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
