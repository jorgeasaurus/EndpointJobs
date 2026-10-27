import assert from "node:assert/strict";
import test from "node:test";

import {
  accountMenuGap,
  accountMenuMargin,
  accountMenuWidth,
  placeAccountMenuPanel
} from "./account-menu-placement";

test("the account menu stays inside a 390px viewport when right-aligning would sit at x=-44", () => {
  const viewport = { width: 390, height: 844 };
  const width = accountMenuWidth(viewport.width);
  const triggerRight = width - 44;
  const placed = placeAccountMenuPanel(
    { top: 8, right: triggerRight, bottom: 52, left: triggerRight - 44 },
    viewport,
    { width, height: 96 }
  );

  assert.equal(placed.left, accountMenuMargin);
  assert.equal(placed.width, 280);
  assert.ok(placed.left + placed.width <= viewport.width - accountMenuMargin);
  assert.ok(placed.top >= accountMenuMargin);
  assert.ok(placed.top + 96 <= viewport.height - accountMenuMargin);
  assert.notEqual(placed.left, -44);
});

test("the account menu anchors to the trigger's right edge on a 1280px viewport", () => {
  const viewport = { width: 1280, height: 800 };
  const trigger = { top: 18, right: 1128, bottom: 62, left: 1084 };
  const placed = placeAccountMenuPanel(trigger, viewport, { width: accountMenuWidth(viewport.width), height: 96 });

  assert.equal(placed.left + placed.width, trigger.right);
  assert.equal(placed.top, trigger.bottom + accountMenuGap);
  assert.ok(placed.left >= accountMenuMargin);
  assert.ok(placed.left + placed.width <= viewport.width - accountMenuMargin);
});

test("a trigger flush with the right edge still keeps the margin", () => {
  const viewport = { width: 1280, height: 800 };
  const placed = placeAccountMenuPanel(
    { top: 18, right: 1276, bottom: 62, left: 1232 },
    viewport,
    { width: 280, height: 96 }
  );

  assert.equal(placed.left + placed.width, viewport.width - accountMenuMargin);
  assert.ok(placed.left >= accountMenuMargin);
});

test("a short viewport flips the panel above the trigger", () => {
  const viewport = { width: 1280, height: 200 };
  const trigger = { top: 140, right: 400, bottom: 184, left: 300 };
  const placed = placeAccountMenuPanel(trigger, viewport, { width: 280, height: 96 });

  assert.equal(placed.top, trigger.top - accountMenuGap - 96);
  assert.ok(placed.top >= accountMenuMargin);
  assert.ok(placed.top + 96 <= viewport.height - accountMenuMargin);
});

test("the panel narrows when 280px would leave no margin", () => {
  const viewport = { width: 200, height: 800 };
  const placed = placeAccountMenuPanel(
    { top: 0, right: 180, bottom: 44, left: 136 },
    viewport,
    { width: 280, height: 80 }
  );

  assert.equal(placed.width, 176);
  assert.ok(placed.left >= accountMenuMargin);
  assert.ok(placed.left + placed.width <= viewport.width - accountMenuMargin);
});
