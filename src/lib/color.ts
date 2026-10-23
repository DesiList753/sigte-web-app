export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const MIN_CONTRAST = 4.5;

function channel(hex: string, index: number) {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastWithWhite(hex: string) {
  const luminance = 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  return 1.05 / (luminance + 0.05);
}

export function readableOnWhite(hex: string) {
  return HEX_COLOR.test(hex) && contrastWithWhite(hex) >= MIN_CONTRAST;
}
