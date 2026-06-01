import test from "node:test";
import assert from "node:assert/strict";

import {
  WARDROBE_SPREAD_HIGH_QUALITY_SCALE,
  getWardrobeSpreadExportImageUrl,
  getWardrobeSpreadExportRenderConfig
} from "./wardrobeSpreadExport.js";

test("wardrobe spread export prefers display then preview and ignores thumbnail", () => {
  assert.equal(
    getWardrobeSpreadExportImageUrl({
      imageUrl: "data:image/png;base64,image-url",
      images: {
        display: { src: "data:image/png;base64,display" },
        preview: { src: "data:image/png;base64,preview" },
        thumbnail: { src: "data:image/png;base64,thumb" }
      }
    }),
    "data:image/png;base64,display"
  );

  assert.equal(
    getWardrobeSpreadExportImageUrl({
      imageUrl: "data:image/png;base64,image-url",
      images: {
        preview: { src: "data:image/png;base64,preview" },
        thumbnail: { src: "data:image/png;base64,thumb" }
      }
    }),
    "data:image/png;base64,preview"
  );
});

test("wardrobe spread export falls back to imageUrl for legacy items", () => {
  assert.equal(
    getWardrobeSpreadExportImageUrl({
      imageUrl: "data:image/png;base64,legacy",
      images: {
        thumbnail: { src: "data:image/png;base64,thumb" }
      }
    }),
    "data:image/png;base64,legacy"
  );
});

test("wardrobe spread export render config defaults to a larger high-quality canvas", () => {
  const config = getWardrobeSpreadExportRenderConfig(12);

  assert.equal(config.qualityScale, WARDROBE_SPREAD_HIGH_QUALITY_SCALE);
  assert.equal(config.exportScale, WARDROBE_SPREAD_HIGH_QUALITY_SCALE);
  assert.equal(config.canvasWidth, 848);
  assert.equal(config.canvasHeight, 658);
  assert.equal(config.pixelWidth, 2544);
  assert.equal(config.pixelHeight, 1974);
});

test("wardrobe spread export render config scales down only when canvas limits require it", () => {
  const config = getWardrobeSpreadExportRenderConfig(5000, {
    maxCanvasDimension: 4096,
    maxCanvasPixels: 16_000_000
  });

  assert.ok(config.exportScale < WARDROBE_SPREAD_HIGH_QUALITY_SCALE);
  assert.ok(config.pixelWidth <= 4096);
  assert.ok(config.pixelHeight <= 4096);
  assert.ok(config.pixelWidth * config.pixelHeight <= 16_000_000);
});
