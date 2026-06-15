import test from "node:test";
import assert from "node:assert/strict";

import { prepareBackupImport } from "./backupImport.js";
import { normalizeHydratedAppState } from "./appStateModel.js";
import { createFallbackItemTimestamp, normalizeItem } from "./itemModel.js";
import {
  emptyOutfitFilters,
  defaultGenerationLists,
  defaultGenerationMode,
  normalizeOutfitAffinity,
  normalizeRecentOutfits
} from "./generation.js";
import {
  normalizeImageCropSize,
  normalizeImageCropStart,
  normalizeImageFrameScale,
  normalizeImageOffset,
  normalizeImageScale
} from "./imagePresentation.js";
import { emptyForm, applyMappedStyleWeightDefaults } from "./typeDefaults.js";

const MIGRATION_VERSIONS = {
  itemDefaults: 3,
  imagePresentation: 2
};

function getNormalizedImageCrop(item) {
  const width = normalizeImageCropSize(item?.imageCropWidth);
  const height = normalizeImageCropSize(item?.imageCropHeight);

  return {
    x: normalizeImageCropStart(item?.imageCropX, width),
    y: normalizeImageCropStart(item?.imageCropY, height),
    width,
    height
  };
}

function normalizeStoredItem(item, fallbackCreatedAt) {
  return normalizeItem(item, {
    fallbackCreatedAt,
    emptyForm,
    resolveImageUrl: (value) => value ?? "",
    normalizeImageFrameScale,
    normalizeImageScale,
    normalizeImageOffset,
    getNormalizedImageCrop,
    createItemUuid: () => "generated-item-uuid"
  });
}

function normalizeWeatherSettings(settings) {
  const latitude = Number(settings?.latitude);
  const longitude = Number(settings?.longitude);

  return {
    locationName: settings?.locationName ?? "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

async function prepare(backup, overrides = {}) {
  return prepareBackupImport(backup, {
    normalizeStoredItem,
    createFallbackItemTimestamp,
    restoreLegacyBakedImageScale: (item) => ({
      ...item,
      restoredLegacyScale: true
    }),
    bakeItemImagePresentation: async (item) => ({
      ...item,
      bakedPresentation: true
    }),
    applyMappedStyleWeightDefaults,
    normalizeHydratedAppState,
    buildNextOutfit: (items) => ({
      TopInner: items[0]?.id ?? null
    }),
    normalizeOutfitAffinity,
    normalizeRecentOutfits,
    normalizeWeatherSettings,
    defaultGenerationLists,
    emptyOutfitFilters,
    defaultGenerationMode,
    migrationVersions: MIGRATION_VERSIONS,
    ...overrides
  });
}

test("prepareBackupImport normalizes legacy imageUrl-only items before persistence", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_item",
        imageUrl: "data:image/png;base64,legacy",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {}
  });

  assert.equal(prepared.backup.items[0].imageUrl, "data:image/png;base64,legacy");
  assert.equal(prepared.backup.items[0].images.original.src, "");
  assert.equal(prepared.backup.items[0].images.preview.src, "data:image/png;base64,legacy");
  assert.equal(prepared.backup.items[0].images.thumbnail.src, "data:image/png;base64,legacy");
  assert.equal(prepared.backup.items[0].activeItemImageUuid, "generated-item-uuid:item-image:0");
  assert.equal(prepared.backup.items[0].itemImages.length, 1);
  assert.equal(prepared.backup.items[0].itemImages[0].canonicalAsset.imageUrl, "data:image/png;base64,legacy");
  assert.equal(
    prepared.backup.items[0].itemImages[0].activeImageAssetUuid,
    "generated-item-uuid:item-image:0:image-asset:canonical:0"
  );
});

test("prepareBackupImport backfills itemUuid and provenance metadata during import", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_item",
        imageUrl: "data:image/png;base64,legacy",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {}
  });

  assert.equal(prepared.backup.items[0].itemUuid, "generated-item-uuid");
  assert.equal(prepared.backup.items[0].importedAt, "2024-01-02T03:04:05.000Z");
  assert.equal(prepared.backup.items[0].sourceOriginalFilename, "");
  assert.equal(prepared.backup.items[0].sourceFileSize, 0);
  assert.equal(prepared.backup.items[0].sourceImageWidth, 0);
  assert.equal(prepared.backup.items[0].sourceImageHeight, 0);
  assert.equal(prepared.backup.items[0].sourceLastModified, "");
  assert.equal(prepared.backup.items[0].importSource, "");
  assert.equal(prepared.backup.items[0].sourceNamespace, "");
  assert.equal(prepared.backup.items[0].sourceRelativePath, "");
  assert.equal(prepared.backup.items[0].relinkStatus, "unknown");
});

