import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { BACKUP_SOURCE, BACKUP_VERSION } from "./appIdentity.js";
import { getActiveWardrobeItemImageAsset, getWardrobeItemImages } from "./itemModel.js";
import { getFitpicImages, getPrimaryFitpicImage } from "./fitpics.js";
import { createFitpicMediaRef, isFitpicMediaRefVariant } from "./fitpicMedia.js";
import { getMediaRecord } from "./storage.js";

export const PACKAGE_SOURCE = "outfit-app-package";
export const PACKAGE_VERSION = 1;
export const PACKAGE_FORMAT = "directory";
export const PACKAGE_ASSET_POLICY = "multi-asset";
export const LEGACY_PACKAGE_ASSET_POLICY = "preview-only";
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

function normalizeVariantKey(value) {
  return value === "original" || value === "display" || value === "preview" || value === "thumbnail"
    ? value
    : "preview";
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

  if (![PACKAGE_ASSET_POLICY, LEGACY_PACKAGE_ASSET_POLICY].includes(manifest.assetPolicy)) {
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

function parseNdjsonRecords(value = "") {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    return [];
  }

  return normalizedValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function dataUrlMimeTypeFromExtension(path = "", fallbackMimeType = "application/octet-stream") {
  const extension = getExtensionFromFilename(path).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".avif") return "image/avif";

  return fallbackMimeType;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function packageBytesToDataUrl(bytes, packagePath = "", fallbackMimeType = "") {
  if (!(bytes instanceof Uint8Array)) {
    return "";
  }

  const mimeType = fallbackMimeType || dataUrlMimeTypeFromExtension(packagePath);
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function cloneVariantLike(value, fallbackSrc = "") {
  const record = ensureImageVariantRecord(value, fallbackSrc);

  if ("packagePath" in record) {
    delete record.packagePath;
  }

  return record;
}

function getImageVariantSrc(value, fallback = "") {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeText(value.src);
  }

  return normalizeText(fallback);
}

function getImageVariantPackagePath(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? normalizeText(value.packagePath)
    : "";
}

function pickFirstImageVariantCandidate(...candidates) {
  for (const candidate of candidates) {
    if (getImageVariantSrc(candidate)) {
      return candidate;
    }

    if (
      candidate
      && typeof candidate === "object"
      && !Array.isArray(candidate)
      && normalizeText(candidate.mediaId)
    ) {
      return candidate;
    }
  }

  return "";
}

function getFirstNonEmptyText(...values) {
  for (const value of values) {
    const normalizedValue = normalizeText(value);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
}

function getLegacyWardrobeAssetFallbackSource(asset = {}) {
  return getFirstNonEmptyText(
    asset?.imageUrl,
    asset?.src,
    asset?.dataUrl,
    asset?.imageData
  );
}

function getLegacyFitpicFallbackSource(fitpicImage = {}) {
  return getFirstNonEmptyText(
    fitpicImage?.imageData,
    fitpicImage?.imageUrl,
    fitpicImage?.src,
    fitpicImage?.dataUrl
  );
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

function buildWardrobeVariantFileName(asset = {}, variantKey = "preview", sourceOverride = "") {
  const stableBase = sanitizeFileSegment(asset.assetUuid || asset.parentItemImageUuid || "wardrobe-preview", "wardrobe-preview");
  const resolvedVariantKey = normalizeVariantKey(variantKey);
  const variantRecord = asset?.images?.[resolvedVariantKey];
  const extension = inferPackageExtension({
    mimeType: variantRecord?.mimeType || asset?.mimeType || "",
    originalFilename: variantRecord?.originalFilename || asset?.originalFilename || "",
    source: getImageVariantSrc(variantRecord, sourceOverride || (resolvedVariantKey === "preview" ? asset?.imageUrl : ""))
  });

  return `${stableBase}${resolvedVariantKey === "preview" ? "" : `-${resolvedVariantKey}`}${extension}`;
}

function buildFitpicVariantFileName(fitpicImage = {}, variantKey = "preview", sourceOverride = "") {
  const stableBase = sanitizeFileSegment(fitpicImage.fitpicImageUuid || fitpicImage.parentFitpicUuid || "fitpic-preview", "fitpic-preview");
  const resolvedVariantKey = normalizeVariantKey(variantKey);
  const variantRecord = fitpicImage?.images?.[resolvedVariantKey];
  const extension = inferPackageExtension({
    mimeType:
      (typeof variantRecord === "object" && variantRecord?.mimeType)
      || fitpicImage?.sourceMimeType
      || fitpicImage?.mimeType
      || "",
    originalFilename: fitpicImage?.sourceOriginalFilename || "",
    source: getImageVariantSrc(variantRecord, sourceOverride || (resolvedVariantKey === "preview" ? fitpicImage.imageData : ""))
  });

  return `${stableBase}${resolvedVariantKey === "preview" ? "" : `-${resolvedVariantKey}`}${extension}`;
}

function createWardrobeExportAssetMetadata(asset = {}, packagePaths = {}) {
  const original = createMetadataOnlyVariant(asset?.images?.original);
  const display = createMetadataOnlyVariant(asset?.images?.display, asset?.images?.preview?.src || asset?.imageUrl);
  const preview = createMetadataOnlyVariant(asset?.images?.preview, display.src || asset?.imageUrl);
  const thumbnail = createMetadataOnlyVariant(asset?.images?.thumbnail);
  const strippedAsset = stripEmbeddedDataImageFields(cloneValue(asset));

  return {
    ...strippedAsset,
    src: "",
    dataUrl: "",
    imageData: "",
    imageUrl: "",
    images: {
      original: {
        ...original,
        ...(packagePaths.original ? { packagePath: packagePaths.original } : {})
      },
      display: {
        ...display,
        ...(packagePaths.display ? { packagePath: packagePaths.display } : {})
      },
      preview: {
        ...preview,
        ...(packagePaths.preview ? { packagePath: packagePaths.preview } : {})
      },
      thumbnail: {
        ...thumbnail,
        ...(packagePaths.thumbnail ? { packagePath: packagePaths.thumbnail } : {})
      }
    }
  };
}

function createWardrobeItemRecord(item, itemImages, activePackagePaths = {}) {
  const nextItem = stripEmbeddedDataImageFields(cloneValue(item));
  const original = createMetadataOnlyVariant(nextItem?.images?.original);
  const display = createMetadataOnlyVariant(nextItem?.images?.display, nextItem?.images?.preview?.src || nextItem?.imageUrl);
  const preview = createMetadataOnlyVariant(nextItem?.images?.preview, display.src || nextItem?.imageUrl);
  const thumbnail = createMetadataOnlyVariant(nextItem?.images?.thumbnail);

  nextItem.itemImages = itemImages;
  nextItem.src = "";
  nextItem.dataUrl = "";
  nextItem.imageData = "";
  nextItem.imageUrl = "";
  nextItem.images = {
    original: {
      ...original,
      ...(activePackagePaths.original ? { packagePath: activePackagePaths.original } : {})
    },
    display: {
      ...display,
      ...(activePackagePaths.display ? { packagePath: activePackagePaths.display } : {})
    },
    preview: {
      ...preview,
      ...(activePackagePaths.preview ? { packagePath: activePackagePaths.preview } : {})
    },
    thumbnail: {
      ...thumbnail,
      ...(activePackagePaths.thumbnail ? { packagePath: activePackagePaths.thumbnail } : {})
    }
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
      display: createMetadataOnlyVariant(nextItemImage?.images?.display, nextItemImage?.imageUrl || nextItemImage?.images?.preview?.src),
      preview: createMetadataOnlyVariant(nextItemImage?.images?.preview, nextItemImage?.imageUrl || nextItemImage?.imageData || nextItemImage?.src || nextItemImage?.dataUrl),
      thumbnail: createMetadataOnlyVariant(nextItemImage?.images?.thumbnail)
    },
    canonicalAsset,
    derivedAssets
  };
}

function createFitpicImageMetadataRecord(currentValue, packagePaths = {}) {
  const previewMetadata =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? createMetadataOnlyVariant(currentValue.preview)
      : createEmptyVariantRecord();
  const displayMetadata =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? createMetadataOnlyVariant(currentValue.display, currentValue.preview)
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
    original: {
      ...originalMetadata,
      ...(packagePaths.original ? { packagePath: packagePaths.original } : {})
    },
    display: {
      ...displayMetadata,
      ...(packagePaths.display ? { packagePath: packagePaths.display } : {})
    },
    preview: {
      ...previewMetadata,
      ...(packagePaths.preview ? { packagePath: packagePaths.preview } : {})
    },
    thumbnail: {
      ...thumbnailMetadata,
      ...(packagePaths.thumbnail ? { packagePath: packagePaths.thumbnail } : {})
    }
  };
}

function createFitpicExportImageRecord(fitpicImage, packagePaths = {}) {
  const nextFitpicImage = stripEmbeddedDataImageFields(cloneValue(fitpicImage));

  return {
    ...nextFitpicImage,
    src: "",
    dataUrl: "",
    imageData: "",
    images: createFitpicImageMetadataRecord(fitpicImage?.images, packagePaths)
  };
}

function createFitpicRecord(fitpic, fitpicImages, primaryPackagePaths = {}) {
  const nextFitpic = stripEmbeddedDataImageFields(cloneValue(fitpic));

  nextFitpic.fitpicImages = fitpicImages;
  nextFitpic.src = "";
  nextFitpic.dataUrl = "";
  nextFitpic.imageData = "";
  nextFitpic.images = createFitpicImageMetadataRecord(nextFitpic?.images, primaryPackagePaths);

  return nextFitpic;
}

async function extractVariantFiles({
  entity,
  entityType = "",
  entityId = "",
  stableId = "",
  variants = {},
  buildFileName,
  packageDir = "",
  options = {},
  warnings = []
} = {}) {
  const files = [];
  const packagePaths = {};
  const filePathBySource = new Map();

  for (const variantKey of ["preview", "original", "display", "thumbnail"]) {
    const rawVariant = variants[variantKey];
    const normalizedVariantKey = normalizeVariantKey(variantKey);
    const source = getImageVariantSrc(rawVariant);

    if (!source) {
      continue;
    }

    const existingPackagePath = filePathBySource.get(source) || "";

    if (existingPackagePath) {
      packagePaths[normalizedVariantKey] = existingPackagePath;
      continue;
    }

    const blob = await resolveImageBlob(source, options);

    if (!blob) {
      continue;
    }

    const fileName = buildFileName(entity, normalizedVariantKey, source);
    const packagePath = `${packageDir}/${fileName}`;

    filePathBySource.set(source, packagePath);
    packagePaths[normalizedVariantKey] = packagePath;
    files.push({
      path: packagePath,
      blob
    });
  }

  return {
    packagePaths,
    files
  };
}

async function extractWardrobeAsset(asset, options, warnings) {
  const legacyFallbackSource = getLegacyWardrobeAssetFallbackSource(asset);
  const originalSource = getImageVariantSrc(asset?.images?.original);
  const variants = {
    original: asset?.images?.original,
    display: pickFirstImageVariantCandidate(
      asset?.images?.display,
      asset?.images?.preview,
      legacyFallbackSource,
      originalSource
    ),
    preview: pickFirstImageVariantCandidate(
      asset?.images?.preview,
      asset?.images?.display,
      legacyFallbackSource,
      originalSource
    ),
    thumbnail: pickFirstImageVariantCandidate(
      asset?.images?.thumbnail,
      asset?.images?.display,
      asset?.images?.preview,
      legacyFallbackSource,
      originalSource
    )
  };
  const extractedVariants = await extractVariantFiles({
    entity: asset,
    entityType: "oaWardrobeAsset",
    entityId: asset?.assetUuid || asset?.parentItemImageUuid || "",
    stableId: asset?.assetUuid || "",
    variants,
    buildFileName: buildWardrobeVariantFileName,
    packageDir: PACKAGE_WARDROBE_PREVIEWS_DIR,
    options,
    warnings
  });

  if (!Object.keys(extractedVariants.packagePaths).length) {
    warnings.push(
      createExportWarning({
        entityType: "oaWardrobeAsset",
        id: asset?.assetUuid || asset?.parentItemImageUuid || "",
        stableId: asset?.assetUuid || "",
        field: "images.preview",
        message: "Omitted unresolved wardrobe media from export because no resolvable asset payload was available."
      })
    );
  }

  return {
    assetRecord: createWardrobeExportAssetMetadata(asset, extractedVariants.packagePaths),
    files: extractedVariants.files
  };
}

async function extractFitpicImage(fitpicImage, options, warnings) {
  const legacyFallbackSource = getLegacyFitpicFallbackSource(fitpicImage);
  const originalSource = getImageVariantSrc(fitpicImage?.images?.original);
  const variants = {
    original: fitpicImage?.images?.original,
    display: pickFirstImageVariantCandidate(
      fitpicImage?.images?.display,
      fitpicImage?.images?.preview,
      legacyFallbackSource,
      originalSource
    ),
    preview: pickFirstImageVariantCandidate(
      fitpicImage?.images?.preview,
      fitpicImage?.images?.display,
      legacyFallbackSource,
      originalSource
    ),
    thumbnail: pickFirstImageVariantCandidate(
      fitpicImage?.images?.thumbnail,
      fitpicImage?.images?.display,
      fitpicImage?.images?.preview,
      legacyFallbackSource,
      originalSource
    )
  };
  const files = [];
  const packagePaths = {};
  const filePathByKey = new Map();

  for (const variantKey of ["preview", "original", "display", "thumbnail"]) {
    const normalizedVariantKey = normalizeVariantKey(variantKey);
    const rawVariant = variants[normalizedVariantKey];
    const variantSource = getImageVariantSrc(rawVariant);
    const variantRef = rawVariant && typeof rawVariant === "object" && !Array.isArray(rawVariant)
      ? rawVariant
      : null;
    const mediaId = isFitpicMediaRefVariant(variantRef) ? normalizeText(variantRef.mediaId) : "";
    const dedupeKey = mediaId ? `media:${mediaId}` : variantSource ? `src:${variantSource}` : "";

    if (!dedupeKey) {
      continue;
    }

    const existingPackagePath = filePathByKey.get(dedupeKey) || "";

    if (existingPackagePath) {
      packagePaths[normalizedVariantKey] = existingPackagePath;
      continue;
    }

    let blob = null;

    if (mediaId) {
      blob = (await getMediaRecord(mediaId))?.blob ?? null;
    } else if (variantSource) {
      blob = await resolveImageBlob(variantSource, options);
    }

    if (!blob) {
      continue;
    }

    const fileName = buildFitpicVariantFileName(fitpicImage, normalizedVariantKey, variantSource);
    const packagePath = `${PACKAGE_FITPIC_PREVIEWS_DIR}/${fileName}`;

    filePathByKey.set(dedupeKey, packagePath);
    packagePaths[normalizedVariantKey] = packagePath;
    files.push({
      path: packagePath,
      blob
    });
  }

  if (!Object.keys(packagePaths).length) {
    warnings.push(
      createExportWarning({
        entityType: "oaFitpicImage",
        id: fitpicImage?.fitpicImageUuid || "",
        stableId: fitpicImage?.parentFitpicUuid || "",
        field: "images.preview",
        message: "Omitted unresolved fitpic media from export because no resolvable asset payload was available."
      })
    );
  }

  return {
    fitpicImageRecord: createFitpicExportImageRecord(fitpicImage, packagePaths),
    files
  };
}

async function buildWardrobeItemsExport(items, options, warnings) {
  const records = [];
  const files = [];

  for (const originalItem of Array.isArray(items) ? items : []) {
    const itemImages = getWardrobeItemImages(originalItem);
    const exportedItemImages = [];
    const packagePathsByAssetUuid = new Map();

    for (const itemImage of itemImages) {
      const exportedCanonical = await extractWardrobeAsset(itemImage.canonicalAsset, options, warnings);
      files.push(...exportedCanonical.files);
      packagePathsByAssetUuid.set(itemImage.canonicalAsset.assetUuid, exportedCanonical.assetRecord.images);

      const exportedDerivedAssets = [];
      for (const derivedAsset of Array.isArray(itemImage.derivedAssets) ? itemImage.derivedAssets : []) {
        const exportedDerived = await extractWardrobeAsset(derivedAsset, options, warnings);
        files.push(...exportedDerived.files);
        packagePathsByAssetUuid.set(derivedAsset.assetUuid, exportedDerived.assetRecord.images);
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
    const activePackagePaths = activeAsset?.assetUuid
      ? {
          original: getImageVariantPackagePath(packagePathsByAssetUuid.get(activeAsset.assetUuid)?.original),
          display: getImageVariantPackagePath(packagePathsByAssetUuid.get(activeAsset.assetUuid)?.display),
          preview: getImageVariantPackagePath(packagePathsByAssetUuid.get(activeAsset.assetUuid)?.preview),
          thumbnail: getImageVariantPackagePath(packagePathsByAssetUuid.get(activeAsset.assetUuid)?.thumbnail)
        }
      : {};
    const nextRecord = createWardrobeItemRecord(originalItem, exportedItemImages, activePackagePaths);

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
    const packagePathsByImageUuid = new Map();

    for (const fitpicImage of fitpicImages) {
      const exportedFitpicImage = await extractFitpicImage(fitpicImage, options, warnings);
      files.push(...exportedFitpicImage.files);
      packagePathsByImageUuid.set(fitpicImage.fitpicImageUuid, exportedFitpicImage.fitpicImageRecord.images);
      exportedFitpicImages.push(exportedFitpicImage.fitpicImageRecord);
    }

    const normalizedPrimaryImageUuid = normalizeText(originalFitpic?.primaryImageUuid);
    const primaryFitpicImage = exportedFitpicImages.find(
      (fitpicImage) => fitpicImage.fitpicImageUuid === normalizedPrimaryImageUuid
    ) ?? exportedFitpicImages[0] ?? null;
    const primaryPackagePaths = primaryFitpicImage?.fitpicImageUuid
      ? {
          original: getImageVariantPackagePath(packagePathsByImageUuid.get(primaryFitpicImage.fitpicImageUuid)?.original),
          display: getImageVariantPackagePath(packagePathsByImageUuid.get(primaryFitpicImage.fitpicImageUuid)?.display),
          preview: getImageVariantPackagePath(packagePathsByImageUuid.get(primaryFitpicImage.fitpicImageUuid)?.preview),
          thumbnail: getImageVariantPackagePath(packagePathsByImageUuid.get(primaryFitpicImage.fitpicImageUuid)?.thumbnail)
        }
      : {};
    const nextRecord = createFitpicRecord(originalFitpic, exportedFitpicImages, primaryPackagePaths);

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

function createFitpicMediaRecordFromPackage({
  fitpicImage = {},
  variant = "display",
  value = null,
  bytes = null,
  packagePath = ""
} = {}) {
  if (!(bytes instanceof Uint8Array)) {
    return null;
  }

  const variantRecord = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const mimeType = normalizeText(variantRecord.mimeType) || dataUrlMimeTypeFromExtension(packagePath);
  const ownerId = normalizeText(fitpicImage?.fitpicImageUuid);
  const normalizedVariant = normalizeVariantKey(variant);

  if (!ownerId) {
    return null;
  }

  return {
    mediaId:
      (isFitpicMediaRefVariant(variantRecord) ? normalizeText(variantRecord.mediaId) : "")
      || `fitpicImage:${ownerId}:${normalizedVariant}`,
    ownerType: "fitpicImage",
    ownerId,
    variant: normalizedVariant,
    blob: new Blob([bytes], { type: mimeType || "application/octet-stream" }),
    mimeType,
    fileSize: Number(variantRecord.fileSize) || bytes.byteLength || 0,
    width: Number(variantRecord.width) || 0,
    height: Number(variantRecord.height) || 0,
    createdAt: normalizeText(fitpicImage?.importedAt) || normalizeText(fitpicImage?.createdAt),
    updatedAt: normalizeText(fitpicImage?.updatedAt) || normalizeText(fitpicImage?.importedAt) || normalizeText(fitpicImage?.createdAt),
    sourceKind: "backupImport"
  };
}

function resolveRestoredVariant(value, zipEntries, warnings, {
  packageField = "",
  entityType = "",
  entityId = "",
  stableId = "",
  allowString = false
} = {}) {
  const src = getImageVariantSrc(value);
  const packagePath = getImageVariantPackagePath(value);
  const variantRecord = cloneVariantLike(value);

  if (!packagePath) {
    return allowString ? src : variantRecord;
  }

  const bytes = zipEntries[packagePath];

  if (!bytes) {
    warnings.push(
      createExportWarning({
        entityType,
        id: entityId,
        stableId,
        field: packageField,
        message: `Referenced backup media was missing at "${packagePath}" during import.`
      })
    );
    return allowString ? src : variantRecord;
  }

  const restoredSrc = packageBytesToDataUrl(bytes, packagePath, normalizeText(variantRecord.mimeType));
  const nextRecord = {
    ...variantRecord,
    src: restoredSrc
  };

  return allowString ? restoredSrc : nextRecord;
}

function restoreWardrobeImageVariants(images = {}, zipEntries = {}, warnings = [], {
  entityType = "",
  entityId = "",
  stableId = ""
} = {}) {
  const restoredOriginal = resolveRestoredVariant(images.original, zipEntries, warnings, {
    packageField: "images.original",
    entityType,
    entityId,
    stableId
  });
  const restoredDisplay = resolveRestoredVariant(images.display, zipEntries, warnings, {
    packageField: "images.display",
    entityType,
    entityId,
    stableId
  });
  const restoredPreview = resolveRestoredVariant(images.preview, zipEntries, warnings, {
    packageField: "images.preview",
    entityType,
    entityId,
    stableId
  });
  const restoredThumbnail = resolveRestoredVariant(images.thumbnail, zipEntries, warnings, {
    packageField: "images.thumbnail",
    entityType,
    entityId,
    stableId
  });
  const originalSrc = restoredOriginal.src || "";
  const displaySrc = restoredDisplay.src || restoredPreview.src || originalSrc || restoredThumbnail.src || "";
  const previewSrc = restoredPreview.src || displaySrc || originalSrc || "";
  const thumbnailSrc = restoredThumbnail.src || displaySrc || previewSrc || originalSrc || "";

  return {
    original: restoredOriginal,
    display: {
      ...restoredDisplay,
      src: displaySrc
    },
    preview: {
      ...restoredPreview,
      src: previewSrc
    },
    thumbnail: {
      ...restoredThumbnail,
      src: thumbnailSrc
    }
  };
}

function restoreWardrobeAssetMedia(asset = {}, zipEntries = {}, warnings = []) {
  const nextAsset = cloneValue(asset);
  const images = nextAsset?.images && typeof nextAsset.images === "object" && !Array.isArray(nextAsset.images)
    ? nextAsset.images
    : {};
  const restoredImages = restoreWardrobeImageVariants(images, zipEntries, warnings, {
    entityType: "oaWardrobeAsset",
    entityId: nextAsset?.assetUuid || nextAsset?.parentItemImageUuid || "",
    stableId: nextAsset?.assetUuid || ""
  });

  return {
    ...nextAsset,
    imageUrl: restoredImages.display.src || nextAsset.imageUrl || "",
    images: {
      ...images,
      ...restoredImages
    }
  };
}

function restoreFitpicImageMedia(fitpicImage = {}, zipEntries = {}, warnings = []) {
  const nextFitpicImage = cloneValue(fitpicImage);
  const images = nextFitpicImage?.images && typeof nextFitpicImage.images === "object" && !Array.isArray(nextFitpicImage.images)
    ? nextFitpicImage.images
    : {};
  const mediaRecords = [];
  const mediaRecordByPackagePath = new Map();
  const restoreVariantRef = (value, variant) => {
    const packagePath = getImageVariantPackagePath(value);
    const variantRecord = value && typeof value === "object" && !Array.isArray(value) ? value : {};

    if (!packagePath) {
      const fallbackSrc = getImageVariantSrc(value);
      return isFitpicMediaRefVariant(variantRecord) ? createFitpicMediaRef(variantRecord) : fallbackSrc;
    }

    const bytes = zipEntries[packagePath];

    if (!bytes) {
      warnings.push(
        createExportWarning({
          entityType: "oaFitpicImage",
          id: nextFitpicImage?.fitpicImageUuid || "",
          stableId: nextFitpicImage?.parentFitpicUuid || "",
          field: `images.${variant}`,
          message: `Referenced backup media was missing at "${packagePath}" during import.`
        })
      );
      const fallbackSrc = getImageVariantSrc(value);
      return isFitpicMediaRefVariant(variantRecord) ? createFitpicMediaRef(variantRecord) : fallbackSrc;
    }

    const existingMediaRecord = mediaRecordByPackagePath.get(packagePath);

    if (existingMediaRecord) {
      return createFitpicMediaRef(existingMediaRecord);
    }

    const mediaRecord = createFitpicMediaRecordFromPackage({
      fitpicImage: nextFitpicImage,
      variant,
      value,
      bytes,
      packagePath
    });

    if (!mediaRecord) {
      return "";
    }

    mediaRecordByPackagePath.set(packagePath, mediaRecord);
    mediaRecords.push(mediaRecord);
    return createFitpicMediaRef(mediaRecord);
  };
  const restoredOriginal = restoreVariantRef(images.original, "original");
  const restoredDisplay = restoreVariantRef(images.display, "display");
  const restoredPreview = restoreVariantRef(images.preview, "preview");
  const restoredThumbnail = restoreVariantRef(images.thumbnail, "thumbnail");

  return {
    fitpicImage: {
      ...nextFitpicImage,
      imageData: "",
      images: {
        ...images,
        original: restoredOriginal || "",
        display: restoredDisplay || restoredPreview || restoredOriginal || restoredThumbnail || "",
        preview: restoredPreview || restoredDisplay || restoredOriginal || "",
        thumbnail: restoredThumbnail || restoredDisplay || restoredPreview || restoredOriginal || ""
      }
    },
    mediaRecords
  };
}

function restoreWardrobeItemRecord(item = {}, zipEntries = {}, warnings = []) {
  const nextItem = cloneValue(item);
  const restoredTopLevelImages = restoreWardrobeImageVariants(nextItem?.images, zipEntries, warnings, {
    entityType: "oaWardrobeItem",
    entityId: nextItem?.itemUuid || nextItem?.id || "",
    stableId: nextItem?.itemUuid || ""
  });
  const restoredItemImages = (Array.isArray(nextItem.itemImages) ? nextItem.itemImages : []).map((itemImage) => ({
    ...itemImage,
    canonicalAsset: restoreWardrobeAssetMedia(itemImage.canonicalAsset, zipEntries, warnings),
    derivedAssets: (Array.isArray(itemImage.derivedAssets) ? itemImage.derivedAssets : []).map((asset) =>
      restoreWardrobeAssetMedia(asset, zipEntries, warnings)
    )
  }));
  const activeItemImage = restoredItemImages.find((itemImage) => itemImage.itemImageUuid === nextItem.activeItemImageUuid)
    ?? restoredItemImages[0]
    ?? null;
  const activeAsset = activeItemImage
    ? [activeItemImage.canonicalAsset, ...(Array.isArray(activeItemImage.derivedAssets) ? activeItemImage.derivedAssets : [])]
      .find((asset) => asset.assetUuid === activeItemImage.activeImageAssetUuid)
      ?? activeItemImage.canonicalAsset
    : null;

  return {
    ...nextItem,
    itemImages: restoredItemImages,
    images: activeAsset?.images ?? restoredTopLevelImages,
    imageUrl: activeAsset?.imageUrl ?? restoredTopLevelImages.display.src ?? nextItem.imageUrl ?? ""
  };
}

function restoreFitpicRecord(fitpic = {}, zipEntries = {}, warnings = []) {
  const nextFitpic = cloneValue(fitpic);
  const restoredFitpicImageResults = (Array.isArray(nextFitpic.fitpicImages) ? nextFitpic.fitpicImages : []).map((fitpicImage) =>
    restoreFitpicImageMedia(fitpicImage, zipEntries, warnings)
  );
  const restoredFitpicImages = restoredFitpicImageResults.map((result) => result.fitpicImage);
  const primaryFitpicImage = restoredFitpicImages.find((fitpicImage) => fitpicImage.fitpicImageUuid === nextFitpic.primaryImageUuid)
    ?? restoredFitpicImages[0]
    ?? null;

  return {
    fitpic: {
      ...nextFitpic,
      fitpicImages: restoredFitpicImages,
      imageData: "",
      images: primaryFitpicImage?.images ?? nextFitpic.images
    },
    mediaRecords: restoredFitpicImageResults.flatMap((result) => result.mediaRecords)
  };
}

export async function importBackupPackage({
  file
} = {}) {
  if (!(file instanceof Blob)) {
    throw new Error("Backup package file is missing.");
  }

  const zipEntries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = zipEntries[PACKAGE_MANIFEST_FILE];

  if (!manifestBytes) {
    throw new Error("Backup package manifest is missing.");
  }

  const manifest = validateBackupPackageManifest(JSON.parse(strFromU8(manifestBytes)));
  const appStateBytes = zipEntries[manifest.files.appState];
  const wardrobeItemsBytes = zipEntries[manifest.files.wardrobeItems];
  const fitpicsBytes = zipEntries[manifest.files.fitpics];
  const savedOutfitsBytes = zipEntries[manifest.files.savedOutfits];

  if (!appStateBytes || !wardrobeItemsBytes || !fitpicsBytes || !savedOutfitsBytes) {
    throw new Error("Backup package contents are incomplete.");
  }

  const warnings = [];
  const rawItems = parseNdjsonRecords(strFromU8(wardrobeItemsBytes));
  const rawFitpics = parseNdjsonRecords(strFromU8(fitpicsBytes));
  const rawSavedOutfits = parseNdjsonRecords(strFromU8(savedOutfitsBytes));
  const appState = JSON.parse(strFromU8(appStateBytes));
  const items = rawItems.map((item) => restoreWardrobeItemRecord(item, zipEntries, warnings));
  const restoredFitpicResults = rawFitpics.map((fitpic) => restoreFitpicRecord(fitpic, zipEntries, warnings));
  const fitpics = restoredFitpicResults.map((result) => result.fitpic);
  const mediaRecords = restoredFitpicResults.flatMap((result) => result.mediaRecords);

  return {
    backup: {
      source: BACKUP_SOURCE,
      version: BACKUP_VERSION,
      importedAt: new Date().toISOString(),
      items,
      mediaRecords,
      appState: {
        ...appState,
        fitpicMediaMigrationVersion: 1,
        fitpics,
        savedOutfits: rawSavedOutfits
      }
    },
    manifest,
    warnings
  };
}
