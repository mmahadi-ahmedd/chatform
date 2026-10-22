import type { Config } from "tailwindcss";

// Brand palette. `indigo` is remapped to the cobalt scale so the dashboard,
// builder and auth pages match the landing page without touching every class.
const cobalt = {
  50: "#eef0fd",
  100: "#dfe3fb",
  200: "#c3cbf7",
  300: "#9aa6f1",
  400: "#6f7eea",
  500: "#4558e6",
  600: "#2a3fd6",
  700: "#2133b3",
  800: "#1d2b8f",
  900: "#1b276f",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { indigo: cobalt, cobalt, ink: "#101426", sun: "#ffd23f" },
      fontFamily: {
        sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', "Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;