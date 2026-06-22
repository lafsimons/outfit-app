import test from "node:test";
import assert from "node:assert/strict";

import {
  WARDROBE_SPREAD_HIGH_QUALITY_SCALE,
  createWardrobeSpreadExportOptions,
  getWardrobeSpreadExportImageSource,
  getWardrobeSpreadExportImageUrl,
  getWardrobeSpreadExportLabelRowCount,
  getWardrobeSpreadExportLabelRows,
  getWardrobeSpreadExportOrderedItems,
  getWardrobeSpreadExportRenderConfig
} from "./wardrobeSpreadExport.js";

test("wardrobe spread export prefers the active asset original before lower-quality fallbacks", () => {
  assert.deepEqual(
    getWardrobeSpreadExportImageSource({
      activeItemImageUuid: "image-1",
      itemImages: [
        {
          itemImageUuid: "image-1",
          canonicalAsset: {
            imageUrl: "data:image/png;base64,preview",
            images: {
              original: { src: "data:image/png;base64,original" },
              preview: { src: "data:image/png;base64,preview" },
              thumbnail: { src: "data:image/png;base64,thumb" }
            }
          }
        }
      ]
    }),
    {
      src: "data:image/png;base64,original",
      sourceType: "active-asset:original"
    }
  );
});

test("wardrobe spread export falls back through active preview and item-level sources", () => {
  assert.equal(
    getWardrobeSpreadExportImageUrl({
      activeItemImageUuid: "image-1",
      itemImages: [
        {
          itemImageUuid: "image-1",
          canonicalAsset: {
            imageUrl: "data:image/png;base64,asset-preview",
            images: {
              preview: { src: "data:image/png;base64,asset-preview" },
              thumbnail: { src: "data:image/png;base64,asset-thumb" }
            }
          }
        }
      ],
      imageUrl: "data:image/png;base64,item-image-url",
      images: {
        preview: { src: "data:image/png;base64,item-preview" },
        thumbnail: { src: "data:image/png;base64,item-thumb" }
      }
    }),
    "data:image/png;base64,asset-preview"
  );

  assert.equal(
    getWardrobeSpreadExportImageUrl({
      imageUrl: "data:image/png;base64,image-url",
      images: {
        original: { src: "data:image/png;base64,original" },
        preview: { src: "data:image/png;base64,preview" },
        thumbnail: { src: "data:image/png;base64,thumb" }
      }
    }),
    "data:image/png;base64,original"
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

test("wardrobe spread export keeps compact preset aligned with current behavior", () => {
  const options = createWardrobeSpreadExportOptions("compact");
  const config = getWardrobeSpreadExportRenderConfig(12, {
    labelRowCount: getWardrobeSpreadExportLabelRowCount(options)
  });

  assert.deepEqual(options, {
    shuffleItems: true,
    useCurrentSortOrder: false,
    showItemName: false,
    showBrand: false,
    showId: false
  });
  assert.equal(config.canvasHeight, 658);
});

test("wardrobe spread export reference preset uses current sort order", () => {
  assert.deepEqual(createWardrobeSpreadExportOptions("reference"), {
    shuffleItems: false,
    useCurrentSortOrder: true,
    showItemName: true,
    showBrand: false,
    showId: false
  });
});

test("wardrobe spread export ordered items preserves visible order for current-sort mode", () => {
  const items = [{ id: "first" }, { id: "second" }, { id: "third" }];

  assert.deepEqual(
    getWardrobeSpreadExportOrderedItems(items, createWardrobeSpreadExportOptions("reference")).map((item) => item.id),
    ["first", "second", "third"]
  );
});

test("wardrobe spread export ordered items still shuffles for compact mode", () => {
  const items = [{ id: "first" }, { id: "second" }, { id: "third" }, { id: "fourth" }];
  const randomValues = [0.4, 0.1, 0.8];
  let randomIndex = 0;

  const orderedIds = getWardrobeSpreadExportOrderedItems(
    items,
    createWardrobeSpreadExportOptions("compact"),
    () => randomValues[randomIndex++]
  ).map((item) => item.id);

  assert.notDeepEqual(orderedIds, items.map((item) => item.id));
  assert.deepEqual([...orderedIds].sort(), ["first", "fourth", "second", "third"]);
});

test("wardrobe spread export label rows render name, brand, and id in priority order", () => {
  assert.deepEqual(
    getWardrobeSpreadExportLabelRows(
      {
        id: "bottom_jeans_taiga_takahashi_lot_704_denim_trousers_34_indigo",
        name: "Lot.704 (washed)",
        brand: "Taiga Takahashi"
      },
      {
        showItemName: true,
        showBrand: true,
        showId: true,
        useCurrentSortOrder: true
      }
    ),
    [
      { key: "name", text: "Lot.704 (washed)" },
      { key: "brand", text: "Taiga Takahashi" },
      { key: "id", text: "bottom_jeans_taiga_takahashi_lot_704_denim_trousers_34_indigo" }
    ]
  );
});

test("wardrobe spread export can render each label type independently", () => {
  const item = {
    id: "bottom_jeans_taiga_takahashi_lot_704_denim_trousers_34_indigo",
    name: "Lot.704 (washed)",
    brand: "Taiga Takahashi"
  };

  assert.deepEqual(
    getWardrobeSpreadExportLabelRows(item, { showItemName: true, useCurrentSortOrder: true }),
    [{ key: "name", text: "Lot.704 (washed)" }]
  );
  assert.deepEqual(
    getWardrobeSpreadExportLabelRows(item, { showBrand: true, useCurrentSortOrder: true }),
    [{ key: "brand", text: "Taiga Takahashi" }]
  );
  assert.deepEqual(
    getWardrobeSpreadExportLabelRows(item, { showId: true, useCurrentSortOrder: true }),
    [{ key: "id", text: "bottom_jeans_taiga_takahashi_lot_704_denim_trousers_34_indigo" }]
  );
});

test("wardrobe spread export render config expands cell height for label rows", () => {
  const config = getWardrobeSpreadExportRenderConfig(12, { labelRowCount: 3 });

  assert.equal(config.cellHeight, 248);
  assert.equal(config.canvasHeight, 832);
  assert.equal(config.pixelHeight, 2496);
});
