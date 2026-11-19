export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],
        xl: ["1.3125rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }],
        "3xl": ["1.95rem", { lineHeight: "2.375rem" }],
      },
      colors: {
        brand: {
          50: "#F0F7FA",
          100: "#E6F1F6",
          DEFAULT: "#0E5A7C",
          dark: "#0A4259",
          darker: "#073042",
          light: "#E6F1F6",
        },
        accent: {
          DEFAULT: "#F2A100",
          dark: "#D68D00",
          light: "#FEF5E0",
        },
      },
      boxShadow: {
        soft: "0 2px 12px -2px rgba(14, 90, 124, 0.08), 0 1px 4px -1px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};
