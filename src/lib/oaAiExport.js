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
const OA_AI_EXPORT_DEBUG_PREFIX = "[OA_AI_EXPORT_DEBUG]";

function createOaAiWardrobeImageExportOptions() {
  return createWardrobeSpreadExportOptions("detailed");
}

function createOaAiWardrobeImageExportProfile() {
  return "ai";
}

function logOaAiExportDebug(event, payload = {}) {
  console.info(OA_AI_EXPORT_DEBUG_PREFIX, event, payload);
}

function logOaAiExportError(event, error, payload = {}) {
  console.error(OA_AI_EXPORT_DEBUG_PREFIX, event, {
    ...payload,
    error,
    message: error?.message ?? String(error),
    stack: error?.stack ?? ""
  });
}

export function formatOaAiExportStepLabel(step = "", context = {}) {
  if (step === "oa-ai-export:wardrobe-image-render") {
    return `${context.basePath || context.label || "wardrobe"} image render`;
  }

  if (step === "oa-ai-export:wardrobe-csv-generation") {
    return `${context.basePath || context.label || "wardrobe"} CSV generation`;
  }

  if (step === "oa-ai-export:wardrobe-image-bytes") {
    return `${context.fileName || context.basePath || context.label || "wardrobe"} image bytes`;
  }

  if (step === "oa-ai-export:fitpics-csv-generation") {
    return "fitpics CSV generation";
  }

  if (step === "oa-ai-export:fitpics-compact") {
    return "fitpics compact render";
  }

  if (step === "oa-ai-export:fitpics-details") {
    return "fitpics details render";
  }

  if (step === "oa-ai-export:fitpics-compact-bytes") {
    return "fitpics compact bytes";
  }

  if (step === "oa-ai-export:fitpics-details-bytes") {
    return "fitpics details bytes";
  }

  if (step === "oa-ai-export:saved-outfits") {
    return "saved outfits export";
  }

  if (step === "oa-ai-export:readme-generation") {
    return "README generation";
  }

  if (step === "oa-ai-export:zip-generation") {
    return "ZIP generation";
  }

  if (step === "oa-ai-export:status-export") {
    return `status export ${context.status || ""}`.trim();
  }

  if (step === "oa-ai-export:status-exports-combined") {
    return "combined status export";
  }

  if (step === "oa-ai-export:collection-export") {
    return `collection export ${context.collection || ""}`.trim();
  }

  if (step === "oa-ai-export:current-wardrobe") {
    return "current wardrobe export";
  }

  if (step === "oa-ai-export:acquisition-pipeline") {
    return "acquisition pipeline export";
  }

  return step || "unknown step";
}

function summarizeWardrobeItems(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
    id: item?.id ?? "",
    itemUuid: item?.itemUuid ?? "",
    name: item?.name ?? "",
    imageUrl: item?.imageUrl ?? "",
    sourceRelativePath: item?.sourceRelativePath ?? "",
    activeItemImageUuid: item?.activeItemImageUuid ?? null
  }));
}

function summarizeFitpics(fitpics = []) {
  return (Array.isArray(fitpics) ? fitpics : []).slice(0, 10).map((fitpic) => ({
    id: fitpic?.id ?? "",
    fitpicUuid: fitpic?.fitpicUuid ?? "",
    name: fitpic?.name ?? "",
    imageData: fitpic?.imageData ? "[present]" : "",
    primaryImageUuid: fitpic?.primaryImageUuid ?? "",
    fitpicImageCount: Array.isArray(fitpic?.fitpicImages) ? fitpic.fitpicImages.length : 0
  }));
}

function annotateOaAiExportError(error, context = {}) {
  if (error && typeof error === "object") {
    error.oaAiExportContext = {
      ...(error.oaAiExportContext && typeof error.oaAiExportContext === "object"
        ? error.oaAiExportContext
        : {}),
      ...context
    };
    if (context.step) {
      error.oaAiExportStep = context.step;
    }
  }

  return error;
}

