/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // NOTE: Update this to include the paths to all of your component files.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        dm: "DMSans_400Regular",
        dmSemiBold: "DMSans_500Medium",
        dmBold: "DMSans_700Bold"
      }
      ,
      colors: {
        "primary": "#111111",
        "white": "#ffffff",
        'purple': "#971BB2",
        'grey': "#F3F3F3",
        'light': "#F3F3F3",
        'dark': "#0C0C0C",
        'accent': "#131313",
        'accent2': "#242424",
        'line': "#2C2C2C",
        theme: {
          bg: 'var(--bg)',
          text: 'var(--text)',
          primary: 'var(--primary)',
          secondary: 'var(--secondary)',
          accent: 'var(--accent)',
        }
      }

    }
  },
  plugins: [],
}