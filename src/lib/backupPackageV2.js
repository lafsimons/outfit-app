import { strToU8, zipSync } from "fflate";
import { getActiveWardrobeItemImageAsset, getWardrobeItemImages } from "./itemModel.js";
import { getFitpicImages, getPrimaryFitpicImage } from "./fitpics.js";

export const PACKAGE_SOURCE = "outfit-app-package";
export const PACKAGE_VERSION = 1;
export const PACKAGE_FORMAT = "directory";
export const PACKAGE_ASSET_POLICY = "preview-only";
export const PACKAGE_MANIFEST_FILE = "manifest.json";
export const PACKAGE_APP_STATE_FILE = "appState.json";
export const PACKAGE_WARDROBE_ITEMS_FILE = "wardrobe-items.ndjson";
export const PACKAGE_FITPICS_FILE = "fitpics.ndjson";
export const PACKAGE_SAVED_OUTFITS_FILE = "saved-outfits.ndjson";
export const PACKAGE_MEDIA_DIR = "media";
export const PACKAGE_WARDROBE_PREVIEWS_DIR = "media/wardrobe-previews";
export const PACKAGE_FITPIC_PREVIEWS_DIR = "media/fitpic-previews";
export const PACKAGE_WARNINGS_FILE = "export-warnings.json";

