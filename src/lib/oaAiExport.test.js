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
  getOaAiStatusOptions,
  getStatusDatasetItems,
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
  assert.deepEqual(getOaAiStatusOptions(wardrobeItems), ["Wishlist", "Incoming", "Wardrobe"]);
  assert.deepEqual(
    createDefaultOaAiExportOptions(
      getOaAiCollectionOptions(wardrobeItems),
      getOaAiStatusOptions(wardrobeItems)
    ),
    {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: false,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear"],
      collectionExports: ["Core Wardrobe", "Sportswear"],
      statusExports: ["Wishlist", "Incoming"],
      statusExportMode: "separate"
    }
  );
});

test("dynamic defaults honor the configured collection and status fallback targets when available", () => {
  const collectionOptions = [
    "A/W Rotation",
    "Beater Wardrobe",
    "Core Wardrobe",
    "Formal Wardrobe",
    "S/S Rotation",
    "Sportswear",
    "Support",
    "Testing",
    "Vintage"
  ];
  const statusOptions = ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Archived"];

  assert.deepEqual(
    createDefaultOaAiExportOptions(collectionOptions, statusOptions),
    {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: false,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Beater Wardrobe", "Sportswear"],
      collectionExports: ["Core Wardrobe", "Sportswear"],
      statusExports: ["Interested", "Wishlist", "Incoming", "Selling", "Archived"],
      statusExportMode: "separate"
    }
  );
});

test("normalization drops collection selections that do not exist", () => {
  assert.deepEqual(
    normalizeOaAiExportOptions(
      {
        excludedCollections: ["Sportswear", "Missing"],
        collectionExports: ["Core Wardrobe", "Missing"],
        statusExports: ["Selling", "ArchivedLater"],
        statusExportMode: "separate"
      },
      ["Core Wardrobe", "Sportswear"],
      ["Selling", "Archived", "ArchivedLater"]
    ),
    {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: true,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Sportswear", "Missing"],
      collectionExports: ["Core Wardrobe", "Missing"],
      statusExports: ["Selling", "ArchivedLater"],
      statusExportMode: "separate"
    }
  );
});

test("status dataset includes exact status matches", () => {
  assert.deepEqual(
    getStatusDatasetItems(
      [
        ...wardrobeItems,
        { id: "selling-1", itemUuid: "uuid-5", name: "Selling One", status: "Selling", collections: [] },
        { id: "sold-1", itemUuid: "uuid-6", name: "Sold One", status: "Sold", collections: [] }
      ],
      ["Selling", "Sold"]
    ).map((item) => item.id),
    ["selling-1", "sold-1"]
  );
});

