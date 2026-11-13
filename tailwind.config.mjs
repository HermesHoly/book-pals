/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        canvas: "#121214",
        surface: "#18181b",
        elevated: "#27272a",
        accent: "#2563eb",
      },
    },
  },
  plugins: [],
};