test("prepareBackupImport applies startup style and weight migration when import app-state is outdated", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_top",
        imageUrl: "data:image/png;base64,legacy",
        type: "T-Shirt",
        weight: "",
        styleTags: [],
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {
      itemDefaultsMigrationVersion: 0,
      imagePresentationMigrationVersion: MIGRATION_VERSIONS.imagePresentation
    }
  });

  assert.equal(prepared.backup.items[0].weight, "Light");
  assert.deepEqual(prepared.backup.items[0].styleTags, ["Casual"]);
});

test("prepareBackupImport preserves custom user metadata while migrating imported items", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_top",
        imageUrl: "data:image/png;base64,legacy",
        images: {
          preview: { src: "data:image/png;base64,legacy", dominantColor: "#112233" },
          thumbnail: { src: "data:image/png;base64,thumb", blurHash: "abc123" },
          extra: { note: "keep" }
        },
        type: "T-Shirt",
        color: "navy",
        climateTags: ["Rain"],
        list: "Wishlist",
        favorite: true,
        quantity: 3,
        extraMetadata: { keep: true },
        createdAt: "2024-01-02T03:04:05.000Z",
        itemUuid: "stable-item-uuid"
      }
    ],
    appState: {
      itemDefaultsMigrationVersion: 0,
      imagePresentationMigrationVersion: MIGRATION_VERSIONS.imagePresentation
    }
  });

  assert.equal(prepared.backup.items[0].itemUuid, "stable-item-uuid");
  assert.equal(prepared.backup.items[0].color, "Navy");
  assert.deepEqual(prepared.backup.items[0].climateTags, ["Rain"]);
  assert.equal(prepared.backup.items[0].status, "Wishlist");
  assert.equal(prepared.backup.items[0].list, "Wishlist");
  assert.equal(prepared.backup.items[0].favorite, true);
  assert.equal(prepared.backup.items[0].quantity, 3);
  assert.deepEqual(prepared.backup.items[0].extraMetadata, { keep: true });
  assert.equal(prepared.backup.items[0].images.preview.dominantColor, "#112233");
  assert.equal(prepared.backup.items[0].images.thumbnail.blurHash, "abc123");
  assert.deepEqual(prepared.backup.items[0].images.extra, { note: "keep" });
});

test("prepareBackupImport preserves explicit wardrobe item images and active asset selection", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "multi_image_item",
        itemUuid: "stable-item-uuid",
        activeItemImageUuid: "item-image-1",
        itemImages: [
          {
            itemImageUuid: "item-image-1",
            order: 0,
            canonicalAsset: {
              assetUuid: "asset-canonical",
              imageUrl: "data:image/png;base64,canonical",
              images: {
                preview: { src: "data:image/png;base64,canonical" },
                thumbnail: { src: "data:image/png;base64,canonical-thumb" }
              }
            },
            derivedAssets: [
              {
                assetUuid: "asset-derived",
                imageUrl: "data:image/png;base64,derived",
                images: {
                  preview: { src: "data:image/png;base64,derived" },
                  thumbnail: { src: "data:image/png;base64,derived-thumb" }
                }
              }
            ],
            activeImageAssetUuid: "asset-derived"
          }
        ],
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {}
  });

  assert.equal(prepared.backup.items[0].activeItemImageUuid, "item-image-1");
  assert.equal(prepared.backup.items[0].itemImages.length, 1);
  assert.equal(prepared.backup.items[0].itemImages[0].activeImageAssetUuid, "asset-derived");
  assert.equal(prepared.backup.items[0].imageUrl, "data:image/png;base64,derived");
  assert.equal(prepared.backup.items[0].images.preview.src, "data:image/png;base64,derived");
});

test("prepareBackupImport preserves unknown future list values from backups", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "future_list_item",
        imageUrl: "data:image/png;base64,legacy",
        list: "ArchivedLater",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {}
  });

  assert.equal(prepared.backup.items[0].list, "ArchivedLater");
  assert.equal(prepared.backup.items[0].status, "ArchivedLater");
  assert.equal(prepared.items[0].list, "ArchivedLater");
  assert.equal(prepared.items[0].status, "ArchivedLater");
});

test("prepareBackupImport preserves supported lifecycle list values from backups", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "selling_item",
        imageUrl: "data:image/png;base64,legacy",
        list: "Selling",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {}
  });

  assert.equal(prepared.backup.items[0].list, "Selling");
  assert.equal(prepared.backup.items[0].status, "Selling");
  assert.equal(prepared.items[0].list, "Selling");
  assert.equal(prepared.items[0].status, "Selling");
});

