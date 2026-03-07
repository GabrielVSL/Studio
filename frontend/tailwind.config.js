/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- ISSO AQUI É VITAL!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}