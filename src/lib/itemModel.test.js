import test from "node:test";
import assert from "node:assert/strict";

import { createUniqueItemId, normalizeItem } from "./itemModel.js";

const baseEmptyForm = {
  id: "",
  name: "",
  imageUrl: "",
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
