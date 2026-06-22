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
import { normalizeStatus, sortStatusOptions } from "./typeDefaults.js";
import { renderFitpicImageExport } from "./fitpicImageExport.js";
import { renderWardrobeImageExport } from "./wardrobeImageExport.js";

const DEFAULT_EXCLUDED_COLLECTIONS = ["Beater Wardrobe", "Sportswear"];
const DEFAULT_COLLECTION_EXPORTS = ["Core Wardrobe", "Sportswear"];
const DEFAULT_STATUS_EXPORTS = ["Interested", "Wishlist", "Incoming", "Selling", "Archived"];

function createOaAiWardrobeImageExportOptions() {
  return createWardrobeSpreadExportOptions("detailed");
}

function createOaAiWardrobeImageExportProfile() {
  return "ai";
}

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
    "## Acquisition Pipeline Status Interpretation",
    "",
    "### Overview",
    "",
    "The acquisition pipeline represents interest and evaluation states, not inventory states.",
    "",
    "These statuses should not be interpreted the same way as wardrobe ownership data.",
    "",
    "### Interested",
    "",
    "- Items that have attracted attention and may warrant future research, monitoring, or consideration.",
    "- Being marked as Interested does not imply purchase intent.",
    "- Interested items are exploratory rather than committed acquisition candidates.",
    "",
    "### Wishlist",
    "",
    "- Items actively considered desirable additions to the wardrobe.",
    "- Wishlist items represent current acquisition candidates.",
    "- Wishlist does not guarantee eventual purchase.",
    "",
    "### Incoming",
    "",
    "- Items already purchased or otherwise acquired.",
    "- Items may still be awaiting delivery, inspection, fitting, evaluation, or integration into the wardrobe.",
    "",
    "### Archived",
    "",
    "Important:",
    "",
    "Archived does NOT mean seasonal storage.",
    "",
    "Archived is effectively the graveyard of the acquisition pipeline.",
    "",
    "Items may be archived because:",
    "",
    "- Interest disappeared over time",
    "- Better alternatives were found",
    "- The item no longer fits wardrobe direction",
    "- Sizing, condition, price, or availability made acquisition unlikely",
    "- The underlying wardrobe problem was solved elsewhere",
    "",
    "Archived items should generally be interpreted as:",
    "",
    "- Rejected acquisition candidates",
    "- Abandoned interests",
    "- Historical acquisition research",
    "",
    "They should NOT be interpreted as active wishlist items, latent demand, or future purchase intent.",
    "",
    "### Selling",
    "",
    "- Items being considered for removal from the wardrobe.",
    "- Items actively listed or likely to be listed.",
    "- Represents negative acquisition pressure rather than positive acquisition interest.",
    "",
    "### Analytical Notes",
    "",
    "When analyzing acquisition data:",
    "",
    "- Wishlist and Incoming are generally the most relevant indicators of future wardrobe direction.",
    "- Interested items should be interpreted cautiously because many never progress further.",
    "- Archived items are useful for understanding how wardrobe direction evolved over time, but should not be treated as evidence of current preferences.",
    "- High counts in Archived do not indicate ongoing interest; they often indicate the opposite.",
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

export function getOaAiStatusOptions(items = []) {
  return sortStatusOptions(
    (Array.isArray(items) ? items : [])
      .map((item) => normalizeStatus(item?.status ?? item?.list))
      .filter(Boolean)
  );
}

export function createDefaultOaAiExportOptions(collectionOptions = [], statusOptions = []) {
  const normalizedCollectionOptions = normalizeUniqueStrings(collectionOptions);
  const normalizedStatusOptions = sortStatusOptions(statusOptions);
  const defaultExcludedCollections = DEFAULT_EXCLUDED_COLLECTIONS.filter((collection) =>
    normalizedCollectionOptions.includes(collection)
  );
  const defaultCollectionExports = DEFAULT_COLLECTION_EXPORTS.filter((collection) =>
    normalizedCollectionOptions.includes(collection)
  );
  const defaultStatusExports = DEFAULT_STATUS_EXPORTS.filter((status) =>
    normalizedStatusOptions.includes(status)
  );

  return {
    includeCurrentWardrobe: true,
    includeAcquisitionPipeline: false,
    includeFitpics: true,
    includeSavedOutfits: true,
    excludeCollectionsFromCurrentWardrobe: true,
    excludedCollections: defaultExcludedCollections,
    collectionExports: defaultCollectionExports,
    statusExports: defaultStatusExports,
    statusExportMode: "separate"
  };
}

