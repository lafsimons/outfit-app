import test from "node:test";
import assert from "node:assert/strict";

import {
  getImageFilename,
  getItemImageStyle,
  getManagedImageDrawBox,
  getManagedImageFrameStyle,
  getManagedImageSourceRect,
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

test("managed image style preserves current CSS variable outputs", () => {
  assert.deepEqual(getItemImageStyle({
    imageFrameScale: 125,
    imageScale: 150,
    imageOffsetX: 12,
    imageOffsetY: -7
  }, {
    useFrameScale: true,
    normalizeToFrameScale: true,
    usePresentation: true
  }), {
    "--managed-frame-scale": 1.25,
    "--managed-scale": 1.2,
    "--managed-offset-x": "12%",
    "--managed-offset-y": "-7%"
  });

  assert.deepEqual(getItemImageStyle({
    imageFrameScale: 125,
    imageScale: 150,
    imageOffsetX: 12,
    imageOffsetY: -7
  }), {
    "--managed-frame-scale": 1,
    "--managed-scale": 1,
    "--managed-offset-x": "0%",
    "--managed-offset-y": "0%"
  });
});

test("managed image source rect preserves current crop math", () => {
  const item = {
    imageCropX: 10,
    imageCropY: 20,
    imageCropWidth: 80,
    imageCropHeight: 50
  };

  assert.deepEqual(getManagedImageSourceRect(item, 400, 200, { useCrop: true }), {
    x: 40,
    y: 40,
    width: 320,
    height: 100
  });

  assert.deepEqual(getManagedImageSourceRect(item, 400, 200), {
    x: 0,
    y: 0,
    width: 400,
    height: 200
  });
});

test("managed image frame style preserves current aspect and crop CSS values", () => {
  const item = {
    imageCropX: 10,
    imageCropY: 20,
    imageCropWidth: 80,
    imageCropHeight: 50,
    imageFrameScale: 125,
    imageScale: 150,
    imageOffsetX: 12,
    imageOffsetY: -7
  };

  assert.deepEqual(getManagedImageFrameStyle(item, {
    naturalWidth: 400,
    naturalHeight: 200
  }, {
    useCrop: true,
    usePresentation: true,
    useFrameScale: true,
    normalizeToFrameScale: true
  }), {
    aspectRatio: "3.2",
    "--managed-crop-aspect": "3.2",
    "--managed-base-width": "125%",
    "--managed-base-height": "200%",
    "--managed-base-left": "-12.5%",
    "--managed-base-top": "-40%",
    "--managed-frame-scale": 1.25,
    "--managed-scale": 1.2,
    "--managed-offset-x": "12%",
    "--managed-offset-y": "-7%"
  });
});

test("managed image draw box preserves current preview/export geometry math", () => {
  const item = {
    imageCropX: 10,
    imageCropY: 20,
    imageCropWidth: 80,
    imageCropHeight: 50,
    imageFrameScale: 125,
    imageScale: 150,
    imageOffsetX: 10,
    imageOffsetY: -5
  };
  const image = {
    naturalWidth: 400,
    naturalHeight: 200
  };

  assert.deepEqual(
    getManagedImageDrawBox(item, image, 20, 30, 160, 120, {
      useCrop: true,
      usePresentation: true
    }),
    {
      sourceRect: {
        x: 40,
        y: 40,
        width: 320,
        height: 100
      },
      drawX: 4,
      drawY: -6,
      drawWidth: 240,
      drawHeight: 120
    }
  );
});
