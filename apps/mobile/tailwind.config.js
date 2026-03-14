/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#fff0f5",
        surface: "#ffffff",
        surfaceMuted: "rgba(255,255,255,0.9)",
        primary: "#F472B6",
        primaryDark: "#EC4899",
        primaryText: "#DB2777",
        primaryStrong: "#BE185D",
        primaryBorder: "#F9A8D4",
        primaryBg: "#FDF2F8",
        primaryTint: "#FCE7F3",
        secondary: "#FDE047",
        secondaryDark: "#EAB308",
        fg: "#4a3728",
        fgMuted: "#6b7280",
      },
      fontFamily: {
        nunito: ["Nunito_400Regular"],
        "nunito-semibold": ["Nunito_600SemiBold"],
        "nunito-bold": ["Nunito_700Bold"],
        "nunito-extrabold": ["Nunito_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
