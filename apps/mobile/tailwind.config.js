/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        parchment: "#fffaf0",
        ember: "#ea580c",
        emberDark: "#7c2d12",
        emberSoft: "#9a3412",
      },
    },
  },
  plugins: [],
};
