import { strToU8, zipSync } from "fflate";
import { normalizeCollections, slugPart } from "./itemModel.js";
import { serializeLibraryCsv } from "./libraryExport.js";
import {
  serializeFitpicsCsv,
  serializeSavedOutfitsCsv,
  serializeSavedOutfitsJson
} from "./metadataExport.js";
import { createFitpicSpreadExportOptions } from "./fitpicSpreadExport.js";
import { createWardrobeSpreadExportOptions } from "./wardrobeSpreadExport.js";
import { normalizeStatus } from "./typeDefaults.js";
import { renderFitpicImageExport } from "./fitpicImageExport.js";
import { renderWardrobeImageExport } from "./wardrobeImageExport.js";

const DEFAULT_EXCLUDED_COLLECTION = "Sportswear";

function normalizeUniqueStrings(values = []) {
  const seen = new Set();

  return (Array.isArray(values) ? values : []).reduce((normalized, value) => {
    const nextValue = typeof value === "string" ? value.trim() : "";

    if (!nextValue || seen.has(nextValue)) {
      return normalized;
    }

    seen.add(nextValue);
    normalized.push(nextValue);
    return normalized;
  }, []);
}

function matchesAnyCollection(item, collections = []) {
  const itemCollections = normalizeCollections(item?.collections);
  return collections.some((collection) => itemCollections.includes(collection));
}

function toZipPathSegment(value, fallback = "collection") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function createReadme({
  includedFiles = [],
  skippedDatasets = []
} = {}) {
  const lines = [
    "# OA AI Export Bundle",
    "",
    "This package is intended for AI analysis, not backup or restore.",
    "",
    "PNG exports provide visual context.",
    "CSV/JSON exports provide structured metadata.",
    "Titles connect visual exports with metadata rows.",
    "",
    "## Suggested analysis prompt",
    "",
    "> Analyze this wardrobe and fitpic dataset for gaps, redundancy, acquisition priorities, outfit patterns, silhouette balance, seasonality, underused items, and opportunities for outfit creation.",
    "",
    "## Included files",
    ""
  ];

  if (includedFiles.length) {
    includedFiles.forEach((file) => lines.push(`- ${file}`));
  } else {
    lines.push("- No files were generated.");
  }

  if (skippedDatasets.length) {
    lines.push("", "## Skipped empty datasets", "");
    skippedDatasets.forEach((dataset) => lines.push(`- ${dataset}`));
  }

  lines.push("");
  return lines.join("\n");
}

export function getOaAiCollectionOptions(items = []) {
  return [...new Set(items.flatMap((item) => normalizeCollections(item.collections)))]
    .sort((left, right) => left.localeCompare(right));
}

export function createDefaultOaAiExportOptions(collectionOptions = []) {
  const normalizedCollectionOptions = normalizeUniqueStrings(collectionOptions);
  const defaultSelectedCollections = normalizedCollectionOptions.includes(DEFAULT_EXCLUDED_COLLECTION)
    ? [DEFAULT_EXCLUDED_COLLECTION]
    : [];

  return {
    includeCurrentWardrobe: true,
    includeAcquisitionPipeline: true,
    includeFitpics: true,
    includeSavedOutfits: true,
    excludeCollectionsFromCurrentWardrobe: true,
    excludedCollections: defaultSelectedCollections,
    collectionExports: defaultSelectedCollections
  };
}

export function normalizeOaAiExportOptions(options = {}, collectionOptions = []) {
  const defaults = createDefaultOaAiExportOptions(collectionOptions);

  return {
    includeCurrentWardrobe: options.includeCurrentWardrobe !== false,
    includeAcquisitionPipeline: options.includeAcquisitionPipeline !== false,
    includeFitpics: options.includeFitpics !== false,
    includeSavedOutfits: options.includeSavedOutfits !== false,
    excludeCollectionsFromCurrentWardrobe: options.excludeCollectionsFromCurrentWardrobe !== false,
    excludedCollections: normalizeUniqueStrings(options.excludedCollections ?? defaults.excludedCollections),
    collectionExports: normalizeUniqueStrings(options.collectionExports ?? defaults.collectionExports)
  };
}

export function getCurrentWardrobeDatasetItems(items = [], options = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const excludedCollections = options.excludeCollectionsFromCurrentWardrobe
    ? normalizeUniqueStrings(options.excludedCollections)
    : [];

  return normalizedItems.filter((item) => {
    if (normalizeStatus(item?.status ?? item?.list) !== "Wardrobe") {
      return false;
    }

    if (excludedCollections.length && matchesAnyCollection(item, excludedCollections)) {
      return false;
    }

    return true;
  });
}

