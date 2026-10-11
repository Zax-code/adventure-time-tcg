const tokens = require("@adventure-time/theme/tailwind-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Generated from packages/theme. Radius, spacing and type scales use a
      // ds- prefix so they do not change Tailwind's default utilities.
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
      spacing: tokens.spacing,
      fontSize: tokens.fontSize,
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
