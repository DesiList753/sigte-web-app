import type { CSSProperties } from "react";

export function orgTheme(brandColor: string | null | undefined) {
  if (!brandColor) return {};
  return { className: "org-theme", style: { "--accent": brandColor } as CSSProperties };
}
