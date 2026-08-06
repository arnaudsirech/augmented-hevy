import { useEffect, useState } from "react";

export interface ThemeColors {
  seriesBlue: string;
  seriesOrange: string;
  seriesAqua: string;
  gridline: string;
  baseline: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  border: string;
}

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    seriesBlue: v("--series-1"),
    seriesOrange: v("--series-2"),
    seriesAqua: v("--series-3"),
    gridline: v("--gridline"),
    baseline: v("--baseline"),
    textSecondary: v("--text-secondary"),
    textMuted: v("--text-muted"),
    surface: v("--surface-1"),
    border: v("--border"),
  };
}

/** Reads the palette's CSS custom properties and re-reads them when the OS
 * color scheme flips, so Recharts (which needs real color strings, not
 * `var()`) stays in sync with light/dark mode. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() => readColors());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setColors(readColors());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return colors;
}
