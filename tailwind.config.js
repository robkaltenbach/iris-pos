/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'iris-cyan': '#67E3FF',
        'iris-purple': '#A984FF',
      },
      fontFamily: {
        'sans': ['RobotoCondensed_400Regular', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
