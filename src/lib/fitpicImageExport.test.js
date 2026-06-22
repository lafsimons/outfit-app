import test from "node:test";
import assert from "node:assert/strict";

import { encodeFitpicExportCanvas, renderFitpicImageExport } from "./fitpicImageExport.js";

test("fitpic image export canvas encoder produces webp when supported", async () => {
  const canvas = {
    toBlob(callback, mimeType) {
      callback(new Blob(["webp"], { type: mimeType }));
    }
  };

  const result = await encodeFitpicExportCanvas(canvas, {
    format: "webp",
    quality: 0.85
  });

  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.format, "webp");
  assert.equal(result.blob.type, "image/webp");
  assert.equal(result.fallbackUsed, false);
});

test("fitpic image export canvas encoder falls back to png when webp is unsupported", async () => {
  const warnings = [];
  const canvas = {
    toBlob(callback, mimeType) {
      callback(new Blob([mimeType], { type: mimeType === "image/webp" ? "image/png" : mimeType }));
    }
  };

  const result = await encodeFitpicExportCanvas(canvas, {
    format: "webp",
    quality: 0.85,
    fallbackFormat: "png",
    warningCollector: warnings
  });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.format, "png");
  assert.equal(result.blob.type, "image/png");
  assert.equal(result.fallbackUsed, true);
  assert.equal(warnings.length, 1);
});

test("fitpic image export render respects ai webp profile detail cap and reports size", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalImage = globalThis.Image;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  class FakeImage {
    constructor() {
      this.naturalWidth = 1200;
      this.naturalHeight = 900;
    }

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  const contexts = [];

  function createContext() {
    return {
      fillStyle: "",
      strokeStyle: "",
      font: "",
      textAlign: "",
      textBaseline: "",
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      scale() {},
      fillRect() {},
      strokeRect() {},
      drawImage() {},
      fillText() {},
      measureText(text) {
        return { width: String(text).length * 8 };
      }
    };
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
    createElement(tag) {
      assert.equal(tag, "canvas");
      const context = createContext();
      const canvas = {
        width: 0,
        height: 0,
        getContext(kind) {
          assert.equal(kind, "2d");
          contexts.push(context);
          return context;
        },
        toBlob(callback, mimeType) {
          callback(new Blob([mimeType], { type: mimeType }));
        },
        toDataURL(mimeType) {
          return `data:${mimeType};base64,AAAA`;
        }
      };
      return canvas;
    }
  };

  try {
    const result = await renderFitpicImageExport({
      fitpics: [
        {
          id: "fitpic-1",
          name: "Fitpic",
          fitpicImages: Array.from({ length: 8 }, (_, index) => ({
            fitpicImageUuid: `image-${index + 1}`,
            order: index,
            images: { preview: `data:image/webp;base64,${index + 1}` }
          }))
        }
      ],
      options: {
        scope: "current",
        shuffleFitpics: false,
        useCurrentSortOrder: true,
        showTitle: true,
        showDetailGrid: true,
        showTags: false,
        showFitDate: false,
        imageMode: "default",
        showDescription: false
      },
      exportProfile: "ai",
      fileName: "fitpics-reference.webp"
    });

    assert.equal(result.mimeType, "image/webp");
    assert.equal(result.blob.type, "image/webp");
    assert.equal(result.fileName, "fitpics-reference.webp");
    assert.equal(result.report.maxDetailImages, 4);
    assert.equal(result.report.qualityScale, 5);
    assert.equal(result.report.quality, 0.96);
    assert.equal(result.report.sizeBytes, result.blob.size);
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.Image = originalImage;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});

test("fitpic details-only export skips single-image fitpics and exports only secondary images", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalImage = globalThis.Image;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  const loadedSources = [];

  class FakeImage {
    constructor() {
      this.naturalWidth = 1200;
      this.naturalHeight = 900;
    }

    set src(value) {
      loadedSources.push(value);
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
            strokeStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            imageSmoothingEnabled: false,
            imageSmoothingQuality: "low",
            scale() {},
            fillRect() {},
            strokeRect() {},
            drawImage() {},
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
    const result = await renderFitpicImageExport({
      fitpics: [
        {
          id: "single",
          name: "Single",
          description: "Should be skipped",
          fitpicImages: [
            {
              fitpicImageUuid: "single-1",
              order: 0,
              images: { preview: "data:image/webp;base64,primary-single" }
            }
          ]
        },
        {
          id: "multi",
          name: "Multi",
          description: "Should render details only",
          primaryImageUuid: "multi-1",
          fitpicImages: [
            {
              fitpicImageUuid: "multi-1",
              order: 0,
              images: { preview: "data:image/webp;base64,primary-multi" }
            },
            {
              fitpicImageUuid: "multi-2",
              order: 1,
              images: { preview: "data:image/webp;base64,detail-a" }
            },
            {
              fitpicImageUuid: "multi-3",
              order: 2,
              images: { preview: "data:image/webp;base64,detail-b" }
            }
          ]
        }
      ],
      options: {
        scope: "current",
        shuffleFitpics: false,
        useCurrentSortOrder: true,
        showTitle: true,
        showDetailGrid: true,
        showTags: false,
        showFitDate: false,
        imageMode: "detailsOnly",
        showDescription: false
      },
      exportProfile: "detailsAi",
      fileName: "fitpics-details.webp"
    });

    assert.equal(result.fileName, "fitpics-details.webp");
    assert.equal(result.report.fitpicCount, 1);
    assert.equal(result.report.skippedFitpicCount, 1);
    assert.equal(result.report.qualityScale, 5);
    assert.equal(result.report.quality, 0.96);
    assert.equal(result.report.maxDetailImages, Number.POSITIVE_INFINITY);
    assert.equal(loadedSources.includes("data:image/webp;base64,primary-single"), false);
    assert.equal(loadedSources.includes("data:image/webp;base64,primary-multi"), false);
    assert.equal(loadedSources.includes("data:image/webp;base64,detail-a"), true);
    assert.equal(loadedSources.includes("data:image/webp;base64,detail-b"), true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.Image = originalImage;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});
