import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        surface: "#f4f4f4",
        ink: "#002244",
        muted: "#666666",
        accent: "#117ACA",
        border: "#d1d1d1",
        funded: "#00684a",
        benched: "#f59e0b",
        refused: "#b91c1c",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