export function getAcquisitionPipelineDatasetItems(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => {
    const status = normalizeStatus(item?.status ?? item?.list);
    return status === "Wishlist" || status === "Incoming";
  });
}

export function getCollectionDatasetItems(items = [], collection = "") {
  const normalizedCollection = typeof collection === "string" ? collection.trim() : "";

  if (!normalizedCollection) {
    return [];
  }

  return (Array.isArray(items) ? items : []).filter((item) => normalizeCollections(item?.collections).includes(normalizedCollection));
}

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function addWardrobeDataset({
  archive,
  includedFiles,
  skippedDatasets,
  label,
  basePath,
  items,
  resolveAssetUrl,
  renderWardrobePng
}) {
  if (!items.length) {
    skippedDatasets.push(label);
    return;
  }

  const pngResult = await renderWardrobePng({
    items,
    options: createWardrobeSpreadExportOptions("reference"),
    resolveAssetUrl,
    fileName: `${basePath}.png`
  });

  archive[`${basePath}.csv`] = strToU8(serializeLibraryCsv(items));
  includedFiles.push(`${basePath}.csv`);

  if (pngResult?.blob) {
    archive[`${basePath}.png`] = await blobToBytes(pngResult.blob);
    includedFiles.push(`${basePath}.png`);
  }
}

export async function buildOaAiExportBundle({
  items = [],
  savedOutfits = [],
  fitpics = [],
  options = {},
  resolveAssetUrl = (value) => value,
  renderWardrobePng = renderWardrobeImageExport,
  renderFitpicPng = renderFitpicImageExport
} = {}) {
  const collectionOptions = getOaAiCollectionOptions(items);
  const normalizedOptions = normalizeOaAiExportOptions(options, collectionOptions);
  const archive = {};
  const includedFiles = [];
  const skippedDatasets = [];

  if (normalizedOptions.includeCurrentWardrobe) {
    await addWardrobeDataset({
      archive,
      includedFiles,
      skippedDatasets,
      label: "Current Wardrobe",
      basePath: "wardrobe/current-wardrobe",
      items: getCurrentWardrobeDatasetItems(items, normalizedOptions),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  if (normalizedOptions.includeAcquisitionPipeline) {
    await addWardrobeDataset({
      archive,
      includedFiles,
      skippedDatasets,
      label: "Acquisition Pipeline",
      basePath: "wardrobe/acquisition-pipeline",
      items: getAcquisitionPipelineDatasetItems(items),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  if (normalizedOptions.includeFitpics) {
    archive["fitpics/fitpics.csv"] = strToU8(serializeFitpicsCsv(fitpics, items));
    includedFiles.push("fitpics/fitpics.csv");

    const referenceResult = await renderFitpicPng({
      fitpics,
      options: createFitpicSpreadExportOptions("reference"),
      resolveAssetUrl,
      fileName: "fitpics-reference.png"
    });

    if (referenceResult?.blob) {
      archive["fitpics/fitpics-reference.png"] = await blobToBytes(referenceResult.blob);
      includedFiles.push("fitpics/fitpics-reference.png");
    }

    const compactResult = await renderFitpicPng({
      fitpics,
      options: createFitpicSpreadExportOptions("compact"),
      resolveAssetUrl,
      fileName: "fitpics-compact.png"
    });

    if (compactResult?.blob) {
      archive["fitpics/fitpics-compact.png"] = await blobToBytes(compactResult.blob);
      includedFiles.push("fitpics/fitpics-compact.png");
    }
  }

  if (normalizedOptions.includeSavedOutfits) {
    archive["saved-outfits/saved-outfits.csv"] = strToU8(serializeSavedOutfitsCsv(savedOutfits, items));
    archive["saved-outfits/saved-outfits.json"] = strToU8(serializeSavedOutfitsJson(savedOutfits, items));
    includedFiles.push("saved-outfits/saved-outfits.csv");
    includedFiles.push("saved-outfits/saved-outfits.json");
  }

  for (const collection of normalizedOptions.collectionExports) {
    const fileStub = toZipPathSegment(collection, slugPart(collection) || "collection");

    await addWardrobeDataset({
      archive,
      includedFiles,
      skippedDatasets,
      label: `Collection: ${collection}`,
      basePath: `collections/${fileStub}`,
      items: getCollectionDatasetItems(items, collection),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  const readme = createReadme({ includedFiles, skippedDatasets });
  archive["README.md"] = strToU8(readme);
  includedFiles.unshift("README.md");

  const zipBytes = zipSync(archive, {
    level: 0
  });
  const today = new Date().toISOString().slice(0, 10);

  return {
    blob: new Blob([zipBytes], { type: "application/zip" }),
    fileName: `oa-ai-export-${today}.zip`,
    includedFiles,
    skippedDatasets,
    options: normalizedOptions
  };
}
