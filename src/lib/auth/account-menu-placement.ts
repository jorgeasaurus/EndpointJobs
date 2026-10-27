export const accountMenuMargin = 12;
export const accountMenuGap = 8;
export const accountMenuPreferredWidth = 280;

export type AccountMenuRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type AccountMenuViewport = {
  width: number;
  height: number;
};

/**
 * The panel used to be absolutely positioned with its right edge on the
 * trigger. On a phone the trigger is a 44px icon left of the other header
 * controls, so a ~273px panel started near x = -44. Keep the right-edge
 * anchor, then shift and narrow until both sides keep the margin.
 */
export function placeAccountMenuPanel(
  trigger: AccountMenuRect,
  viewport: AccountMenuViewport,
  panel: { width: number; height: number },
  margin = accountMenuMargin
) {
  const width = Math.min(panel.width, Math.max(0, viewport.width - margin * 2));
  const maxLeft = viewport.width - margin - width;
  let left = trigger.right - width;
  if (maxLeft < margin) left = margin;
  else left = Math.min(Math.max(left, margin), maxLeft);

  let top = trigger.bottom + accountMenuGap;
  const bottomLimit = viewport.height - margin - panel.height;
  if (top > bottomLimit) {
    const above = trigger.top - accountMenuGap - panel.height;
    top = above >= margin ? above : Math.max(margin, bottomLimit);
  }

  return { top, left, width };
}

export function accountMenuWidth(viewportWidth: number, margin = accountMenuMargin) {
  return Math.min(accountMenuPreferredWidth, Math.max(0, viewportWidth - margin * 2));
}
