/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        fontFamily: {
          dm: "DMSans_400Regular",
          dmSemiBold: "DMSans_500Medium",
          dmBold: "DMSans_700Bold"
        }
      },
      colors: {
        "primary": "#111111",
        "white": "#ffffff",
        purple: "#971BB2",
        grey: "#F3F3F3",
      }
    }
  },
  plugins: [],
}