const MIME_EXTENSION_MAP = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeCount(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.round(numericValue) : 0;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWarningMessage(value, fallback = "Unknown export warning.") {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function createExportWarning({
  entityType = "",
  id = "",
  stableId = "",
  field = "",
  message = ""
} = {}) {
  return {
    entityType: normalizeText(entityType),
    id: normalizeText(id),
    stableId: normalizeText(stableId),
    field: normalizeText(field),
    message: normalizeWarningMessage(message)
  };
}

function createJsonText(value) {
  return JSON.stringify(value, null, 2);
}

function serializeNdjsonRecord(record) {
  return `${JSON.stringify(record)}\n`;
}

function sanitizeFileSegment(value, fallback = "asset") {
  const normalized = typeof value === "string" ? value.normalize("NFKD") : "";
  const ascii = normalized.replace(/[^\x00-\x7F]/g, "");
  const safe = ascii
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || fallback;
}

function getExtensionFromMimeType(mimeType = "") {
  return MIME_EXTENSION_MAP[normalizeText(mimeType).toLowerCase()] ?? "";
}

function getExtensionFromFilename(filename = "") {
  const normalized = normalizeText(filename).toLowerCase();

  if (!normalized.includes(".")) {
    return "";
  }

  const extension = normalized.slice(normalized.lastIndexOf("."));
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

function getExtensionFromDataUrl(dataUrl = "") {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return "";
  }

  const mimeType = dataUrl.match(/^data:([^;,]+)/i)?.[1] ?? "";
  return getExtensionFromMimeType(mimeType);
}

function ensureImageVariantRecord(value, fallbackSrc = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const nextRecord = cloneValue(value);
    nextRecord.src = normalizeText(nextRecord.src);
    if ("packagePath" in nextRecord) {
      delete nextRecord.packagePath;
    }
    return nextRecord;
  }

  return {
    src: normalizeText(typeof value === "string" ? value : fallbackSrc)
  };
}

function createMetadataOnlyVariant(value, fallbackSrc = "") {
  const record = ensureImageVariantRecord(value, fallbackSrc);
  return {
    ...record,
    src: ""
  };
}

function createEmptyVariantRecord() {
  return { src: "" };
}

function stripLocalOnlyAppState(appState = {}) {
  const {
    recentOutfits,
    savedOutfits,
    fitpics,
    ...rest
  } = appState && typeof appState === "object" && !Array.isArray(appState) ? appState : {};

  return rest;
}

export function buildBackupPackageManifest({
  exportedAt = new Date().toISOString(),
  wardrobeItemCount = 0,
  fitpicCount = 0,
  savedOutfitCount = 0,
  wardrobePreviewFileCount = 0,
  fitpicPreviewFileCount = 0
} = {}) {
  return {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt,
    format: PACKAGE_FORMAT,
    assetPolicy: PACKAGE_ASSET_POLICY,
    wardrobeItemCount: normalizeCount(wardrobeItemCount),
    fitpicCount: normalizeCount(fitpicCount),
    savedOutfitCount: normalizeCount(savedOutfitCount),
    wardrobePreviewFileCount: normalizeCount(wardrobePreviewFileCount),
    fitpicPreviewFileCount: normalizeCount(fitpicPreviewFileCount),
    files: {
      appState: PACKAGE_APP_STATE_FILE,
      wardrobeItems: PACKAGE_WARDROBE_ITEMS_FILE,
      fitpics: PACKAGE_FITPICS_FILE,
      savedOutfits: PACKAGE_SAVED_OUTFITS_FILE,
      wardrobePreviewsDir: PACKAGE_WARDROBE_PREVIEWS_DIR,
      fitpicPreviewsDir: PACKAGE_FITPIC_PREVIEWS_DIR
    }
  };
}

export function validateBackupPackageManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Backup package manifest is invalid.");
  }

  if (manifest.source !== PACKAGE_SOURCE) {
    throw new Error("Backup package source is invalid.");
  }

  if (manifest.version !== PACKAGE_VERSION) {
    throw new Error("Backup package version is not supported.");
  }

  if (manifest.format !== PACKAGE_FORMAT) {
    throw new Error("Backup package format is invalid.");
  }

  if (manifest.assetPolicy !== PACKAGE_ASSET_POLICY) {
    throw new Error("Backup package asset policy is invalid.");
  }

  if (manifest?.files?.appState !== PACKAGE_APP_STATE_FILE) {
    throw new Error("Backup package app state file is invalid.");
  }

  if (manifest?.files?.wardrobeItems !== PACKAGE_WARDROBE_ITEMS_FILE) {
    throw new Error("Backup package wardrobe items file is invalid.");
  }

  if (manifest?.files?.fitpics !== PACKAGE_FITPICS_FILE) {
    throw new Error("Backup package fitpics file is invalid.");
  }

  if (manifest?.files?.savedOutfits !== PACKAGE_SAVED_OUTFITS_FILE) {
    throw new Error("Backup package saved outfits file is invalid.");
  }

  if (manifest?.files?.wardrobePreviewsDir !== PACKAGE_WARDROBE_PREVIEWS_DIR) {
    throw new Error("Backup package wardrobe previews directory is invalid.");
  }

  if (manifest?.files?.fitpicPreviewsDir !== PACKAGE_FITPIC_PREVIEWS_DIR) {
    throw new Error("Backup package fitpic previews directory is invalid.");
  }

  [
    "wardrobeItemCount",
    "fitpicCount",
    "savedOutfitCount",
    "wardrobePreviewFileCount",
    "fitpicPreviewFileCount"
  ].forEach((field) => {
    if (normalizeCount(manifest[field]) !== manifest[field]) {
      throw new Error(`Backup package ${field} is invalid.`);
    }
  });

  return manifest;
}

function buildWarningReport({
  exportedAt = new Date().toISOString(),
  warnings = []
} = {}) {
  const normalizedWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => warning && typeof warning === "object")
    : [];

  return {
    source: PACKAGE_SOURCE,
    version: PACKAGE_VERSION,
    exportedAt,
    warningCount: normalizedWarnings.length,
    warnings: normalizedWarnings
  };
}

export function findEmbeddedDataImagePaths(value, path = "") {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? [path || "$"] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findEmbeddedDataImagePaths(entry, `${path}[${index}]`));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    const nextPath = path ? `${path}.${key}` : key;
    return findEmbeddedDataImagePaths(entry, nextPath);
  });
}

function stripEmbeddedDataImageFields(value) {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? "" : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stripEmbeddedDataImageFields(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, stripEmbeddedDataImageFields(entry)])
  );
}

function getFirstEmbeddedDataImagePath(record) {
  return findEmbeddedDataImagePaths(record)[0] ?? "";
}

