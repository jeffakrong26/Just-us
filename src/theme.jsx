import React from "react";

export const BG = "linear-gradient(180deg, #0F1B33 0%, #14213D 55%, #1B2A4A 100%)";
// The accent color is user-themeable (see ACCENT_PRESETS in App.jsx) — this
// reads the --accent CSS variable set on the app root, so every existing
// CORAL usage picks up the chosen theme without a per-component rewrite.
export const CORAL = "var(--accent, #FF6F5E)";
export const GOLD = "#FFC15E";
export const TEAL = "#35C9C1";
export const CREAM = "#F5EFE6";

export function SectionCard({ children }) {
  return <div className="rounded-2xl p-4 bg-white/5 border border-white/10 mb-4">{children}</div>;
}
