import test from "node:test";
import assert from "node:assert/strict";
import { getFilterMenuPosition } from "./filterMenuPosition.js";

test("dropdown opens upward near the bottom and stays within viewport", () => {
  const result = getFilterMenuPosition({ left: 20, top: 660, bottom: 700 }, { width: 400, height: 740 });
  assert.equal(result.transform, "translateY(-100%)");
  assert.ok(result.top - result.maxHeight >= 8);
  assert.ok(result.top <= 732);
});
test("dropdown opens below when there is room and clamps the right edge", () => {
  const result = getFilterMenuPosition({ left: 350, top: 50, bottom: 90 }, { width: 400, height: 740 });
  assert.equal(result.transform, "none");
  assert.equal(result.top, 94);
  assert.equal(result.left + result.width, 392);
});
test("dropdown shrinks to a small visible viewport such as an open keyboard", () => {
  const result = getFilterMenuPosition({ left: 10, top: 170, bottom: 200 }, { width: 240, height: 220, top: 30 });
  assert.ok(result.width <= 224);
  assert.ok(result.top - result.maxHeight >= 38);
  assert.ok(result.left >= 8);
});