async function resolveImageBlob(source, options = {}) {
  const normalizedSource = normalizeText(source);

  if (!normalizedSource) {
    return null;
  }

  const resolvedSource = typeof options.resolveAssetUrl === "function"
    ? normalizeText(options.resolveAssetUrl(normalizedSource) ?? normalizedSource)
    : normalizedSource;

  if (!resolvedSource) {
    return null;
  }

  try {
    const response = await fetch(resolvedSource);
    if (!response.ok) {
      return null;
    }

    return response.blob();
  } catch {
    return null;
  }
}

function inferPackageExtension({
  mimeType = "",
  originalFilename = "",
  source = ""
} = {}) {
  return (
    getExtensionFromMimeType(mimeType)
    || getExtensionFromFilename(originalFilename)
    || getExtensionFromDataUrl(source)
    || ".bin"
  );
}

function buildWardrobePreviewFileName(asset = {}) {
  const stableBase = sanitizeFileSegment(asset.assetUuid || asset.parentItemImageUuid || "wardrobe-preview", "wardrobe-preview");
  const extension = inferPackageExtension({
    mimeType: asset?.images?.preview?.mimeType || asset?.mimeType || "",
    originalFilename: asset?.images?.preview?.originalFilename || asset?.originalFilename || "",
    source: asset?.imageUrl || asset?.images?.preview?.src || ""
  });

  return `${stableBase}${extension}`;
}

function buildFitpicPreviewFileName(fitpicImage = {}) {
  const stableBase = sanitizeFileSegment(fitpicImage.fitpicImageUuid || fitpicImage.parentFitpicUuid || "fitpic-preview", "fitpic-preview");
  const previewRecord = fitpicImage?.images?.preview;
  const previewSource = typeof previewRecord === "string" ? previewRecord : previewRecord?.src || "";
  const extension = inferPackageExtension({
    mimeType: fitpicImage?.sourceMimeType || fitpicImage?.mimeType || "",
    originalFilename: fitpicImage?.sourceOriginalFilename || "",
    source: fitpicImage.imageData || previewSource
  });

  return `${stableBase}${extension}`;
}

function getWardrobeAssetCandidateSources(asset = {}) {
  return [
    asset?.imageUrl,
    asset?.images?.preview?.src,
    asset?.images?.thumbnail?.src,
    asset?.images?.original?.src
  ].map(normalizeText).filter(Boolean);
}

function getFitpicCandidateSources(fitpicImage = {}) {
  const previewValue = fitpicImage?.images?.preview;
  const thumbnailValue = fitpicImage?.images?.thumbnail;
  const originalValue = fitpicImage?.images?.original;

  return [
    fitpicImage?.imageData,
    typeof previewValue === "string" ? previewValue : previewValue?.src,
    typeof thumbnailValue === "string" ? thumbnailValue : thumbnailValue?.src,
    typeof originalValue === "string" ? originalValue : originalValue?.src
  ].map(normalizeText).filter(Boolean);
}

function createWardrobeExportAssetMetadata(asset = {}, packagePath = "") {
  const preview = createMetadataOnlyVariant(asset?.images?.preview, asset?.imageUrl);
  const thumbnail = createMetadataOnlyVariant(asset?.images?.thumbnail);
  const original = createMetadataOnlyVariant(asset?.images?.original);
  const strippedAsset = stripEmbeddedDataImageFields(cloneValue(asset));

  return {
    ...strippedAsset,
    src: "",
    dataUrl: "",
    imageData: "",
    imageUrl: "",
    images: {
      original,
      preview: {
        ...preview,
        ...(packagePath ? { packagePath } : {})
      },
      thumbnail
    }
  };
}

function createWardrobeItemRecord(item, itemImages, activePackagePath = "") {
  const nextItem = stripEmbeddedDataImageFields(cloneValue(item));
  const preview = createMetadataOnlyVariant(nextItem?.images?.preview, nextItem?.imageUrl);
  const thumbnail = createMetadataOnlyVariant(nextItem?.images?.thumbnail);
  const original = createMetadataOnlyVariant(nextItem?.images?.original);

  nextItem.itemImages = itemImages;
  nextItem.src = "";
  nextItem.dataUrl = "";
  nextItem.imageData = "";
  nextItem.imageUrl = "";
  nextItem.images = {
    original,
    preview: {
      ...preview,
      ...(activePackagePath ? { packagePath: activePackagePath } : {})
    },
    thumbnail
  };

  return nextItem;
}

