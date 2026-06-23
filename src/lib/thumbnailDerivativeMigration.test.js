import test from "node:test";
import assert from "node:assert/strict";

import { migrateFitpicThumbnailDerivatives, migrateWardrobeItemThumbnailDerivatives } from "./thumbnailDerivativeMigration.js";

test("migrateWardrobeItemThumbnailDerivatives rewrites canonical and mirrored thumbnails only", async () => {
  const item = {
    id: "item-1",
    itemUuid: "item-uuid-1",
    imageUrl: "data:image/webp;base64,legacy-display",
    images: {
      display: { src: "data:image/webp;base64,legacy-display" },
      preview: { src: "data:image/webp;base64,legacy-display" },
      thumbnail: { src: "data:image/webp;base64,legacy-thumb" }
    },
    itemImages: [
      {
        itemImageUuid: "item-image-1",
        parentItemUuid: "item-uuid-1",
        order: 0,
        canonicalAsset: {
          assetUuid: "asset-1",
          kind: "canonical",
          parentItemImageUuid: "item-image-1",
          order: 0,
          imageUrl: "data:image/webp;base64,legacy-display",
          images: {
            original: { src: "data:image/webp;base64,original" },
            display: { src: "data:image/webp;base64,legacy-display" },
            preview: { src: "data:image/webp;base64,legacy-display" },
            thumbnail: { src: "data:image/webp;base64,legacy-thumb", width: 480, height: 480, fileSize: 98000 }
          }
        },
        derivedAssets: [],
        activeImageAssetUuid: "asset-1"
      }
    ],
    activeItemImageUuid: "item-image-1"
  };

  const migrated = await migrateWardrobeItemThumbnailDerivatives(item, {
    buildThumbnailVariantFromSource: async (source) => ({
      src: `${source}-small`,
      mimeType: "image/webp",
      fileSize: 42000,
      width: 320,
      height: 320
    })
  });

  assert.equal(migrated.itemImages[0].canonicalAsset.images.display.src, "data:image/webp;base64,legacy-display");
  assert.equal(migrated.itemImages[0].canonicalAsset.images.original.src, "data:image/webp;base64,original");
  assert.equal(migrated.itemImages[0].canonicalAsset.images.thumbnail.src, "data:image/webp;base64,legacy-display-small");
  assert.equal(migrated.itemImages[0].canonicalAsset.images.thumbnail.fileSize, 42000);
  assert.equal(migrated.images.thumbnail.src, "data:image/webp;base64,legacy-display-small");
  assert.equal(migrated.imageUrl, "data:image/webp;base64,legacy-display");
});

test("migrateFitpicThumbnailDerivatives rewrites nested and mirrored fitpic thumbnails without changing display", async () => {
  const fitpic = {
    id: "fitpic-1",
    fitpicUuid: "fitpic-uuid-1",
    name: "Look",
    imageData: "data:image/webp;base64,fitpic-display",
    images: {
      original: "data:image/webp;base64,fitpic-original",
      display: "data:image/webp;base64,fitpic-display",
      preview: "data:image/webp;base64,fitpic-display",
      thumbnail: "data:image/webp;base64,fitpic-thumb"
    },
    primaryImageUuid: "fitpic-image-1",
    fitpicImages: [
      {
        fitpicImageUuid: "fitpic-image-1",
        parentFitpicUuid: "fitpic-uuid-1",
        order: 0,
        imageData: "data:image/webp;base64,fitpic-display",
        images: {
          original: "data:image/webp;base64,fitpic-original",
          display: "data:image/webp;base64,fitpic-display",
          preview: "data:image/webp;base64,fitpic-display",
          thumbnail: "data:image/webp;base64,fitpic-thumb"
        }
      }
    ]
  };

  const migrated = await migrateFitpicThumbnailDerivatives(fitpic, {
    buildThumbnailVariantFromSource: async (source) => ({
      src: `${source}-small`,
      mimeType: "image/webp",
      fileSize: 38000,
      width: 320,
      height: 320
    })
  });

  assert.equal(migrated.fitpicImages[0].images.display, "data:image/webp;base64,fitpic-display");
  assert.equal(migrated.fitpicImages[0].images.original, "data:image/webp;base64,fitpic-original");
  assert.equal(migrated.fitpicImages[0].images.thumbnail, "data:image/webp;base64,fitpic-display-small");
  assert.equal(migrated.images.display, "data:image/webp;base64,fitpic-display");
  assert.equal(migrated.images.thumbnail, "data:image/webp;base64,fitpic-display-small");
  assert.equal(migrated.imageData, "data:image/webp;base64,fitpic-display");
});