export function normalizeOaAiExportOptions(options = {}, collectionOptions = [], statusOptions = []) {
  const defaults = createDefaultOaAiExportOptions(collectionOptions, statusOptions);

  return {
    includeCurrentWardrobe: options.includeCurrentWardrobe !== false,
    includeAcquisitionPipeline: options.includeAcquisitionPipeline !== false,
    includeFitpics: options.includeFitpics !== false,
    includeSavedOutfits: options.includeSavedOutfits !== false,
    excludeCollectionsFromCurrentWardrobe: options.excludeCollectionsFromCurrentWardrobe !== false,
    excludedCollections: normalizeUniqueStrings(options.excludedCollections ?? defaults.excludedCollections),
    collectionExports: normalizeUniqueStrings(options.collectionExports ?? defaults.collectionExports),
    statusExports: sortStatusOptions(options.statusExports ?? []).filter((status) => statusOptions.includes(status) || !statusOptions.length),
    statusExportMode: options.statusExportMode === "separate" ? "separate" : "combined"
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

export function getStatusDatasetItems(items = [], statuses = []) {
  const normalizedStatuses = new Set(sortStatusOptions(statuses));

  if (!normalizedStatuses.size) {
    return [];
  }

  return (Array.isArray(items) ? items : []).filter((item) =>
    normalizedStatuses.has(normalizeStatus(item?.status ?? item?.list))
  );
}

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function addWardrobeDataset({
  archive,
  includedFiles,
  skippedDatasets,
  wardrobeImageReports,
  label,
  basePath,
  items,
  resolveAssetUrl,
  renderWardrobePng,
  wardrobeExportOptions = createWardrobeSpreadExportOptions("reference"),
  wardrobeExportProfile = "png"
}) {
  if (!items.length) {
    skippedDatasets.push(label);
    return;
  }

  const imageResult = await renderWardrobePng({
    items,
    options: wardrobeExportOptions,
    exportProfile: wardrobeExportProfile,
    resolveAssetUrl,
    fileName: `${basePath}.${wardrobeExportProfile === "ai" ? "webp" : "png"}`
  });

  archive[`${basePath}.csv`] = strToU8(serializeLibraryCsv(items));
  includedFiles.push(`${basePath}.csv`);

  if (imageResult?.blob) {
    archive[imageResult.fileName] = await blobToBytes(imageResult.blob);
    includedFiles.push(imageResult.fileName);
    if (imageResult.report) {
      wardrobeImageReports.push(imageResult.report);
    }
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
  const statusOptions = getOaAiStatusOptions(items);
  const normalizedOptions = normalizeOaAiExportOptions(options, collectionOptions, statusOptions);
  const archive = {};
  const includedFiles = [];
  const skippedDatasets = [];
  const wardrobeImageReports = [];
  const fitpicImageReports = [];

  if (normalizedOptions.includeCurrentWardrobe) {
    await addWardrobeDataset({
      archive,
      includedFiles,
      skippedDatasets,
      wardrobeImageReports,
      label: "Current Wardrobe",
      basePath: "wardrobe/current-wardrobe",
      items: getCurrentWardrobeDatasetItems(items, normalizedOptions),
      wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
      wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  if (normalizedOptions.includeAcquisitionPipeline) {
    await addWardrobeDataset({
      archive,
      includedFiles,
      skippedDatasets,
      wardrobeImageReports,
      label: "Acquisition Pipeline",
      basePath: "wardrobe/acquisition-pipeline",
      items: getAcquisitionPipelineDatasetItems(items),
      wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
      wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  if (normalizedOptions.includeFitpics) {
    archive["fitpics/fitpics.csv"] = strToU8(serializeFitpicsCsv(fitpics, items));
    includedFiles.push("fitpics/fitpics.csv");

    const compactResult = await renderFitpicPng({
      fitpics,
      options: createFitpicSpreadExportOptions("compact"),
      exportProfile: "ai",
      exportProfileOverrides: {
        maxDetailImages: 0
      },
      resolveAssetUrl,
      fileName: "fitpics-compact.webp"
    });

    if (compactResult?.blob) {
      archive[`fitpics/${compactResult.fileName}`] = await blobToBytes(compactResult.blob);
      includedFiles.push(`fitpics/${compactResult.fileName}`);
      if (compactResult.report) {
        fitpicImageReports.push(compactResult.report);
      }
    }

    const detailsResult = await renderFitpicPng({
      fitpics,
      options: createFitpicSpreadExportOptions("detailsOnly"),
      exportProfile: "detailsAi",
      resolveAssetUrl,
      fileName: "fitpics-details.webp"
    });

    if (detailsResult?.blob) {
      archive[`fitpics/${detailsResult.fileName}`] = await blobToBytes(detailsResult.blob);
      includedFiles.push(`fitpics/${detailsResult.fileName}`);
      if (detailsResult.report) {
        fitpicImageReports.push(detailsResult.report);
      }
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
      wardrobeImageReports,
      label: `Collection: ${collection}`,
      basePath: `collections/${fileStub}`,
      items: getCollectionDatasetItems(items, collection),
      wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
      wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
      resolveAssetUrl,
      renderWardrobePng
    });
  }

  if (normalizedOptions.statusExports.length) {
    if (normalizedOptions.statusExportMode === "separate") {
      for (const status of normalizedOptions.statusExports) {
        const fileStub = toZipPathSegment(status, slugPart(status) || "status");

        await addWardrobeDataset({
          archive,
          includedFiles,
          skippedDatasets,
          wardrobeImageReports,
          label: `Status: ${status}`,
          basePath: `statuses/${fileStub}`,
          items: getStatusDatasetItems(items, [status]),
          wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
          wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
          resolveAssetUrl,
          renderWardrobePng
        });
      }
    } else {
      const fileStub = toZipPathSegment(normalizedOptions.statusExports.join("-"), "status-selection");

      await addWardrobeDataset({
        archive,
        includedFiles,
        skippedDatasets,
        wardrobeImageReports,
        label: `Statuses: ${normalizedOptions.statusExports.join(", ")}`,
        basePath: `statuses/${fileStub}`,
        items: getStatusDatasetItems(items, normalizedOptions.statusExports),
        wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
        wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
        resolveAssetUrl,
        renderWardrobePng
      });
    }
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
    options: normalizedOptions,
    wardrobeImageReports,
    fitpicImageReports
  };
}