function createWardrobeItemImageRecord(itemImage, canonicalAsset, derivedAssets) {
  const nextItemImage = stripEmbeddedDataImageFields(cloneValue(itemImage));

  return {
    ...nextItemImage,
    src: "",
    dataUrl: "",
    imageData: "",
    imageUrl: "",
    images: {
      original: createMetadataOnlyVariant(nextItemImage?.images?.original),
      preview: createMetadataOnlyVariant(nextItemImage?.images?.preview, nextItemImage?.imageUrl || nextItemImage?.imageData || nextItemImage?.src || nextItemImage?.dataUrl),
      thumbnail: createMetadataOnlyVariant(nextItemImage?.images?.thumbnail)
    },
    canonicalAsset,
    derivedAssets
  };
}

function createFitpicImageMetadataRecord(currentValue, packagePath = "") {
  const previewMetadata =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? createMetadataOnlyVariant(currentValue.preview)
      : createEmptyVariantRecord();
  const originalMetadata =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? createMetadataOnlyVariant(currentValue.original)
      : createEmptyVariantRecord();
  const thumbnailMetadata =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? createMetadataOnlyVariant(currentValue.thumbnail)
      : createEmptyVariantRecord();

  return {
    original: originalMetadata,
    preview: {
      ...previewMetadata,
      ...(packagePath ? { packagePath } : {})
    },
    thumbnail: thumbnailMetadata
  };
}

function createFitpicExportImageRecord(fitpicImage, packagePath = "") {
  const nextFitpicImage = stripEmbeddedDataImageFields(cloneValue(fitpicImage));

  return {
    ...nextFitpicImage,
    src: "",
    dataUrl: "",
    imageData: "",
    images: createFitpicImageMetadataRecord(fitpicImage?.images, packagePath)
  };
}

function createFitpicRecord(fitpic, fitpicImages, primaryPackagePath = "") {
  const nextFitpic = stripEmbeddedDataImageFields(cloneValue(fitpic));

  nextFitpic.fitpicImages = fitpicImages;
  nextFitpic.src = "";
  nextFitpic.dataUrl = "";
  nextFitpic.imageData = "";
  nextFitpic.images = createFitpicImageMetadataRecord(nextFitpic?.images, primaryPackagePath);

  return nextFitpic;
}

async function extractWardrobeAsset(asset, options, warnings) {
  const previewBlob = await (async () => {
    for (const source of getWardrobeAssetCandidateSources(asset)) {
      const blob = await resolveImageBlob(source, options);

      if (blob) {
        return blob;
      }
    }

    return null;
  })();

  if (!previewBlob) {
    warnings.push(
      createExportWarning({
        entityType: "oaWardrobeAsset",
        id: asset?.assetUuid || asset?.parentItemImageUuid || "",
        stableId: asset?.assetUuid || "",
        field: "images.preview",
        message: "Omitted unresolved wardrobe preview media from export because no resolvable preview payload was available."
      })
    );

    return {
      assetRecord: createWardrobeExportAssetMetadata(asset),
      file: null
    };
  }

  const fileName = buildWardrobePreviewFileName(asset);
  const packagePath = `${PACKAGE_WARDROBE_PREVIEWS_DIR}/${fileName}`;

  return {
    assetRecord: createWardrobeExportAssetMetadata(asset, packagePath),
    file: {
      path: packagePath,
      blob: previewBlob
    }
  };
}

