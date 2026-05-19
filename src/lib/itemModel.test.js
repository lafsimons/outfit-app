import test from "node:test";
import assert from "node:assert/strict";

import {
  createUniqueItemId,
  getWardrobePreviewMetadata,
  itemNeedsImportMetadataMigration,
  itemNeedsItemUuidMigration,
  normalizeItem
} from "./itemModel.js";

const baseEmptyForm = {
  id: "",
  itemUuid: "",
  importedAt: "",
  sourceOriginalFilename: "",
  sourceFileSize: 0,
  sourceImageWidth: 0,
  sourceImageHeight: 0,
  sourceLastModified: "",
  importSource: "",
  sourceNamespace: "",
  sourceRelativePath: "",
  relinkStatus: "unknown",
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
  assert.equal(normalized.importedAt, "2024-01-02T03:04:05.000Z");
  assert.equal(normalized.sourceOriginalFilename, "");
  assert.equal(normalized.sourceFileSize, 0);
  assert.equal(normalized.sourceImageWidth, 0);
  assert.equal(normalized.sourceImageHeight, 0);
  assert.equal(normalized.sourceLastModified, "");
  assert.equal(normalized.importSource, "");
  assert.equal(normalized.sourceNamespace, "");
  assert.equal(normalized.sourceRelativePath, "");
  assert.equal(normalized.relinkStatus, "unknown");
});

test("normalizeItem does not let metadata corrections override an explicit incoming list", () => {
  const normalized = normalizeItem(
    {
      id: "bottom_trousers_taiga_takahashi_lot_204_engineer_trousers_34_brown",
      imageUrl: "/images/bottom_204_brown.png",
      list: "Incoming"
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

  assert.equal(normalized.name, "Lot.204 Engineer Trousers");
  assert.equal(normalized.list, "Incoming");
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

test("normalizeItem preserves existing import metadata and unknown fields", () => {
  const normalized = normalizeItem(
    {
      id: "imported_item",
      imageUrl: "data:image/png;base64,preview",
      createdAt: "2024-01-02T03:04:05.000Z",
      importedAt: "2024-01-01T03:04:05.000Z",
      sourceOriginalFilename: "IMG_1001.HEIC",
      sourceFileSize: "2048",
      sourceImageWidth: "1200",
      sourceImageHeight: 1800,
      sourceLastModified: 1704078245000,
      importSource: "file-upload",
      sourceNamespace: "local-file",
      sourceRelativePath: "imports/IMG_1001.HEIC",
      relinkStatus: "missing",
      extraMetadata: { keep: true }
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

  assert.equal(normalized.importedAt, "2024-01-01T03:04:05.000Z");
  assert.equal(normalized.sourceOriginalFilename, "IMG_1001.HEIC");
  assert.equal(normalized.sourceFileSize, 2048);
  assert.equal(normalized.sourceImageWidth, 1200);
  assert.equal(normalized.sourceImageHeight, 1800);
  assert.equal(normalized.sourceLastModified, "2024-01-01T03:04:05.000Z");
  assert.equal(normalized.importSource, "file-upload");
  assert.equal(normalized.sourceNamespace, "local-file");
  assert.equal(normalized.sourceRelativePath, "imports/IMG_1001.HEIC");
  assert.equal(normalized.relinkStatus, "missing");
  assert.deepEqual(normalized.extraMetadata, { keep: true });
});

test("normalizeItem preserves unknown list values for forward-compatible imports", () => {
  const normalized = normalizeItem(
    {
      id: "future_list_item",
      imageUrl: "data:image/png;base64,preview",
      list: "ArchivedLater"
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

  assert.equal(normalized.list, "ArchivedLater");
});

test("normalizeItem defaults additive source identity fields safely for legacy items", () => {
  const normalized = normalizeItem(
    {
      id: "legacy_item",
      imageUrl: "data:image/png;base64,preview",
      createdAt: "2024-01-02T03:04:05.000Z"
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

  assert.equal(normalized.sourceNamespace, "");
  assert.equal(normalized.sourceRelativePath, "");
  assert.equal(normalized.relinkStatus, "unknown");
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

test("import metadata migration detection catches importedAt backfill for existing items", () => {
  const originalItem = {
    id: "legacy_item",
    imageUrl: "data:image/png;base64,preview",
    createdAt: "2024-01-02T03:04:05.000Z"
  };
  const normalized = normalizeItem(originalItem, {
    emptyForm: baseEmptyForm,
    resolveImageUrl: (value) => value,
    normalizeImageFrameScale: (value) => value ?? 100,
    normalizeImageScale: (value) => value ?? 100,
    normalizeImageOffset: (value) => value ?? 0,
    getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
  });

  assert.equal(normalized.importedAt, "2024-01-02T03:04:05.000Z");
  assert.equal(itemNeedsImportMetadataMigration(originalItem, normalized), true);
});

test("import metadata migration detection catches additive source identity backfill for legacy items", () => {
  const originalItem = {
    id: "legacy_item",
    imageUrl: "data:image/png;base64,preview",
    createdAt: "2024-01-02T03:04:05.000Z",
    importedAt: "2024-01-02T03:04:05.000Z",
    sourceOriginalFilename: "",
    sourceFileSize: 0,
    sourceImageWidth: 0,
    sourceImageHeight: 0,
    sourceLastModified: "",
    importSource: ""
  };
  const normalized = normalizeItem(originalItem, {
    emptyForm: baseEmptyForm,
    resolveImageUrl: (value) => value,
    normalizeImageFrameScale: (value) => value ?? 100,
    normalizeImageScale: (value) => value ?? 100,
    normalizeImageOffset: (value) => value ?? 0,
    getNormalizedImageCrop: () => ({ x: 0, y: 0, width: 100, height: 100 })
  });

  assert.equal(normalized.sourceNamespace, "");
  assert.equal(normalized.sourceRelativePath, "");
  assert.equal(normalized.relinkStatus, "unknown");
  assert.equal(itemNeedsImportMetadataMigration(originalItem, normalized), true);
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
