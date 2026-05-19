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
  assert.equal(prepared.backup.items[0].list, "Wishlist");
  assert.equal(prepared.backup.items[0].favorite, true);
  assert.equal(prepared.backup.items[0].quantity, 3);
  assert.deepEqual(prepared.backup.items[0].extraMetadata, { keep: true });
  assert.equal(prepared.backup.items[0].images.preview.dominantColor, "#112233");
  assert.equal(prepared.backup.items[0].images.thumbnail.blurHash, "abc123");
  assert.deepEqual(prepared.backup.items[0].images.extra, { note: "keep" });
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
  assert.equal(prepared.items[0].list, "ArchivedLater");
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