async function extractFitpicImage(fitpicImage, options, warnings) {
  const previewBlob = await (async () => {
    for (const source of getFitpicCandidateSources(fitpicImage)) {
      const blob = await resolveImageBlob(source, options);

      if (blob) {
        return blob;
      }
    }

    return null;
  })();

  if (!previewBlob) {
    warnings.push(
      createExportWarning({
        entityType: "oaFitpicImage",
        id: fitpicImage?.fitpicImageUuid || "",
        stableId: fitpicImage?.parentFitpicUuid || "",
        field: "images.preview",
        message: "Omitted unresolved fitpic preview media from export because no resolvable preview payload was available."
      })
    );

    return {
      fitpicImageRecord: createFitpicExportImageRecord(fitpicImage),
      file: null
    };
  }

  const fileName = buildFitpicPreviewFileName(fitpicImage);
  const packagePath = `${PACKAGE_FITPIC_PREVIEWS_DIR}/${fileName}`;

  return {
    fitpicImageRecord: createFitpicExportImageRecord(fitpicImage, packagePath),
    file: {
      path: packagePath,
      blob: previewBlob
    }
  };
}

async function buildWardrobeItemsExport(items, options, warnings) {
  const records = [];
  const files = [];

  for (const originalItem of Array.isArray(items) ? items : []) {
    const itemImages = getWardrobeItemImages(originalItem);
    const exportedItemImages = [];
    const packagePathByAssetUuid = new Map();

    for (const itemImage of itemImages) {
      const exportedCanonical = await extractWardrobeAsset(itemImage.canonicalAsset, options, warnings);
      if (exportedCanonical.file) {
        files.push(exportedCanonical.file);
        packagePathByAssetUuid.set(itemImage.canonicalAsset.assetUuid, exportedCanonical.file.path);
      }

      const exportedDerivedAssets = [];
      for (const derivedAsset of Array.isArray(itemImage.derivedAssets) ? itemImage.derivedAssets : []) {
        const exportedDerived = await extractWardrobeAsset(derivedAsset, options, warnings);
        if (exportedDerived.file) {
          files.push(exportedDerived.file);
          packagePathByAssetUuid.set(derivedAsset.assetUuid, exportedDerived.file.path);
        }
        exportedDerivedAssets.push(exportedDerived.assetRecord);
      }

      exportedItemImages.push(
        createWardrobeItemImageRecord(itemImage, exportedCanonical.assetRecord, exportedDerivedAssets)
      );
    }

    const activeAsset = getActiveWardrobeItemImageAsset({
      ...originalItem,
      itemImages: exportedItemImages
    });
    const activePackagePath = activeAsset?.assetUuid ? packagePathByAssetUuid.get(activeAsset.assetUuid) ?? "" : "";
    const nextRecord = createWardrobeItemRecord(originalItem, exportedItemImages, activePackagePath);

    const remainingEmbeddedPath = getFirstEmbeddedDataImagePath(nextRecord);
    if (remainingEmbeddedPath) {
      throw new Error(
        `Wardrobe item "${normalizeText(originalItem?.id) || "unknown"}" still contains embedded image data after package export shaping at "${remainingEmbeddedPath}".`
      );
    }

    records.push(nextRecord);
  }

  return { records, files };
}

async function buildFitpicsExport(fitpics, options, warnings) {
  const records = [];
  const files = [];

  for (const originalFitpic of Array.isArray(fitpics) ? fitpics : []) {
    const fitpicImages = getFitpicImages(originalFitpic);
    const exportedFitpicImages = [];
    const packagePathByImageUuid = new Map();

    for (const fitpicImage of fitpicImages) {
      const exportedFitpicImage = await extractFitpicImage(fitpicImage, options, warnings);
      if (exportedFitpicImage.file) {
        files.push(exportedFitpicImage.file);
        packagePathByImageUuid.set(fitpicImage.fitpicImageUuid, exportedFitpicImage.file.path);
      }
      exportedFitpicImages.push(exportedFitpicImage.fitpicImageRecord);
    }

    const normalizedPrimaryImageUuid = normalizeText(originalFitpic?.primaryImageUuid);
    const primaryFitpicImage = exportedFitpicImages.find(
      (fitpicImage) => fitpicImage.fitpicImageUuid === normalizedPrimaryImageUuid
    ) ?? exportedFitpicImages[0] ?? null;
    const primaryPackagePath = primaryFitpicImage?.fitpicImageUuid
      ? packagePathByImageUuid.get(primaryFitpicImage.fitpicImageUuid) ?? ""
      : "";
    const nextRecord = createFitpicRecord(originalFitpic, exportedFitpicImages, primaryPackagePath);

    const remainingEmbeddedPath = getFirstEmbeddedDataImagePath(nextRecord);
    if (remainingEmbeddedPath) {
      throw new Error(
        `Fitpic "${normalizeText(originalFitpic?.id) || "unknown"}" still contains embedded image data after package export shaping at "${remainingEmbeddedPath}".`
      );
    }

    records.push(nextRecord);
  }

  return { records, files };
}

