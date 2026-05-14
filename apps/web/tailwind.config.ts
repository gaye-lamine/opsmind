import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // OpsMind enterprise dark palette
        surface: {
          DEFAULT: "#0a0a0f",
          1: "#0f0f17",
          2: "#14141e",
          3: "#1a1a26",
          4: "#20202e",
        },
        border: {
          DEFAULT: "#1e1e2e",
          subtle: "#16162a",
          strong: "#2a2a3e",
        },
        accent: {
          DEFAULT: "#6366f1",   // indigo — primary action
          hover: "#818cf8",
          muted: "#312e81",
          subtle: "#1e1b4b",
        },
        success: {
          DEFAULT: "#10b981",
          muted: "#064e3b",
          subtle: "#022c22",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "#78350f",
          subtle: "#451a03",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "#7f1d1d",
          subtle: "#450a0a",
        },
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          muted: "#475569",
          disabled: "#334155",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-accent": "0 0 20px rgba(99, 102, 241, 0.15), 0 0 40px rgba(99, 102, 241, 0.05)",
        "glow-success": "0 0 20px rgba(16, 185, 129, 0.15), 0 0 40px rgba(16, 185, 129, 0.05)",
        "glow-warning": "0 0 20px rgba(245, 158, 11, 0.2), 0 0 40px rgba(245, 158, 11, 0.08)",
        "glow-danger": "0 0 20px rgba(239, 68, 68, 0.2), 0 0 40px rgba(239, 68, 68, 0.08)",
        "card-hover": "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-up-1": "slideUp 0.4s ease-out 0.05s both",
        "slide-up-2": "slideUp 0.4s ease-out 0.1s both",
        "slide-up-3": "slideUp 0.4s ease-out 0.15s both",
        "slide-up-4": "slideUp 0.4s ease-out 0.2s both",
        "shimmer": "shimmer 2s linear infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "gauge-fill": "gaugeFill 1s ease-out 0.3s both",
        "step-enter": "stepEnter 0.5s ease-out both",
        "border-glow": "borderGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        gaugeFill: {
          "0%": { strokeDashoffset: "251" },
          "100%": { strokeDashoffset: "var(--gauge-offset)" },
        },
        stepEnter: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(245, 158, 11, 0.3)" },
          "50%": { borderColor: "rgba(245, 158, 11, 0.7)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
