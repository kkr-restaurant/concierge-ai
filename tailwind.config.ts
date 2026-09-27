import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D1117",
        surface: "#141A22",
        surface2: "#1B2330",
        border: "#26303F",
        muted: "#8B94A7",
        fg: "#F1F3F6",
        brass: "#C9A227",
        brassSoft: "#2A2416",
        success: "#3FB68B",
        danger: "#E5484D",
        warning: "#E8A33D",
        steel: "#4C8DFF",
        steelSoft: "#152238",
        pInk: "#0A0D12",
        pSurface: "#10141B",
        pSurface2: "#171C25",
        pBorder: "#232A36"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      borderRadius: {
        card: "10px"
      }
    }
  },
  plugins: []
};

export default config;
