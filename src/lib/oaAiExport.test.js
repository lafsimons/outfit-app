import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import {
  buildOaAiExportBundle,
  createDefaultOaAiExportOptions,
  getAcquisitionPipelineDatasetItems,
  getCollectionDatasetItems,
  getCurrentWardrobeDatasetItems,
  getOaAiCollectionOptions,
  normalizeOaAiExportOptions
} from "./oaAiExport.js";

const wardrobeItems = [
  {
    id: "wardrobe-1",
    itemUuid: "uuid-1",
    name: "Wardrobe One",
    status: "Wardrobe",
    collections: ["Sportswear"]
  },
  {
    id: "wardrobe-2",
    itemUuid: "uuid-2",
    name: "Wardrobe Two",
    status: "Wardrobe",
    collections: ["Core Wardrobe"]
  },
  {
    id: "incoming-1",
    itemUuid: "uuid-3",
    name: "Incoming One",
    status: "Incoming",
    collections: []
  },
  {
    id: "wishlist-1",
    itemUuid: "uuid-4",
    name: "Wishlist One",
    status: "Wishlist",
    collections: ["Sportswear"]
  }
];

test("current wardrobe dataset includes wardrobe items and respects excluded collections", () => {
  assert.deepEqual(
    getCurrentWardrobeDatasetItems(wardrobeItems, {
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear"]
    }).map((item) => item.id),
    ["wardrobe-2"]
  );
});

test("acquisition pipeline dataset includes wishlist and incoming only", () => {
  assert.deepEqual(
    getAcquisitionPipelineDatasetItems(wardrobeItems).map((item) => item.id),
    ["incoming-1", "wishlist-1"]
  );
});

test("collection dataset includes exact collection matches", () => {
  assert.deepEqual(
    getCollectionDatasetItems(wardrobeItems, "Sportswear").map((item) => item.id),
    ["wardrobe-1", "wishlist-1"]
  );
});

test("dynamic collection discovery and defaults track live collections", () => {
  assert.deepEqual(getOaAiCollectionOptions(wardrobeItems), ["Core Wardrobe", "Sportswear"]);
  assert.deepEqual(
    createDefaultOaAiExportOptions(getOaAiCollectionOptions(wardrobeItems)),
    {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: true,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear"],
      collectionExports: ["Sportswear"]
    }
  );
});

test("normalization drops collection selections that do not exist", () => {
  assert.deepEqual(
    normalizeOaAiExportOptions(
      {
        excludedCollections: ["Sportswear", "Missing"],
        collectionExports: ["Core Wardrobe", "Missing"]
      },
      ["Core Wardrobe", "Sportswear"]
    ),
    {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: true,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear", "Missing"],
      collectionExports: ["Core Wardrobe", "Missing"]
    }
  );
});

test("buildOaAiExportBundle packages expected files and lists skipped empty wardrobe datasets", async () => {
  const bundle = await buildOaAiExportBundle({
    items: wardrobeItems,
    savedOutfits: [{ id: "saved-1", outfitUuid: "outfit-1", name: "Saved" }],
    fitpics: [{ id: "fitpic-1", fitpicUuid: "fitpic-uuid-1", name: "Fitpic" }],
    options: {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: true,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear"],
      collectionExports: ["Sportswear", "Formal Wardrobe"]
    },
    renderWardrobePng: async ({ fileName }) => ({
      fileName,
      blob: new Blob([`png:${fileName}`], { type: "image/png" })
    }),
    renderFitpicPng: async ({ fileName }) => ({
      fileName,
      blob: new Blob([`png:${fileName}`], { type: "image/png" })
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  const readme = strFromU8(files["README.md"]);

  assert.equal(bundle.fileName.startsWith("oa-ai-export-"), true);
  assert.equal(files["wardrobe/current-wardrobe.csv"] !== undefined, true);
  assert.equal(files["wardrobe/current-wardrobe.png"] !== undefined, true);
  assert.equal(files["wardrobe/acquisition-pipeline.csv"] !== undefined, true);
  assert.equal(files["wardrobe/acquisition-pipeline.png"] !== undefined, true);
  assert.equal(files["fitpics/fitpics.csv"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-reference.png"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-compact.png"] !== undefined, true);
  assert.equal(files["saved-outfits/saved-outfits.csv"] !== undefined, true);
  assert.equal(files["saved-outfits/saved-outfits.json"] !== undefined, true);
  assert.equal(files["collections/sportswear.csv"] !== undefined, true);
  assert.equal(files["collections/sportswear.png"] !== undefined, true);
  assert.equal(files["collections/formal-wardrobe.csv"], undefined);
  assert.equal(files["collections/formal-wardrobe.png"], undefined);
  assert.match(readme, /Skipped empty datasets/);
  assert.match(readme, /Collection: Formal Wardrobe/);
});

test("buildOaAiExportBundle skips empty wardrobe core datasets without blank csv or png files", async () => {
  const bundle = await buildOaAiExportBundle({
    items: [],
    savedOutfits: [],
    fitpics: [],
    options: {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: true,
      includeFitpics: false,
      includeSavedOutfits: false,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: [],
      collectionExports: []
    },
    renderWardrobePng: async ({ fileName }) => ({
      fileName,
      blob: new Blob([`png:${fileName}`], { type: "image/png" })
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  const readme = strFromU8(files["README.md"]);

  assert.equal(files["wardrobe/current-wardrobe.csv"], undefined);
  assert.equal(files["wardrobe/current-wardrobe.png"], undefined);
  assert.equal(files["wardrobe/acquisition-pipeline.csv"], undefined);
  assert.equal(files["wardrobe/acquisition-pipeline.png"], undefined);
  assert.match(readme, /Current Wardrobe/);
  assert.match(readme, /Acquisition Pipeline/);
});
