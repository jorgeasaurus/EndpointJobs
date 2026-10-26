import assert from "node:assert/strict";
import test from "node:test";

type Rgb = [number, number, number];

const obsidian: Rgb = [7, 9, 11];
const black: Rgb = [0, 0, 0];
const labelStrong: Rgb = [215, 222, 231];
const cyan: Rgb = [56, 189, 248];
const emerald: Rgb = [45, 212, 191];
const lime: Rgb = [190, 242, 100];

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb) {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(foreground: Rgb, background: Rgb) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((component, index) => Math.round(component * alpha + background[index] * (1 - alpha))) as Rgb;
}

test("small monospace labels meet WCAG AA contrast", () => {
  const chipCyan = blend(cyan, obsidian, 0.08);
  const chipEmerald = blend(emerald, obsidian, 0.08);
  const pairs = [
    ["ROLE and FRESHNESS on obsidian", labelStrong, obsidian],
    ["ROLE and FRESHNESS on black", labelStrong, black],
    ["View more on obsidian", labelStrong, obsidian],
    ["platform chip", cyan, chipCyan],
    ["tool chip", emerald, chipEmerald],
    ["active workplace count", black, lime]
  ] as const;

  for (const [name, foreground, background] of pairs) {
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio >= 4.5, `${name} contrast ${ratio.toFixed(2)} is below 4.5:1`);
  }
});