test("prepareBackupImport persists current app-state migration versions after import", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [],
    appState: {
      itemDefaultsMigrationVersion: 0,
      imagePresentationMigrationVersion: 0
    }
  });

  assert.equal(prepared.backup.appState.itemDefaultsMigrationVersion, MIGRATION_VERSIONS.itemDefaults);
  assert.equal(prepared.backup.appState.imagePresentationMigrationVersion, MIGRATION_VERSIONS.imagePresentation);
});

test("prepareBackupImport preserves recentOutfits reset behavior", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_item",
        imageUrl: "data:image/png;base64,legacy",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {
      recentOutfits: [
        {
          outfit: { TopInner: "legacy_item" },
          layering: true
        }
      ]
    }
  });

  assert.deepEqual(prepared.backup.appState.recentOutfits, []);
  assert.deepEqual(prepared.appState.recentOutfits, []);
});

test("prepareBackupImport preserves additive outfitItemUuids metadata and backfills missing resolved slots", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_top",
        itemUuid: "stable-top-uuid",
        imageUrl: "data:image/png;base64,legacy",
        createdAt: "2024-01-02T03:04:05.000Z"
      },
      {
        id: "legacy_bottom",
        itemUuid: "stable-bottom-uuid",
        imageUrl: "data:image/png;base64,legacy-2",
        createdAt: "2024-01-02T03:04:06.000Z"
      }
    ],
    appState: {
      outfit: { TopInner: "legacy_top", Bottom: "legacy_bottom" },
      outfitItemUuids: { TopInner: "stable-top-uuid" },
      savedOutfits: [
        {
          id: "saved_1",
          tags: ["Evening"],
          favorite: true,
          createdAt: "2024-02-01T00:00:00.000Z",
          updatedAt: "2024-02-02T00:00:00.000Z",
          outfit: { TopInner: "legacy_top", Bottom: "legacy_bottom" },
          outfitItemUuids: { Bottom: "stable-bottom-uuid" },
          layering: true
        }
      ]
    }
  }, {
    normalizeHydratedAppState: (appState, options) =>
      normalizeHydratedAppState(appState, {
        ...options,
        createOutfitUuid: () => "generated-outfit-uuid"
      })
  });

  assert.deepEqual(prepared.appState.outfitItemUuids, {
    TopInner: "stable-top-uuid",
    Bottom: "stable-bottom-uuid"
  });
  assert.deepEqual(prepared.backup.appState.outfitItemUuids, {
    TopInner: "stable-top-uuid",
    Bottom: "stable-bottom-uuid"
  });
  assert.deepEqual(prepared.appState.savedOutfits[0].outfitItemUuids, {
    TopInner: "stable-top-uuid",
    Bottom: "stable-bottom-uuid"
  });
  assert.equal(prepared.appState.savedOutfits[0].outfitUuid, "generated-outfit-uuid");
  assert.deepEqual(prepared.appState.savedOutfits[0].tags, ["Evening"]);
  assert.equal(prepared.appState.savedOutfits[0].favorite, true);
  assert.equal(prepared.appState.savedOutfits[0].createdAt, "2024-02-01T00:00:00.000Z");
  assert.equal(prepared.appState.savedOutfits[0].updatedAt, "2024-02-02T00:00:00.000Z");
  assert.equal(prepared.backup.appState.savedOutfits[0].outfitUuid, "generated-outfit-uuid");
});

test("prepareBackupImport preserves an existing saved outfitUuid", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [
      {
        id: "legacy_top",
        itemUuid: "stable-top-uuid",
        imageUrl: "data:image/png;base64,legacy",
        createdAt: "2024-01-02T03:04:05.000Z"
      }
    ],
    appState: {
      savedOutfits: [
        {
          id: "saved_1",
          outfitUuid: "stable-outfit-uuid",
          outfit: { TopInner: "legacy_top" }
        }
      ]
    }
  }, {
    normalizeHydratedAppState: (appState, options) =>
      normalizeHydratedAppState(appState, {
        ...options,
        createOutfitUuid: () => "generated-outfit-uuid"
      })
  });

  assert.equal(prepared.appState.savedOutfits[0].outfitUuid, "stable-outfit-uuid");
  assert.equal(prepared.backup.appState.savedOutfits[0].outfitUuid, "stable-outfit-uuid");
});

