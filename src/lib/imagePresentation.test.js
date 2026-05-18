import test from "node:test";
import assert from "node:assert/strict";

import {
  getImageFilename,
  getNormalizedImageCrop,
  getVisibleAlphaBounds,
  itemNeedsImageBake,
  normalizeImageCropStart,
  normalizeImageCropSize,
  normalizeImageFrameScale,
  normalizeImageOffset,
  normalizeImageScale,
  stripViteHash
} from "./imagePresentation.js";

test("image filename helpers preserve decoded names and strip Vite hashes", () => {
  assert.equal(getImageFilename("/assets/Subject%20(4)%204-abc123.png?x=1#y"), "Subject (4) 4-abc123.png");
  assert.equal(stripViteHash("Subject (4) 4-abc123.png"), "Subject (4) 4.png");
  assert.equal(stripViteHash("plain.png"), "plain.png");
});

test("image numeric normalizers preserve current bounds", () => {
  assert.equal(normalizeImageScale("999"), 180);
  assert.equal(normalizeImageScale("bad"), 100);
  assert.equal(normalizeImageFrameScale("1"), 20);
  assert.equal(normalizeImageFrameScale("bad"), 100);
  assert.equal(normalizeImageOffset("99"), 50);
  assert.equal(normalizeImageOffset("-99"), -50);
  assert.equal(normalizeImageCropSize("0"), 1);
  assert.equal(normalizeImageCropSize("bad"), 100);
  assert.equal(normalizeImageCropStart("99", 30), 70);
  assert.equal(normalizeImageCropStart("bad", 30), 0);
});

test("crop normalization and bake detection preserve current behavior", () => {
  assert.deepEqual(
    getNormalizedImageCrop({
      imageCropX: 90,
      imageCropY: -2,
      imageCropWidth: 20,
      imageCropHeight: 200
    }),
    { x: 80, y: 0, width: 20, height: 100 }
  );

  assert.equal(
    itemNeedsImageBake({
      imageUrl: "data:image/png;base64,abc",
      imageScale: 100,
      imageFrameScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0
    }),
    false
  );

  assert.equal(
    itemNeedsImageBake({
      imageUrl: "data:image/png;base64,abc",
      imageScale: 110,
      imageFrameScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0
    }),
    true
  );
});

test("visible alpha bounds returns null for transparent data and bounds for opaque pixels", () => {
  assert.equal(getVisibleAlphaBounds(new Uint8ClampedArray(16), 2, 2), null);

  const data = new Uint8ClampedArray(4 * 4 * 4);
  const index = (1 * 4 + 2) * 4 + 3;
  data[index] = 255;

  assert.deepEqual(getVisibleAlphaBounds(data, 4, 4), {
    left: 2,
    top: 1,
    right: 3,
    bottom: 2
  });
});