async function runOaAiExportStep(step, context, operation) {
  logOaAiExportDebug(`${step}:start`, context);

  try {
    const result = await operation();
    logOaAiExportDebug(`${step}:complete`, context);
    return result;
  } catch (error) {
    annotateOaAiExportError(error, { step, ...context });
    logOaAiExportError(`${step}:error`, error, context);
    throw error;
  }
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
    logOaAiExportDebug("wardrobe-dataset:skipped-empty", {
      label,
      basePath
    });
    return;
  }

  const datasetContext = {
    label,
    basePath,
    itemCount: items.length,
    sampleItems: summarizeWardrobeItems(items)
  };

  await runOaAiExportStep("oa-ai-export:wardrobe-csv-generation", datasetContext, async () => {
    archive[`${basePath}.csv`] = strToU8(serializeLibraryCsv(items));
    includedFiles.push(`${basePath}.csv`);
  });

  const imageResult = await runOaAiExportStep("oa-ai-export:wardrobe-image-render", datasetContext, async () =>
    renderWardrobePng({
      items,
      options: wardrobeExportOptions,
      exportProfile: wardrobeExportProfile,
      resolveAssetUrl,
      fileName: `${basePath}.${wardrobeExportProfile === "ai" ? "webp" : "png"}`
    })
  );

  if (imageResult?.blob) {
    await runOaAiExportStep("oa-ai-export:wardrobe-image-bytes", {
      ...datasetContext,
      fileName: imageResult.fileName
    }, async () => {
      archive[imageResult.fileName] = await blobToBytes(imageResult.blob);
      includedFiles.push(imageResult.fileName);
      if (imageResult.report) {
        wardrobeImageReports.push(imageResult.report);
      }
    });
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

  logOaAiExportDebug("oa-ai-export:bundle-start", {
    itemCount: Array.isArray(items) ? items.length : 0,
    savedOutfitCount: Array.isArray(savedOutfits) ? savedOutfits.length : 0,
    fitpicCount: Array.isArray(fitpics) ? fitpics.length : 0,
    options: normalizedOptions
  });

  if (normalizedOptions.includeCurrentWardrobe) {
    await runOaAiExportStep("oa-ai-export:current-wardrobe", {
      itemCount: getCurrentWardrobeDatasetItems(items, normalizedOptions).length
    }, async () =>
      addWardrobeDataset({
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
      })
    );
  }

  if (normalizedOptions.includeAcquisitionPipeline) {
    await runOaAiExportStep("oa-ai-export:acquisition-pipeline", {
      itemCount: getAcquisitionPipelineDatasetItems(items).length
    }, async () =>
      addWardrobeDataset({
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
      })
    );
  }

  if (normalizedOptions.includeFitpics) {
    const fitpicContext = {
      fitpicCount: Array.isArray(fitpics) ? fitpics.length : 0,
      sampleFitpics: summarizeFitpics(fitpics)
    };

    await runOaAiExportStep("oa-ai-export:fitpics-csv-generation", fitpicContext, async () => {
      archive["fitpics/fitpics.csv"] = strToU8(serializeFitpicsCsv(fitpics, items));
      includedFiles.push("fitpics/fitpics.csv");
    });

    const compactResult = await runOaAiExportStep("oa-ai-export:fitpics-compact", fitpicContext, async () =>
      renderFitpicPng({
        fitpics,
        options: createFitpicSpreadExportOptions("compact"),
        exportProfile: "ai",
        exportProfileOverrides: {
          maxDetailImages: 0
        },
        resolveAssetUrl,
        fileName: "fitpics-compact.webp"
      })
    );

    if (compactResult?.blob) {
      await runOaAiExportStep("oa-ai-export:fitpics-compact-bytes", {
        ...fitpicContext,
        fileName: compactResult.fileName
      }, async () => {
        archive[`fitpics/${compactResult.fileName}`] = await blobToBytes(compactResult.blob);
        includedFiles.push(`fitpics/${compactResult.fileName}`);
        if (compactResult.report) {
          fitpicImageReports.push(compactResult.report);
        }
      });
    }

    const detailsResult = await runOaAiExportStep("oa-ai-export:fitpics-details", fitpicContext, async () =>
      renderFitpicPng({
        fitpics,
        options: createFitpicSpreadExportOptions("detailsOnly"),
        exportProfile: "detailsAi",
        resolveAssetUrl,
        fileName: "fitpics-details.webp"
      })
    );

    if (detailsResult?.blob) {
      await runOaAiExportStep("oa-ai-export:fitpics-details-bytes", {
        ...fitpicContext,
        fileName: detailsResult.fileName
      }, async () => {
        archive[`fitpics/${detailsResult.fileName}`] = await blobToBytes(detailsResult.blob);
        includedFiles.push(`fitpics/${detailsResult.fileName}`);
        if (detailsResult.report) {
          fitpicImageReports.push(detailsResult.report);
        }
      });
    }
  }

  if (normalizedOptions.includeSavedOutfits) {
    await runOaAiExportStep("oa-ai-export:saved-outfits", {
      savedOutfitCount: Array.isArray(savedOutfits) ? savedOutfits.length : 0
    }, async () => {
      archive["saved-outfits/saved-outfits.csv"] = strToU8(serializeSavedOutfitsCsv(savedOutfits, items));
      archive["saved-outfits/saved-outfits.json"] = strToU8(serializeSavedOutfitsJson(savedOutfits, items));
      includedFiles.push("saved-outfits/saved-outfits.csv");
      includedFiles.push("saved-outfits/saved-outfits.json");
    });
  }

  for (const collection of normalizedOptions.collectionExports) {
    const fileStub = toZipPathSegment(collection, slugPart(collection) || "collection");

    await runOaAiExportStep("oa-ai-export:collection-export", {
      collection,
      itemCount: getCollectionDatasetItems(items, collection).length
    }, async () =>
      addWardrobeDataset({
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
      })
    );
  }

  if (normalizedOptions.statusExports.length) {
    if (normalizedOptions.statusExportMode === "separate") {
      for (const status of normalizedOptions.statusExports) {
        const fileStub = toZipPathSegment(status, slugPart(status) || "status");
        const basePath = `statuses/${fileStub}`;
        const statusItems = getStatusDatasetItems(items, [status]);

        await runOaAiExportStep("oa-ai-export:status-export", {
          status,
          mode: "separate",
          itemCount: statusItems.length,
          basePath
        }, async () =>
          addWardrobeDataset({
            archive,
            includedFiles,
            skippedDatasets,
            wardrobeImageReports,
            label: `Status: ${status}`,
            basePath,
            items: statusItems,
            wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
            wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
            resolveAssetUrl,
            renderWardrobePng
          })
        );
      }
    } else {
      const fileStub = toZipPathSegment(normalizedOptions.statusExports.join("-"), "status-selection");
      const basePath = `statuses/${fileStub}`;
      const statusItems = getStatusDatasetItems(items, normalizedOptions.statusExports);

      await runOaAiExportStep("oa-ai-export:status-exports-combined", {
        statuses: normalizedOptions.statusExports,
        mode: "combined",
        itemCount: statusItems.length,
        basePath
      }, async () =>
        addWardrobeDataset({
          archive,
          includedFiles,
          skippedDatasets,
          wardrobeImageReports,
          label: `Statuses: ${normalizedOptions.statusExports.join(", ")}`,
          basePath,
          items: statusItems,
          wardrobeExportOptions: createOaAiWardrobeImageExportOptions(),
          wardrobeExportProfile: createOaAiWardrobeImageExportProfile(),
          resolveAssetUrl,
          renderWardrobePng
        })
      );
    }
  }

  await runOaAiExportStep("oa-ai-export:readme-generation", {
    includedFileCount: includedFiles.length,
    skippedDatasetCount: skippedDatasets.length
  }, async () => {
    const readme = createReadme({ includedFiles, skippedDatasets });
    archive["README.md"] = strToU8(readme);
    includedFiles.unshift("README.md");
  });

  const zipBytes = await runOaAiExportStep("oa-ai-export:zip-generation", {
    archiveFileCount: Object.keys(archive).length
  }, async () => zipSync(archive, {
    level: 0
  }));
  const today = new Date().toISOString().slice(0, 10);

  logOaAiExportDebug("oa-ai-export:bundle-complete", {
    includedFileCount: includedFiles.length,
    skippedDatasetCount: skippedDatasets.length
  });

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