test("prepareBackupImport preserves multi-image fitpics and primary image aliases", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [],
    appState: {
      fitpics: [
        {
          id: "fitpic_1",
          fitpicUuid: "fitpic-uuid-1",
          name: "Fitpic",
          primaryImageUuid: "fitpic-image-uuid-2",
          fitpicImages: [
            {
              fitpicImageUuid: "fitpic-image-uuid-1",
              order: 0,
              imageData: "data:image/png;base64,front",
              sourceOriginalFilename: "front.png"
            },
            {
              fitpicImageUuid: "fitpic-image-uuid-2",
              order: 1,
              imageData: "data:image/png;base64,detail",
              sourceOriginalFilename: "detail.png"
            }
          ]
        }
      ]
    }
  });

  assert.equal(prepared.appState.fitpics[0].primaryImageUuid, "fitpic-image-uuid-2");
  assert.equal(prepared.appState.fitpics[0].fitpicImages.length, 2);
  assert.equal(prepared.appState.fitpics[0].fitpicImages[0].fitpicImageUuid, "fitpic-image-uuid-1");
  assert.equal(prepared.appState.fitpics[0].fitpicImages[1].fitpicImageUuid, "fitpic-image-uuid-2");
  assert.equal(prepared.appState.fitpics[0].imageData, "data:image/png;base64,detail");
  assert.equal(prepared.backup.appState.fitpics[0].primaryImageUuid, "fitpic-image-uuid-2");
  assert.equal(prepared.backup.appState.fitpics[0].fitpicImages.length, 2);
});

test("prepareBackupImport preserves additive fitpic relationship fields and fitDate", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [],
    appState: {
      fitpics: [
        {
          id: "fitpic_1",
          imageData: "data:image/png;base64,legacy",
          createdAt: "2024-03-01T00:00:00.000Z",
          fitDate: "2024-03-05T00:00:00.000Z",
          linkedItemUuids: ["item-uuid-1"],
          linkedItemIds: ["item_1"],
          savedOutfitUuid: "outfit-uuid-1",
          savedOutfitId: "saved_1"
        }
      ]
    }
  });

  assert.equal(prepared.appState.fitpics[0].fitDate, "2024-03-05T00:00:00.000Z");
  assert.deepEqual(prepared.appState.fitpics[0].linkedItemUuids, ["item-uuid-1"]);
  assert.deepEqual(prepared.appState.fitpics[0].linkedItemIds, ["item_1"]);
  assert.equal(prepared.appState.fitpics[0].savedOutfitUuid, "outfit-uuid-1");
  assert.equal(prepared.appState.fitpics[0].savedOutfitId, "saved_1");
  assert.equal(prepared.backup.appState.fitpics[0].fitDate, "2024-03-05T00:00:00.000Z");
});

test("prepareBackupImport normalizes persisted wardrobe filters in app-state", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [],
    appState: {
      wardrobeFilters: {
        list: "Wardrobe",
        garmentType: "Footwear",
        style: "Casual",
        favorite: "yes",
        extra: "ignored"
      }
    }
  });

  assert.deepEqual(prepared.appState.wardrobeFilters, {
    brand: [],
    brandExcluded: [],
    type: [],
    typeExcluded: [],
    garmentType: ["Footwear"],
    garmentTypeExcluded: [],
    color: [],
    colorExcluded: [],
    style: ["Casual"],
    styleExcluded: [],
    climate: [],
    climateExcluded: [],
    laundry: "",
    weight: [],
    weightExcluded: [],
    status: ["Wardrobe"],
    statusExcluded: [],
    collections: [],
    collectionsExcluded: [],
    favorite: "yes"
  });
  assert.deepEqual(prepared.backup.appState.wardrobeFilters, prepared.appState.wardrobeFilters);
});

test("prepareBackupImport preserves and normalizes saved wardrobe views in app-state", async () => {
  const prepared = await prepare({
    source: "outfit-app",
    version: 1,
    items: [],
    appState: {
      savedWardrobeViews: [
        {
          name: " Wishlist ",
          wardrobeSearch: "coat",
          wardrobeFilters: {
            list: "Wishlist",
            collections: ["A/W Rotation"],
            typeExcluded: ["Loafer"]
          },
          wardrobeSort: "oldest",
          pinned: 1
        }
      ]
    }
  });

  assert.deepEqual(prepared.appState.savedWardrobeViews, [
    {
      id: prepared.appState.savedWardrobeViews[0].id,
      name: "Wishlist",
      searchQuery: "coat",
      filters: {
        brand: [],
        brandExcluded: [],
        type: [],
        typeExcluded: ["Loafer"],
        garmentType: [],
        garmentTypeExcluded: [],
        color: [],
        colorExcluded: [],
        style: [],
        styleExcluded: [],
        climate: [],
        climateExcluded: [],
        laundry: "",
        weight: [],
        weightExcluded: [],
        status: ["Wishlist"],
        statusExcluded: [],
        collections: ["A/W Rotation"],
        collectionsExcluded: [],
        favorite: ""
      },
      sort: "oldest",
      pinned: true
    }
  ]);
  assert.deepEqual(prepared.backup.appState.savedWardrobeViews, prepared.appState.savedWardrobeViews);
});
