/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#173A2E",       // dark green sidebar
        "sidebar-hover": "#20493A",
        brand: "#1E7A46",         // primary green (buttons, active states)
        "brand-light": "#E8F5EE", // light green tint (icon backgrounds)
        canvas: "#F6F8F7",        // page background
        panel: "#FFFFFF",         // card background
        border: "#E5E9E7",
        ink: "#1A2420",           // primary text
        muted: "#6B7A73",         // secondary text
        markdown: "#F5A623",      // amber - markdown action
        "markdown-light": "#FEF3E0",
        fasttrack: "#E8622C",     // orange-red - fast-track
        "fasttrack-light": "#FCEBE3",
        donate: "#D64545",        // red - donate
        "donate-light": "#FBE9E9",
        compost: "#6B4423",       // brown - compost
        "compost-light": "#EFE7DE",
        hold: "#1E7A46",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 20, 0.06), 0 1px 3px rgba(16, 24, 20, 0.04)",
      },
    },
  },
  plugins: [],
}