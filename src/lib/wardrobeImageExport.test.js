import test from "node:test";
import assert from "node:assert/strict";

import {
  encodeWardrobeExportCanvas,
  renderWardrobeImageExport
} from "./wardrobeImageExport.js";

test("wardrobe image export canvas encoder produces webp when supported", async () => {
  const canvas = {
    toBlob(callback, mimeType) {
      callback(new Blob(["webp"], { type: mimeType }));
    }
  };

  const result = await encodeWardrobeExportCanvas(canvas, {
    format: "webp",
    quality: 0.96
  });

  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.format, "webp");
  assert.equal(result.blob.type, "image/webp");
  assert.equal(result.fallbackUsed, false);
});

test("wardrobe image export canvas encoder falls back to png when webp is unsupported", async () => {
  const warnings = [];
  const canvas = {
    toBlob(callback, mimeType) {
      callback(new Blob([mimeType], { type: mimeType === "image/webp" ? "image/png" : mimeType }));
    }
  };

  const result = await encodeWardrobeExportCanvas(canvas, {
    format: "webp",
    quality: 0.96,
    fallbackFormat: "png",
    warningCollector: warnings
  });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.format, "png");
  assert.equal(result.blob.type, "image/png");
  assert.equal(result.fallbackUsed, true);
  assert.equal(warnings.length, 1);
});

test("wardrobe image export render reports webp format size dimensions and source types for ai profile", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalImage = globalThis.Image;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  class FakeImage {
    constructor() {
      this.naturalWidth = 1200;
      this.naturalHeight = 1600;
    }

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  globalThis.Image = FakeImage;
  globalThis.getComputedStyle = () => ({
    getPropertyValue() {
      return "";
    }
  });
  globalThis.fetch = async () => ({
    blob: async () => new Blob(["png"], { type: "image/png" })
  });
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            imageSmoothingEnabled: false,
            imageSmoothingQuality: "low",
            scale() {},
            fillRect() {},
            drawImage() {},
            save() {},
            beginPath() {},
            rect() {},
            clip() {},
            restore() {},
            fillText() {},
            measureText(text) {
              return { width: String(text).length * 8 };
            }
          };
        },
        toBlob(callback, mimeType) {
          callback(new Blob([mimeType], { type: mimeType }));
        },
        toDataURL(mimeType) {
          return `data:${mimeType};base64,AAAA`;
        }
      };
    }
  };

  try {
    const result = await renderWardrobeImageExport({
      items: [
        {
          id: "item-1",
          name: "Coat",
          brand: "Brand A",
          activeItemImageUuid: "img-1",
          itemImages: [
            {
              itemImageUuid: "img-1",
              canonicalAsset: {
                imageUrl: "data:image/png;base64,preview",
                images: {
                  original: { src: "data:image/png;base64,original" },
                  preview: { src: "data:image/png;base64,preview" }
                }
              }
            }
          ]
        }
      ],
      options: {
        showItemName: true,
        showBrand: true,
        showId: false,
        useCurrentSortOrder: true,
        shuffleItems: false
      },
      exportProfile: "ai",
      fileName: "wardrobe/current-wardrobe.webp"
    });

    assert.equal(result.fileName, "wardrobe/current-wardrobe.webp");
    assert.equal(result.mimeType, "image/webp");
    assert.equal(result.blob.type, "image/webp");
    assert.equal(result.report.format, "webp");
    assert.equal(result.report.quality, 0.96);
    assert.equal(result.report.qualityScale, 6);
    assert.equal(result.report.itemCount, 1);
    assert.equal(result.report.sizeBytes, result.blob.size);
    assert.equal(result.report.pixelWidth > 0, true);
    assert.equal(result.report.pixelHeight > 0, true);
    assert.equal(result.report.sourceType, "active-asset:original");
    assert.equal(result.report.sourceTypeCounts["active-asset:original"], 1);
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.Image = originalImage;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});

test("wardrobe image export keeps png as the default manual export format", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalImage = globalThis.Image;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  class FakeImage {
    constructor() {
      this.naturalWidth = 800;
      this.naturalHeight = 1000;
    }

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  globalThis.Image = FakeImage;
  globalThis.getComputedStyle = () => ({
    getPropertyValue() {
      return "";
    }
  });
  globalThis.fetch = async () => ({
    blob: async () => new Blob(["png"], { type: "image/png" })
  });
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            imageSmoothingEnabled: false,
            imageSmoothingQuality: "low",
            scale() {},
            fillRect() {},
            drawImage() {},
            save() {},
            beginPath() {},
            rect() {},
            clip() {},
            restore() {},
            fillText() {},
            measureText(text) {
              return { width: String(text).length * 8 };
            }
          };
        },
        toBlob(callback, mimeType) {
          callback(new Blob([mimeType], { type: mimeType }));
        },
        toDataURL(mimeType) {
          return `data:${mimeType};base64,AAAA`;
        }
      };
    }
  };

  try {
    const result = await renderWardrobeImageExport({
      items: [
        {
          id: "item-1",
          name: "Coat",
          imageUrl: "data:image/png;base64,preview"
        }
      ]
    });

    assert.equal(result.fileName.endsWith(".png"), true);
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.report.format, "png");
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.Image = originalImage;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});
