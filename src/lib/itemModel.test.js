import test from "node:test";
import assert from "node:assert/strict";

import {
  createUniqueItemId,
  getWardrobePreviewMetadata,
  itemNeedsItemUuidMigration,
  normalizeItem
} from "./itemModel.js";

const baseEmptyForm = {
  id: "",
  itemUuid: "",
  name: "",
  imageUrl: "",
  images: {
    original: { src: "" },
    preview: { src: "" },
    thumbnail: { src: "" }
  },
  originalPreserved: false,
  imageScale: 100,
  imageFrameScale: 100,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageCropX: 0,
  imageCropY: 0,
  imageCropWidth: 100,
  imageCropHeight: 100,
  value: "",
  retailValue: "",
  brand: "",
  type: "",
  size: "",
  favorite: false,
  garmentType: "Top",
  layerType: "Both",
  accessorySlot: "",
  color: "",
  weight: "",
  list: "Wardrobe",
  quantity: 1,
  styleTags: [],
  climateTags: []
};

test("createUniqueItemId preserves existing id semantics with numeric suffixes", () => {
  const items = [
    { id: "top_inner_shirt_brand_name_m_black" },
    { id: "top_inner_shirt_brand_name_m_black_2" }
  ];

  const nextId = createUniqueItemId(
    {
      garmentType: "Top",
      layerType: "Inner",
      type: "Shirt",
      brand: "Brand",
      name: "Name",
      size: "M",
      color: "Black"
    },
    items
  );

  assert.equal(nextId, "top_inner_shirt_brand_name_m_black_3");
});

test("normalizeItem preserves timestamps and applies default metadata corrections", () => {
  const normalized = normalizeItem(
    {
      id: "headwear_cap_default_beige_os_beige",
      imageUrl: "/images/headwear_cap_beige.png",
      createdAt: "2024-01-02T03:04:05.000Z",
      updatedAt: "2024-01-03T03:04:05.000Z"
    },
    {
      emptyForm: baseEmptyForm,
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.name, "R18C1 Shallow Cap Reed Linen");
  assert.equal(normalized.brand, "Man-tle");
  assert.equal(normalized.type, "Cap");
  assert.equal(normalized.color, "Beige");
  assert.equal(normalized.list, "Wardrobe");
  assert.equal(normalized.createdAt, "2024-01-02T03:04:05.000Z");
  assert.equal(normalized.updatedAt, "2024-01-03T03:04:05.000Z");
});

test("normalizeItem synthesizes preview and thumbnail from legacy imageUrl without claiming original preservation", () => {
  const normalized = normalizeItem(
    {
      id: "legacy_item",
      imageUrl: "data:image/png;base64,legacy"
    },
    {
      emptyForm: baseEmptyForm,
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.imageUrl, "data:image/png;base64,legacy");
  assert.equal(normalized.images.original.src, "");
  assert.equal(normalized.images.preview.src, "data:image/png;base64,legacy");
  assert.equal(normalized.images.thumbnail.src, "data:image/png;base64,legacy");
  assert.equal(normalized.originalPreserved, false);
});

test("normalizeItem preserves canonical images fields and mirrors preview src into imageUrl", () => {
  const normalized = normalizeItem(
    {
      id: "canonical_item",
      images: {
        original: { src: "data:image/png;base64,original", width: 1200 },
        preview: { src: "data:image/png;base64,preview", dominantColor: "#112233" },
        thumbnail: { src: "data:image/png;base64,thumb", blurHash: "abc123" },
        extra: { note: "keep" }
      },
      originalPreserved: true
    },
    {
      emptyForm: baseEmptyForm,
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.imageUrl, "data:image/png;base64,preview");
  assert.equal(normalized.images.original.src, "data:image/png;base64,original");
  assert.equal(normalized.images.original.width, 1200);
  assert.equal(normalized.images.preview.src, "data:image/png;base64,preview");
  assert.equal(normalized.images.preview.dominantColor, "#112233");
  assert.equal(normalized.images.thumbnail.src, "data:image/png;base64,thumb");
  assert.equal(normalized.images.thumbnail.blurHash, "abc123");
  assert.deepEqual(normalized.images.extra, { note: "keep" });
  assert.equal(normalized.originalPreserved, true);
});

test("normalizeItem preserves an existing itemUuid", () => {
  const normalized = normalizeItem(
    {
      id: "existing_item",
      itemUuid: "stable-item-uuid",
      imageUrl: "data:image/png;base64,preview"
    },
    {
      emptyForm: baseEmptyForm,
      createItemUuid: () => {
        throw new Error("createItemUuid should not run when itemUuid already exists");
      },
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.itemUuid, "stable-item-uuid");
});

test("normalizeItem generates an itemUuid for existing items that are missing one", () => {
  const normalized = normalizeItem(
    {
      id: "existing_item",
      imageUrl: "data:image/png;base64,preview"
    },
    {
      emptyForm: baseEmptyForm,
      createItemUuid: () => "generated-item-uuid",
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.itemUuid, "generated-item-uuid");
});

test("normalizeItem preserves id while adding itemUuid", () => {
  const normalized = normalizeItem(
    {
      id: "legacy_id_value",
      imageUrl: "data:image/png;base64,preview"
    },
    {
      emptyForm: baseEmptyForm,
      createItemUuid: () => "generated-item-uuid",
      resolveImageUrl: (value) => value,
      normalizeImageFrameScale: (value) => value ?? 100,
      normalizeImageScale: (value) => value ?? 100,
      normalizeImageOffset: (value) => value ?? 0,
      getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
    }
  );

  assert.equal(normalized.id, "legacy_id_value");
  assert.equal(normalized.itemUuid, "generated-item-uuid");
});

test("itemUuid migration detection stays false when normalization keeps the existing itemUuid", () => {
  const originalItem = {
    id: "existing_item",
    itemUuid: "stable-item-uuid",
    imageUrl: "data:image/png;base64,preview"
  };
  const normalized = normalizeItem(originalItem, {
    emptyForm: baseEmptyForm,
    createItemUuid: () => {
      throw new Error("createItemUuid should not run when itemUuid already exists");
    },
    resolveImageUrl: (value) => value,
    normalizeImageFrameScale: (value) => value ?? 100,
    normalizeImageScale: (value) => value ?? 100,
    normalizeImageOffset: (value) => value ?? 0,
    getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
  });

  assert.equal(itemNeedsItemUuidMigration(originalItem, normalized), false);
});

test("getWardrobePreviewMetadata returns basic display fields without empty placeholders", () => {
  assert.deepEqual(
    getWardrobePreviewMetadata({
      garmentType: "Top",
      layerType: "Inner",
      type: "Shirt",
      color: "Blue",
      size: "M",
      list: "Wardrobe",
      value: "120",
      retailValue: "",
      quantity: 2
    }),
    [
      { label: "Garment", value: "Top" },
      { label: "Type", value: "Shirt" },
      { label: "Color", value: "Blue" },
      { label: "Size", value: "M" },
      { label: "List", value: "Wardrobe" },
      { label: "Paid", value: "120 €" },
      { label: "Quantity", value: "2" }
    ]
  );
});
