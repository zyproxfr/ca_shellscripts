import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec5ff",
          400: "#59a4ff",
          500: "#3382ff",
          600: "#1c62f5",
          700: "#164ce0",
          800: "#193fb5",
          900: "#1a398f",
        },
      },
      fontSize: {
        // Tailles pensées pour un usage tablette/TV : gros libellés, forte lisibilité à distance.
        "tv-xl": ["4rem", { lineHeight: "1.1" }],
        "tv-lg": ["2.5rem", { lineHeight: "1.15" }],
      },
    },
  },
  plugins: [],
};

export default config;