function buildSavedOutfitsExport(savedOutfits = []) {
  return (Array.isArray(savedOutfits) ? savedOutfits : []).map((savedOutfit) => cloneValue(savedOutfit));
}

function buildAppStateExport(appState) {
  return cloneValue(stripLocalOnlyAppState(appState));
}

async function blobToUint8Array(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function buildBackupPackage({
  items = [],
  appState = {},
  resolveAssetUrl
} = {}) {
  const exportedAt = new Date().toISOString();
  const warnings = [];
  const wardrobeResult = await buildWardrobeItemsExport(items, { resolveAssetUrl }, warnings);
  const fitpicsResult = await buildFitpicsExport(appState?.fitpics, { resolveAssetUrl }, warnings);
  const savedOutfitRecords = buildSavedOutfitsExport(appState?.savedOutfits);
  const exportedAppState = buildAppStateExport(appState);
  const warningReport = buildWarningReport({
    exportedAt,
    warnings
  });
  const manifest = buildBackupPackageManifest({
    exportedAt,
    wardrobeItemCount: wardrobeResult.records.length,
    fitpicCount: fitpicsResult.records.length,
    savedOutfitCount: savedOutfitRecords.length,
    wardrobePreviewFileCount: wardrobeResult.files.length,
    fitpicPreviewFileCount: fitpicsResult.files.length
  });

  validateBackupPackageManifest(manifest);

  const files = new Map();
  files.set(PACKAGE_MANIFEST_FILE, strToU8(createJsonText(manifest)));
  files.set(PACKAGE_APP_STATE_FILE, strToU8(createJsonText(exportedAppState)));
  files.set(
    PACKAGE_WARDROBE_ITEMS_FILE,
    strToU8(wardrobeResult.records.map((record) => serializeNdjsonRecord(record)).join(""))
  );
  files.set(
    PACKAGE_FITPICS_FILE,
    strToU8(fitpicsResult.records.map((record) => serializeNdjsonRecord(record)).join(""))
  );
  files.set(
    PACKAGE_SAVED_OUTFITS_FILE,
    strToU8(savedOutfitRecords.map((record) => serializeNdjsonRecord(record)).join(""))
  );

  for (const previewFile of [...wardrobeResult.files, ...fitpicsResult.files]) {
    files.set(previewFile.path, await blobToUint8Array(previewFile.blob));
  }

  if (warningReport.warningCount > 0) {
    files.set(PACKAGE_WARNINGS_FILE, strToU8(createJsonText(warningReport)));
  }

  return {
    manifest,
    files,
    exportedAt,
    warningCount: warningReport.warningCount,
    warnings,
    warningReportFileName: warningReport.warningCount > 0 ? PACKAGE_WARNINGS_FILE : ""
  };
}

export async function buildBackupPackageZip({
  items = [],
  appState = {},
  resolveAssetUrl
} = {}) {
  const packageData = await buildBackupPackage({
    items,
    appState,
    resolveAssetUrl
  });
  const archive = Object.fromEntries(packageData.files.entries());
  const zipBytes = zipSync(archive, {
    level: 6
  });

  return {
    ...packageData,
    blob: new Blob([zipBytes], { type: "application/zip" }),
    fileName: `oa-backup-v2-${packageData.exportedAt.slice(0, 10)}.zip`
  };
}
