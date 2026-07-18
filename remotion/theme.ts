import {Easing, interpolate, spring} from "remotion";

export const colors = {
  black: "#000000",
  obsidian: "#07090b",
  surface: "#0d1114",
  surface2: "#12181c",
  lime: "#bef264",
  emerald: "#2dd4bf",
  cyan: "#38bdf8",
  white: "#f3f4f6",
  muted: "rgba(243, 244, 246, 0.58)",
  faint: "rgba(243, 244, 246, 0.28)",
  border: "rgba(243, 244, 246, 0.12)",
};

export const sans = "Space Grotesk";
export const mono = "JetBrains Mono";

export const reveal = (frame: number, fps: number, delaySeconds = 0) =>
  spring({
    frame: frame - delaySeconds * fps,
    fps,
    config: {damping: 200},
    durationInFrames: 0.65 * fps,
  });

export const snappyReveal = (frame: number, fps: number, delaySeconds = 0) =>
  spring({
    frame: frame - delaySeconds * fps,
    fps,
    config: {damping: 22, stiffness: 220},
    durationInFrames: 0.5 * fps,
  });

export const fadeRange = (
  frame: number,
  input: [number, number],
  output: [number, number] = [0, 1],
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
