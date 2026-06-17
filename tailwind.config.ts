import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0c0e15",
        ink: "#e7e7ea",
        muted: "#9aa0ac",
        accent: "#9fb4ff",
        border: "#2a2d3a",
        funded: "#5fd38d",
        benched: "#e8b84a",
        refused: "#f08a8a",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;