test("buildOaAiExportBundle packages expected files and lists skipped empty wardrobe datasets", async () => {
  const wardrobePngCalls = [];
  const bundle = await buildOaAiExportBundle({
    items: wardrobeItems,
    savedOutfits: [{ id: "saved-1", outfitUuid: "outfit-1", name: "Saved" }],
    fitpics: [{ id: "fitpic-1", fitpicUuid: "fitpic-uuid-1", name: "Fitpic" }],
    options: {
      includeCurrentWardrobe: true,
      includeAcquisitionPipeline: false,
      includeFitpics: true,
      includeSavedOutfits: true,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: ["Beater Wardrobe", "Sportswear"],
      collectionExports: ["Core Wardrobe", "Sportswear", "Formal Wardrobe"],
      statusExports: ["Interested", "Wishlist", "Incoming", "Selling", "Archived"],
      statusExportMode: "separate"
    },
    renderWardrobePng: async ({ fileName, options, exportProfile }) => {
      wardrobePngCalls.push({ fileName, options });
      return ({
      fileName,
      mimeType: exportProfile === "ai" ? "image/webp" : "image/png",
      blob: new Blob([`image:${fileName}`], { type: exportProfile === "ai" ? "image/webp" : "image/png" }),
      report: {
        fileName,
        format: exportProfile === "ai" ? "webp" : "png",
        sizeBytes: 20,
        pixelWidth: 100,
        pixelHeight: 100
      }
      });
    },
    renderFitpicPng: async ({ fileName }) => ({
      fileName,
      blob: new Blob([`webp:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        sizeBytes: 18,
        targetBytes: 30,
        budgetExceeded: false
      }
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  const readme = strFromU8(files["README.md"]);

  assert.equal(bundle.fileName.startsWith("oa-ai-export-"), true);
  assert.equal(files["wardrobe/current-wardrobe.csv"] !== undefined, true);
  assert.equal(files["wardrobe/current-wardrobe.webp"] !== undefined, true);
  assert.equal(files["wardrobe/acquisition-pipeline.csv"], undefined);
  assert.equal(files["wardrobe/acquisition-pipeline.webp"], undefined);
  assert.equal(files["fitpics/fitpics.csv"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-reference.webp"], undefined);
  assert.equal(files["fitpics/fitpics-compact.webp"] !== undefined, true);
  assert.equal(files["fitpics/fitpics-details.webp"] !== undefined, true);
  assert.equal(files["saved-outfits/saved-outfits.csv"] !== undefined, true);
  assert.equal(files["saved-outfits/saved-outfits.json"] !== undefined, true);
  assert.equal(files["collections/core-wardrobe.csv"] !== undefined, true);
  assert.equal(files["collections/core-wardrobe.webp"] !== undefined, true);
  assert.equal(files["collections/sportswear.csv"] !== undefined, true);
  assert.equal(files["collections/sportswear.webp"] !== undefined, true);
  assert.equal(files["collections/formal-wardrobe.csv"], undefined);
  assert.equal(files["collections/formal-wardrobe.webp"], undefined);
  assert.equal(files["statuses/interested.csv"], undefined);
  assert.equal(files["statuses/wishlist.csv"] !== undefined, true);
  assert.equal(files["statuses/wishlist.webp"] !== undefined, true);
  assert.equal(files["statuses/incoming.csv"] !== undefined, true);
  assert.equal(files["statuses/incoming.webp"] !== undefined, true);
  assert.equal(files["statuses/selling.csv"], undefined);
  assert.equal(files["statuses/archived.csv"], undefined);
  assert.deepEqual(
    wardrobePngCalls,
    [
      {
        fileName: "wardrobe/current-wardrobe.webp",
        options: {
          shuffleItems: false,
          useCurrentSortOrder: true,
          showItemName: true,
          showBrand: true,
          showId: false
        }
      },
      {
        fileName: "collections/core-wardrobe.webp",
        options: {
          shuffleItems: false,
          useCurrentSortOrder: true,
          showItemName: true,
          showBrand: true,
          showId: false
        }
      },
      {
        fileName: "collections/sportswear.webp",
        options: {
          shuffleItems: false,
          useCurrentSortOrder: true,
          showItemName: true,
          showBrand: true,
          showId: false
        }
      },
      {
        fileName: "statuses/wishlist.webp",
        options: {
          shuffleItems: false,
          useCurrentSortOrder: true,
          showItemName: true,
          showBrand: true,
          showId: false
        }
      },
      {
        fileName: "statuses/incoming.webp",
        options: {
          shuffleItems: false,
          useCurrentSortOrder: true,
          showItemName: true,
          showBrand: true,
          showId: false
        }
      }
    ]
  );
  assert.match(readme, /Skipped empty datasets/);
  assert.match(readme, /Collection: Formal Wardrobe/);
  assert.match(readme, /## Acquisition Pipeline Status Interpretation/);
  assert.match(readme, /Archived does NOT mean seasonal storage\./);
  assert.equal(bundle.wardrobeImageReports.length, 5);
  assert.equal(bundle.fitpicImageReports.length, 2);
});

test("buildOaAiExportBundle can export selected statuses as separate datasets", async () => {
  const bundle = await buildOaAiExportBundle({
    items: [
      ...wardrobeItems,
      { id: "selling-1", itemUuid: "uuid-5", name: "Selling One", status: "Selling", collections: [] },
      { id: "sold-1", itemUuid: "uuid-6", name: "Sold One", status: "Sold", collections: [] },
      { id: "archived-1", itemUuid: "uuid-7", name: "Archived One", status: "Archived", collections: [] }
    ],
    savedOutfits: [],
    fitpics: [],
    options: {
      includeCurrentWardrobe: false,
      includeAcquisitionPipeline: false,
      includeFitpics: false,
      includeSavedOutfits: false,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: [],
      collectionExports: [],
      statusExports: ["Selling", "Sold", "Archived"],
      statusExportMode: "separate"
    },
    renderWardrobePng: async ({ fileName }) => ({
      fileName,
      mimeType: "image/webp",
      blob: new Blob([`webp:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        format: "webp",
        sizeBytes: 20,
        pixelWidth: 100,
        pixelHeight: 100
      }
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));

  assert.equal(files["statuses/selling.csv"] !== undefined, true);
  assert.equal(files["statuses/selling.webp"] !== undefined, true);
  assert.equal(files["statuses/sold.csv"] !== undefined, true);
  assert.equal(files["statuses/sold.webp"] !== undefined, true);
  assert.equal(files["statuses/archived.csv"] !== undefined, true);
  assert.equal(files["statuses/archived.webp"] !== undefined, true);
});

test("buildOaAiExportBundle keeps Archived exports when a status item is missing its image", async () => {
  const bundle = await buildOaAiExportBundle({
    items: [
      {
        id: "archived-1",
        itemUuid: "uuid-7",
        name: "Archived One",
        brand: "Brand X",
        status: "Archived",
        collections: [],
        imageUrl: ""
      }
    ],
    savedOutfits: [],
    fitpics: [],
    options: {
      includeCurrentWardrobe: false,
      includeAcquisitionPipeline: false,
      includeFitpics: false,
      includeSavedOutfits: false,
      excludeCollectionsFromCurrentWardrobe: true,
      excludedCollections: [],
      collectionExports: [],
      statusExports: ["Archived"],
      statusExportMode: "separate"
    },
    renderWardrobePng: async ({ fileName }) => ({
      fileName,
      mimeType: "image/webp",
      blob: new Blob([`webp:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        format: "webp",
        sizeBytes: 20,
        pixelWidth: 100,
        pixelHeight: 100,
        missingImageCount: 1,
        warningCount: 1,
        warnings: [
          {
            reason: "missing export image",
            itemId: "archived-1",
            status: "Archived"
          }
        ]
      }
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  const archivedCsv = strFromU8(files["statuses/archived.csv"]);

  assert.equal(files["statuses/archived.csv"] !== undefined, true);
  assert.equal(files["statuses/archived.webp"] !== undefined, true);
  assert.match(archivedCsv, /archived-1/);
  assert.match(archivedCsv, /Archived One/);
  assert.equal(bundle.wardrobeImageReports.length, 1);
  assert.equal(bundle.wardrobeImageReports[0].fileName, "statuses/archived.webp");
  assert.equal(bundle.wardrobeImageReports[0].missingImageCount, 1);
  assert.equal(bundle.wardrobeImageReports[0].warningCount, 1);
  assert.equal(bundle.wardrobeImageReports[0].warnings.length, 1);
  assert.equal(bundle.wardrobeImageReports[0].warnings[0].reason, "missing export image");
  assert.equal(bundle.wardrobeImageReports[0].warnings[0].itemId, "archived-1");
  assert.equal(bundle.wardrobeImageReports[0].warnings[0].status, "Archived");
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
      mimeType: "image/webp",
      blob: new Blob([`webp:${fileName}`], { type: "image/webp" }),
      report: {
        fileName,
        format: "webp",
        sizeBytes: 20,
        pixelWidth: 100,
        pixelHeight: 100
      }
    })
  });

  const files = unzipSync(new Uint8Array(await bundle.blob.arrayBuffer()));
  const readme = strFromU8(files["README.md"]);

  assert.equal(files["wardrobe/current-wardrobe.csv"], undefined);
  assert.equal(files["wardrobe/current-wardrobe.webp"], undefined);
  assert.equal(files["wardrobe/acquisition-pipeline.csv"], undefined);
  assert.equal(files["wardrobe/acquisition-pipeline.webp"], undefined);
  assert.match(readme, /Current Wardrobe/);
  assert.match(readme, /Acquisition Pipeline/);
});
