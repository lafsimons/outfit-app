import test from "node:test";
import assert from "node:assert/strict";

import {
  buildManagedImageMetricsCacheKey,
  getImageFilename,
  getItemImageStyle,
  getManagedImageDrawBox,
  getManagedImageFrameStyle,
  getManagedImageSourceRect,
  getVisibleContentBounds,
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

test("managed image metrics cache key prefers stable asset identity for data urls", () => {
  assert.equal(
    buildManagedImageMetricsCacheKey({
      resolvedImageUrl: "data:image/png;base64,abc",
      assetUuid: "asset-123",
      itemImageUuid: "item-image-1",
      itemUuid: "item-uuid-1",
      itemId: "item-1"
    }),
    "asset-123"
  );

  assert.equal(
    buildManagedImageMetricsCacheKey({
      resolvedImageUrl: "data:image/png;base64,abc",
      itemImageUuid: "item-image-1"
    }),
    "item-image-1"
  );

  assert.equal(
    buildManagedImageMetricsCacheKey({
      resolvedImageUrl: "/assets/top.png",
      assetUuid: "asset-123"
    }),
    "asset-123"
  );

  assert.equal(
    buildManagedImageMetricsCacheKey({
      resolvedImageUrl: "/assets/top.png"
    }),
    "/assets/top.png"
  );
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

test("visible content bounds trims opaque uniform corner background", () => {
  const width = 5;
  const height = 5;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 40;
      data[offset + 1] = 40;
      data[offset + 2] = 40;
      data[offset + 3] = 255;
    }
  }

  assert.deepEqual(getVisibleContentBounds(data, width, height), {
    left: 1,
    top: 1,
    right: 4,
    bottom: 4
  });
});

test("visible content bounds falls back to alpha bounds when corner colors are inconsistent", () => {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);

  const corners = [
    { x: 0, y: 0, rgb: [255, 255, 255] },
    { x: 3, y: 0, rgb: [255, 0, 0] },
    { x: 0, y: 3, rgb: [0, 255, 0] },
    { x: 3, y: 3, rgb: [0, 0, 255] }
  ];

  corners.forEach(({ x, y, rgb }) => {
    const offset = (y * width + x) * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  });

  const centerOffset = (1 * width + 1) * 4;
  data[centerOffset] = 20;
  data[centerOffset + 1] = 20;
  data[centerOffset + 2] = 20;
  data[centerOffset + 3] = 255;

  assert.deepEqual(getVisibleContentBounds(data, width, height), {
    left: 0,
    top: 0,
    right: 4,
    bottom: 4
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
