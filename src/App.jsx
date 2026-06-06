import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationDialog from "./components/ConfirmationDialog";
import PreviewOverlay from "./components/PreviewOverlay";
import WardrobeExportDialog from "./components/WardrobeExportDialog";
import WardrobeSelectionBar from "./components/WardrobeSelectionBar";
import {
  backfillLocalSyncMetadata,
  exportBackup,
  getOrCreateDeviceId,
  getDefaultData,
  replaceWithBackup,
  resetToDefaults
} from "./repositories/backupRepository";
import { APP_ID, SUPPORTED_BACKUP_SOURCES, SUPPORTED_BACKUP_VERSIONS } from "./lib/appIdentity";
import { load, save as saveAppState } from "./repositories/appStateRepository";
import { exportLibraryCsv, loadAll as loadItems, remove as deleteItem, save as saveItem } from "./repositories/itemsRepository";
import {
  defaultItemList,
  applyMappedStyleWeightDefaults,
  defaultTypeSuggestions,
  emptyForm,
  getItemStatusOptions,
  getTypeMatchKeys,
  hasTypeDefaults,
  itemLists,
  layerTypes,
  normalizeStatus,
  normalizeItemType,
  normalizeTagList,
  normalizeType,
  normalizeWeight,
  resolveTypeDefaults,
  styleTagOptions,
  typeDerivedFields,
  weightOptions
} from "./lib/typeDefaults";
import {
  accessorySlots,
  applyOutfitAffinityDelta,
  applyContextValidityRulesToPool,
  buildNextOutfit,
  buildNextOutfitWithDebug,
  climateTagOptions,
  defaultGenerationLists,
  defaultGenerationMode,
  editableClimateTagOptions,
  emptyOutfitFilters,
  filterPoolForCompatibilityRules,
  filterPoolForLayeringRules,
  generationModes,
  getCurrentOutfitClimateChip,
  getCurrentOutfitStyleChip,
  getEligibleSlotPool,
  getOtherTopSlot,
  getOutfitDominantStyle,
  getOutfitKey,
  getPool,
  getGuidedBreakdownDisplayEntries,
  isEligibleForGeneration,
  isNonStackableTopType,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits,
  outfitFilterOptions,
  pickNextItemForGeneration,
  pickRandom,
  rememberRecentOutfit,
  summarizeGuidedExplanation,
  summarizeGuidedDebugPayload,
  visibleSlots
} from "./lib/generation";
import {
  buildDisplayName,
  createItemUuid,
  createFallbackItemTimestamp,
  createUniqueItemId,
  formatCurrency,
  garmentTypes,
  getNumericValue,
  getWorthCategory,
  itemNeedsClimateTagMigration,
  itemNeedsColorMigration,
  itemNeedsDescriptionMigration,
  itemNeedsDefaultMetadataMigration,
  itemNeedsFavoriteMigration,
  itemNeedsGarmentTypeMigration,
  itemNeedsImageContractMigration,
  itemNeedsImportMetadataMigration,
  itemNeedsItemUuidMigration,
  itemNeedsQuantityMigration,
  itemNeedsRetailMigration,
  itemNeedsStyleWeightMappingMigration,
  itemNeedsTagMigration,
  itemNeedsTimestampMigration,
  itemNeedsWeightMigration,
  normalizeCollections,
  normalizeItem,
  normalizeItemColor,
  normalizeItemUuid,
  normalizeTimestamp
} from "./lib/itemModel";
import { readImageFileMetadata } from "./lib/importMetadata";
import {
  backfillOutfitItemUuids,
  createOutfitUuid,
  normalizeHydratedAppState,
  normalizeGenerationLists,
  normalizeSavedOutfit,
  normalizeSavedOutfits
} from "./lib/appStateModel";
import {
  createImportedFitpicFromFile,
  normalizeFitpic,
  replaceFitpicImageFromFile
} from "./lib/fitpics";
import { prepareBackupImport } from "./lib/backupImport";
import {
  DEFAULT_WARDROBE_SORT,
  emptyWardrobeFilters,
  filterWardrobeItems,
  getExcludedFilterKey,
  getWardrobeFilterOptions,
  getWardrobeSearchText,
  matchesWardrobeFilters,
  normalizeWardrobeFilters,
  normalizeWardrobeSort,
  sortWardrobeItems,
  wardrobeExcludedMultiValueFilterKeys,
  wardrobeMultiValueFilterKeys
} from "./lib/wardrobeLibrary";
import {
  WARDROBE_SPREAD_LABEL_FONT_SIZE,
  WARDROBE_SPREAD_LABEL_GAP,
  WARDROBE_SPREAD_LABEL_LINE_HEIGHT,
  WARDROBE_SPREAD_LABEL_SIDE_PADDING,
  WARDROBE_SPREAD_LABEL_TOP_GAP,
  createWardrobeSpreadExportOptions,
  getWardrobeSpreadExportImageUrl,
  getWardrobeSpreadExportLabelRowCount,
  getWardrobeSpreadExportLabelRows,
  getWardrobeSpreadExportOrderedItems,
  normalizeWardrobeSpreadExportOptions,
  getWardrobeSpreadExportRenderConfig
} from "./lib/wardrobeSpreadExport";
import {
  addCollectionToItem,
  addTagToItemTags,
  clearItemCollections,
  hasMeaningfulItemChange,
  removeCollectionFromItem,
  removeSelectedItems,
  removeTagFromItemTags,
  setItemStatus,
  updateSelectedItems
} from "./lib/bulkEdit";
import { getNextSelectionState, pruneSelectedIds } from "./lib/selectionModel";
import {
  getImageFilename,
  getItemImageStyle,
  getManagedImageDrawBox,
  getManagedImageFrameStyle,
  getManagedImageSourceRect,
  getNormalizedImageCrop,
  getVisibleAlphaBounds,
  itemNeedsImageBake,
  normalizeImageCropSize,
  normalizeImageCropStart,
  normalizeImageFrameScale,
  normalizeImageOffset,
  normalizeImageScale,
  stripViteHash
} from "./lib/imagePresentation";
import {
  getWardrobePreviewDirectionForKey,
  getWardrobePreviewNavigation
} from "./lib/wardrobePreviewNavigation";

const imageAssets = import.meta.glob("../images/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default"
});

const imageAssetEntries = Object.entries(imageAssets)
  .map(([path, imageUrl]) => {
    const filename = path.split("/").pop();

    return filename && !filename.startsWith(".")
      ? {
          filename,
          imageUrl
        }
      : null;
  })
  .filter(Boolean);
const imageUrlByFilename = Object.fromEntries(
  imageAssetEntries.map((image) => [image.filename, image.imageUrl])
);
const imageMetricsCache = new Map();

function resolveImageUrl(imageUrl) {
  if (!imageUrl || imageUrl.startsWith("data:") || /^https?:\/\//.test(imageUrl)) {
    return imageUrl;
  }

  if (!imageUrl.startsWith("/images/") && !imageUrl.startsWith("/assets/")) {
    return imageUrl;
  }

  const filename = getImageFilename(imageUrl);
  return imageUrlByFilename[filename] ?? imageUrlByFilename[stripViteHash(filename)] ?? imageUrl;
}

function getIsMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 960px)").matches;
}

function getCanUseDebugPopout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(min-width: 1180px)").matches;
}

const ITEM_DEFAULTS_MIGRATION_VERSION = 3;
const IMAGE_PRESENTATION_MIGRATION_VERSION = 2;
const WARDROBE_PREVIEW_DOUBLE_CLICK_MS = 220;
const defaultWindowState = {
  outfitEditor: { width: 396 },
  wardrobeEditor: { width: 396 },
  addImagesWindow: { width: 396 }
};
const defaultWardrobeFilterSectionsOpen = {
  brand: false,
  garmentType: false,
  type: false,
  color: false,
  style: false,
  climate: false,
  weight: false,
  status: false,
  collections: false,
  favorite: false,
  laundry: false
};
const outfitLayout = ["Headwear", "TopGroup", "Bottom", "Footwear"];
const advancedTrackedFields = [
  "name",
  "description",
  "brand",
  "size",
  "weight",
  "status",
  "quantity",
  "value",
  "retailValue",
  "styleTags",
  "climateTags",
  "favorite",
  "garmentType",
  "layerType",
  "accessorySlot"
];
const stylingEditorFields = ["styleTags", "climateTags"];
const advancedEditorFields = advancedTrackedFields.filter(
  (field) => !["name", "description", "brand", "status", "favorite", "garmentType", ...stylingEditorFields].includes(field)
);

function normalizeStoredItem(item, fallbackCreatedAt) {
  return normalizeItem(item, {
    fallbackCreatedAt,
    emptyForm,
    resolveImageUrl,
    normalizeImageFrameScale,
    normalizeImageScale,
    normalizeImageOffset,
    getNormalizedImageCrop
  });
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function getEditorWindowStateKey(editingId, editorReturnTarget) {
  if (editorReturnTarget === "outfit") {
    return "outfitEditor";
  }

  if (editingId === "new") {
    return "addImagesWindow";
  }

  return "wardrobeEditor";
}

function createEmptyBulkMetadataDraft() {
  return {
    statusMode: "keep",
    statusValue: defaultItemList,
    typeMode: "keep",
    typeValue: "",
    colorMode: "keep",
    colorValue: "",
    brandMode: "keep",
    brandValue: "",
    nameMode: "keep",
    nameValue: "",
    descriptionMode: "keep",
    descriptionValue: "",
    sizeMode: "keep",
    sizeValue: "",
    weightMode: "keep",
    weightValue: "",
    quantityMode: "keep",
    quantityValue: "",
    valueMode: "keep",
    valueValue: "",
    retailValueMode: "keep",
    retailValueValue: "",
    collectionsMode: "keep",
    collectionsValue: "",
    styleTagsToAdd: [],
    styleTagsToRemove: [],
    climateTagsToAdd: [],
    climateTagsToRemove: []
  };
}

function addCollectionToList(currentCollections, nextCollection) {
  return normalizeCollections([...(Array.isArray(currentCollections) ? currentCollections : []), nextCollection]);
}

function removeCollectionFromList(currentCollections, collectionToRemove) {
  return normalizeCollections(currentCollections).filter((collection) => collection !== collectionToRemove);
}

function getIncludedFilterValues(filters, key) {
  return Array.isArray(filters?.[key]) ? filters[key] : [];
}

function getExcludedFilterValues(filters, key) {
  return Array.isArray(filters?.[getExcludedFilterKey(key)]) ? filters[getExcludedFilterKey(key)] : [];
}

function getSelectedFilterValueCount(filters, key) {
  return getIncludedFilterValues(filters, key).length + getExcludedFilterValues(filters, key).length;
}

function toggleMultiFilterValueState(currentFilters, key, value, shouldExclude = false) {
  const excludedKey = getExcludedFilterKey(key);
  const includedValues = getIncludedFilterValues(currentFilters, key);
  const excludedValues = getExcludedFilterValues(currentFilters, key);

  if (shouldExclude) {
    const isExcluded = excludedValues.includes(value);

    return {
      ...currentFilters,
      [key]: includedValues.filter((selectedValue) => selectedValue !== value),
      [excludedKey]: isExcluded
        ? excludedValues.filter((selectedValue) => selectedValue !== value)
        : [...excludedValues, value]
    };
  }

  const isIncluded = includedValues.includes(value);

  return {
    ...currentFilters,
    [key]: isIncluded
      ? includedValues.filter((selectedValue) => selectedValue !== value)
      : [...includedValues, value],
    [excludedKey]: excludedValues.filter((selectedValue) => selectedValue !== value)
  };
}

function toggleBulkTagAssignment(currentDraft, addKey, removeKey, tag) {
  const addSet = new Set(currentDraft[addKey] ?? []);
  const removeSet = new Set(currentDraft[removeKey] ?? []);

  if (addSet.has(tag)) {
    addSet.delete(tag);
  } else {
    addSet.add(tag);
    removeSet.delete(tag);
  }

  return {
    ...currentDraft,
    [addKey]: Array.from(addSet),
    [removeKey]: Array.from(removeSet)
  };
}

function toggleBulkTagRemoval(currentDraft, addKey, removeKey, tag) {
  const addSet = new Set(currentDraft[addKey] ?? []);
  const removeSet = new Set(currentDraft[removeKey] ?? []);

  if (removeSet.has(tag)) {
    removeSet.delete(tag);
  } else {
    removeSet.add(tag);
    addSet.delete(tag);
  }

  return {
    ...currentDraft,
    [addKey]: Array.from(addSet),
    [removeKey]: Array.from(removeSet)
  };
}


function areEditorValuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftList = (Array.isArray(left) ? left : []).slice().sort();
    const rightList = (Array.isArray(right) ? right : []).slice().sort();

    return leftList.length === rightList.length && leftList.every((value, index) => value === rightList[index]);
  }

  return left === right;
}

async function getAutoImageCrop(item) {
  const imageUrl = item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";
  if (!imageUrl) {
    return getNormalizedImageCrop(item);
  }

  try {
    const image = await loadImage(resolveImageUrl(imageUrl));
    const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight, { useCrop: true });
    const width = Math.max(1, Math.round(sourceRect.width));
    const height = Math.max(1, Math.round(sourceRect.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return getNormalizedImageCrop(item);
    }

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(
      image,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      width,
      height
    );

    const bounds = getVisibleAlphaBounds(context.getImageData(0, 0, width, height).data, width, height);
    if (!bounds) {
      return getNormalizedImageCrop(item);
    }

    const currentCrop = getNormalizedImageCrop(item);
    const nextX = currentCrop.x + (bounds.left / width) * currentCrop.width;
    const nextY = currentCrop.y + (bounds.top / height) * currentCrop.height;
    const nextWidth = ((bounds.right - bounds.left) / width) * currentCrop.width;
    const nextHeight = ((bounds.bottom - bounds.top) / height) * currentCrop.height;

    return {
      x: normalizeImageCropStart(nextX, normalizeImageCropSize(nextWidth)),
      y: normalizeImageCropStart(nextY, normalizeImageCropSize(nextHeight)),
      width: normalizeImageCropSize(nextWidth),
      height: normalizeImageCropSize(nextHeight)
    };
  } catch {
    return getNormalizedImageCrop(item);
  }
}

function restoreLegacyBakedImageScale(item) {
  const frameScale = normalizeImageFrameScale(item?.imageFrameScale);
  const scale = normalizeImageScale(item?.imageScale);

  if (frameScale === 100 || scale !== 100) {
    return item;
  }

  return {
    ...item,
    imageScale: frameScale
  };
}

async function bakeItemImagePresentation(item) {
  const normalizedCrop = getNormalizedImageCrop(item);

  if (!itemNeedsImageBake(item)) {
    const autoCrop = await getAutoImageCrop(item);
    return {
      ...item,
      imageFrameScale: normalizeImageFrameScale(item?.imageFrameScale),
      imageScale: normalizeImageScale(item?.imageScale),
      imageOffsetX: normalizeImageOffset(item?.imageOffsetX),
      imageOffsetY: normalizeImageOffset(item?.imageOffsetY),
      imageCropX: autoCrop.x,
      imageCropY: autoCrop.y,
      imageCropWidth: autoCrop.width,
      imageCropHeight: autoCrop.height
    };
  }

  const autoCrop = await getAutoImageCrop({
    ...item,
    imageCropX: normalizedCrop.x,
    imageCropY: normalizedCrop.y,
    imageCropWidth: normalizedCrop.width,
    imageCropHeight: normalizedCrop.height
  });

  return {
    ...item,
    imageFrameScale: normalizeImageFrameScale(item?.imageScale),
    imageScale: normalizeImageScale(item?.imageScale),
    imageOffsetX: normalizeImageOffset(item?.imageOffsetX),
    imageOffsetY: normalizeImageOffset(item?.imageOffsetY),
    imageCropX: autoCrop.x,
    imageCropY: autoCrop.y,
    imageCropWidth: autoCrop.width,
    imageCropHeight: autoCrop.height
  };
}

function drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight, options = {}) {
  const { sourceRect, drawX, drawY, drawWidth, drawHeight } = getManagedImageDrawBox(
    item,
    image,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    options
  );

  context.save();
  context.beginPath();
  context.rect(frameX, frameY, frameWidth, frameHeight);
  context.clip();
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function useImageMetrics(imageUrl) {
  const resolvedImageUrl = resolveImageUrl(imageUrl?.trim?.() ?? imageUrl ?? "");
  const [metrics, setMetrics] = useState(() => imageMetricsCache.get(resolvedImageUrl) ?? null);

  useEffect(() => {
    if (!resolvedImageUrl) {
      setMetrics(null);
      return undefined;
    }

    const cached = imageMetricsCache.get(resolvedImageUrl);
    if (cached) {
      setMetrics(cached);
      return undefined;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      const nextMetrics = {
        naturalWidth: Math.max(image.naturalWidth || 1, 1),
        naturalHeight: Math.max(image.naturalHeight || 1, 1)
      };

      imageMetricsCache.set(resolvedImageUrl, nextMetrics);

      if (!cancelled) {
        setMetrics(nextMetrics);
      }
    };

    image.onerror = () => {
      const fallbackMetrics = { naturalWidth: 1, naturalHeight: 1 };
      imageMetricsCache.set(resolvedImageUrl, fallbackMetrics);

      if (!cancelled) {
        setMetrics(fallbackMetrics);
      }
    };

    image.src = resolvedImageUrl;

    return () => {
      cancelled = true;
    };
  }, [resolvedImageUrl]);

  return metrics ?? { naturalWidth: 1, naturalHeight: 1 };
}

function ManagedItemImage({ item, alt = "", className = "", frameRef = null, imageRef = null, dataItemId = "", useFrameScale = false, normalizeToFrameScale = false, useCrop = false, usePresentation = false }) {
  const resolvedImageUrl = resolveImageUrl(item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "");
  const metrics = useImageMetrics(resolvedImageUrl);

  if (!resolvedImageUrl) {
    return null;
  }

  if (!usePresentation) {
    return (
      <img
        ref={imageRef}
        src={resolvedImageUrl}
        alt={alt}
        className={`managed-image managed-image-plain ${className}`.trim()}
        data-item-id={dataItemId || item?.id || ""}
      />
    );
  }

  return (
      <span
        ref={frameRef}
        className={`managed-image ${className}`.trim()}
      style={getManagedImageFrameStyle(item, metrics, { useFrameScale, normalizeToFrameScale, useCrop, usePresentation })}
      data-item-id={dataItemId || item?.id || ""}
    >
      <img
        ref={imageRef}
        src={resolvedImageUrl}
        alt={alt}
        className="managed-image-content"
      />
    </span>
  );
}

function getAdvancedOverrideFields(item, defaults) {
  return advancedTrackedFields.filter((field) => !areEditorValuesEqual(item[field], defaults[field]));
}

function applyGarmentRules(nextDraft, defaults) {
  const resolvedDraft = { ...nextDraft };

  if (resolvedDraft.garmentType !== "Top" && resolvedDraft.garmentType !== "Outerwear") {
    resolvedDraft.layerType = "Both";
  } else if (!layerTypes.includes(resolvedDraft.layerType)) {
    resolvedDraft.layerType = defaults.layerType;
  }

  if (resolvedDraft.garmentType !== "Accessory") {
    resolvedDraft.accessorySlot = "";
  } else if (!resolvedDraft.accessorySlot) {
    resolvedDraft.accessorySlot = defaults.accessorySlot;
  }

  if (resolvedDraft.garmentType === "Accessory" && !resolvedDraft.size.trim()) {
    resolvedDraft.size = defaults.size || "OS";
  }

  return resolvedDraft;
}

function applyTypeDefaultsToDraft(current, nextType) {
  const currentDefaults = resolveTypeDefaults(current.type);
  const nextDefaults = resolveTypeDefaults(nextType);
  const nextDraft = {
    ...current,
    type: nextDefaults.type
  };

  typeDerivedFields.forEach((field) => {
    nextDraft[field] = areEditorValuesEqual(current[field], currentDefaults[field]) ? nextDefaults[field] : current[field];
  });

  return applyGarmentRules(nextDraft, nextDefaults);
}

const namedColorHex = {
  black: "#171717",
  gray: "#777777",
  grey: "#777777",
  charcoal: "#333333",
  sumi: "#363432",
  white: "#f1f0eb",
  beige: "#cbb995",
  cream: "#e8dcc5",
  brown: "#6d4a2f",
  indigo: "#263f6a",
  blue: "#3f6da8",
  navy: "#1e2e4d",
  red: "#a43d35",
  green: "#4d6f45",
  olive: "#6b7147",
  yellow: "#d7b44a",
  orange: "#c66d35",
  purple: "#6b4f8f",
  pink: "#c98098"
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return null;
  }

  const value = Number.parseInt(clean, 16);
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getColorRgb(item) {
  const color = normalizeType(item.color);
  if (!color) {
    return null;
  }

  const namedMatch = Object.entries(namedColorHex).find(([name]) => color.includes(name));
  return namedMatch ? hexToRgb(namedMatch[1]) : null;
}

function getAccessoryLabel(slot) {
  const labels = {
    Glasses: "Glasses",
    Neck: "Neck",
    LeftHand: "Left hand",
    RightHand: "Right hand",
    Bag: "Bag",
    Belt: "Belt"
  };

  return labels[slot] ?? slot;
}

function getSlotLabel(slot) {
  const labels = {
    Headwear: "Headwear",
    TopInner: "Top",
    TopOuter: "Outer layer",
    Bottom: "Bottom",
    Footwear: "Footwear"
  };

  return labels[slot] ?? slot;
}

function hasAccessoryItems(outfit) {
  return accessorySlots.some((slot) => Boolean(outfit?.[slot]));
}

function itemNeedsImageScaleMigration(originalItem, normalizedItem) {
  return originalItem.imageScale === undefined || normalizeImageScale(originalItem.imageScale) !== normalizedItem.imageScale;
}

function itemNeedsImageFrameScaleMigration(originalItem, normalizedItem) {
  return (
    originalItem.imageFrameScale === undefined ||
    normalizeImageFrameScale(originalItem.imageFrameScale) !== normalizedItem.imageFrameScale
  );
}

function itemNeedsImageOffsetMigration(originalItem, normalizedItem) {
  return (
    originalItem.imageOffsetX === undefined ||
    originalItem.imageOffsetY === undefined ||
    normalizeImageOffset(originalItem.imageOffsetX) !== normalizedItem.imageOffsetX ||
    normalizeImageOffset(originalItem.imageOffsetY) !== normalizedItem.imageOffsetY
  );
}

function itemNeedsImageCropMigration(originalItem, normalizedItem) {
  const originalCrop = getNormalizedImageCrop(originalItem);

  return (
    originalItem.imageCropX === undefined ||
    originalItem.imageCropY === undefined ||
    originalItem.imageCropWidth === undefined ||
    originalItem.imageCropHeight === undefined ||
    originalCrop.x !== normalizedItem.imageCropX ||
    originalCrop.y !== normalizedItem.imageCropY ||
    originalCrop.width !== normalizedItem.imageCropWidth ||
    originalCrop.height !== normalizedItem.imageCropHeight
  );
}

function createSavedOutfitName(savedOutfits) {
  return `Outfit ${savedOutfits.length + 1}`;
}

function syncOutfitItemUuids(outfit, outfitItemUuids, itemsById) {
  return backfillOutfitItemUuids(outfit, outfitItemUuids, itemsById);
}

function getSavedOutfitPreviewSlots(savedOutfit) {
  return savedOutfit.layering
    ? ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"]
    : ["Headwear", "TopInner", "Bottom", "Footwear"];
}

function sanitizeOutfitForExistingItems(outfit, itemsById) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId && itemsById[itemId] ? itemId : null
    ])
  );
}

function savedOutfitHasMissingItems(savedOutfit, itemsById) {
  return Object.values(savedOutfit.outfit ?? {}).some((itemId) => itemId && !itemsById[itemId]);
}

function replaceItemIdInOutfit(outfit, oldItemId, newItemId) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === oldItemId ? newItemId : itemId
    ])
  );
}

function clearItemIdFromOutfit(outfit, itemIdToClear) {
  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => [
      slot,
      itemId === itemIdToClear ? null : itemId
    ])
  );
}

function syncSavedOutfitItemUuids(savedOutfit, itemsById) {
  return {
    ...savedOutfit,
    outfitItemUuids: syncOutfitItemUuids(savedOutfit.outfit, savedOutfit.outfitItemUuids, itemsById)
  };
}

function createFitpicId() {
  return `fitpic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

function formatFitpicDate(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toLocaleDateString();
}

function formatFitpicFileSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB"];
  let normalizedSize = size / 1024;
  let unitIndex = 0;

  while (normalizedSize >= 1024 && unitIndex < units.length - 1) {
    normalizedSize /= 1024;
    unitIndex += 1;
  }

  return `${normalizedSize.toFixed(normalizedSize >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatFitpicDimensions(fitpic) {
  if (!fitpic.sourceImageWidth || !fitpic.sourceImageHeight) {
    return "";
  }

  return `${fitpic.sourceImageWidth} × ${fitpic.sourceImageHeight}`;
}

function formatFitpicImportMeta(fitpic) {
  const importedDate = formatFitpicDate(fitpic.importedAt || fitpic.createdAt);
  const dimensions = formatFitpicDimensions(fitpic);
  const details = [importedDate, dimensions].filter(Boolean);
  return details.join(" • ");
}

function parseFitpicTagsInput(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getFallbackPaletteColor(item) {
  const rgb = getColorRgb(item);
  return rgb ? rgbToHex(rgb) : "#8c8c8c";
}

function extractDominantColorsFromImage(image, maxColors = 3) {
  const sampleSize = 96;
  const scale = Math.min(1, sampleSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 96) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const brightness = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness > 238 && spread < 18) {
      continue;
    }

    const key = [r, g, b].map((value) => Math.round(value / 32) * 32).join(",");
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) =>
      rgbToHex({
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      })
    );
}

async function extractItemPalette(item) {
  try {
    const image = await loadImage(resolveImageUrl(item.imageUrl));
    const colors = extractDominantColorsFromImage(image);
    return colors.length ? colors : [getFallbackPaletteColor(item)];
  } catch {
    return [getFallbackPaletteColor(item)];
  }
}

function mergePaletteColors(itemPalettes, maxColors = 7) {
  const colors = itemPalettes.flatMap(({ item, colors }) =>
    colors.map((color) => ({ color, label: buildDisplayName(item) }))
  );
  const merged = [];

  colors.forEach((entry) => {
    if (!merged.some((existing) => existing.color.toLowerCase() === entry.color.toLowerCase())) {
      merged.push(entry);
    }
  });

  return merged.slice(0, maxColors);
}

function canvasToDataUrl(canvas, type, quality) {
  const dataUrl = canvas.toDataURL(type, quality);
  return dataUrl.startsWith(`data:${type}`) ? dataUrl : "";
}

function isLocalDataImage(imageUrl) {
  return imageUrl.trim().startsWith("data:image/");
}

async function compressImageSource(source, maxDimension = 1400, quality = 0.86) {
  if (!source.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const dataUrl = await readFileAsDataUrl(source);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be processed.");
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToDataUrl(canvas, "image/webp", quality) || canvas.toDataURL("image/png");
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function getRemoveBackgroundExport(module) {
  const removeBackground = module.removeBackground ?? module.default;

  if (typeof removeBackground !== "function") {
    throw new Error("Background removal module did not load correctly.");
  }

  return removeBackground;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function validateBackup(backup) {
  return (
    backup &&
    SUPPORTED_BACKUP_SOURCES.includes(backup.source) &&
    SUPPORTED_BACKUP_VERSIONS.includes(backup.version) &&
    Array.isArray(backup.items) &&
    backup.appState &&
    typeof backup.appState === "object" &&
    !Array.isArray(backup.appState)
  );
}

const emptyWeatherSettings = {
  locationName: "",
  latitude: null,
  longitude: null
};

function normalizeWeatherSettings(settings) {
  const latitude = Number(settings?.latitude);
  const longitude = Number(settings?.longitude);

  return {
    locationName: settings?.locationName ?? "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

function isEditableKeyboardTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function getWeatherConditionLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Weather";
}

function getWeatherClimateFilters(temperature, code) {
  const filters = [];

  if (Number.isFinite(temperature)) {
    if (temperature >= 21) {
      filters.push("Hot");
    } else if (temperature >= 16) {
      filters.push("Warm");
    } else if (temperature >= 8) {
      filters.push("Transitional");
    } else {
      filters.push("Cold");
    }
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    filters.push("Rain");
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    filters.push("Snow");
  }

  return [...new Set(filters)];
}

function getCompactWeatherLocationName(locationName) {
  const parts = String(locationName ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join(", ");
  }

  const city = parts[0];
  const country = parts.at(-1);
  return city === country ? city : `${city}, ${country}`;
}

async function fetchWeatherForecast(latitude, longitude) {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", latitude);
  weatherUrl.searchParams.set("longitude", longitude);
  weatherUrl.searchParams.set("current", "temperature_2m,weather_code");
  weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "1");

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error("Weather could not be loaded.");
  }

  const weatherData = await weatherResponse.json();
  const temperature = weatherData.current?.temperature_2m;
  const code = weatherData.current?.weather_code;

  return {
    temperature,
    code,
    condition: getWeatherConditionLabel(code),
    high: weatherData.daily?.temperature_2m_max?.[0],
    low: weatherData.daily?.temperature_2m_min?.[0],
    suggestedFilters: getWeatherClimateFilters(temperature, code),
    updatedAt: new Date().toISOString()
  };
}

async function fetchWeatherForLocation(query) {
  const searchUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  searchUrl.searchParams.set("name", query);
  searchUrl.searchParams.set("count", "1");
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("format", "json");

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error("Location search failed.");
  }

  const searchData = await searchResponse.json();
  const [location] = searchData.results ?? [];
  if (!location) {
    throw new Error("Location was not found.");
  }

  const weather = await fetchWeatherForecast(location.latitude, location.longitude);

  return {
    settings: {
      locationName: [location.name, location.admin1, location.country].filter(Boolean).join(", "),
      latitude: location.latitude,
      longitude: location.longitude
    },
    weather
  };
}

async function fetchWeatherForSavedLocation(settings) {
  const normalizedSettings = normalizeWeatherSettings(settings);

  if (!Number.isFinite(normalizedSettings.latitude) || !Number.isFinite(normalizedSettings.longitude)) {
    throw new Error("Location was not found.");
  }

  return {
    settings: normalizedSettings,
    weather: await fetchWeatherForecast(normalizedSettings.latitude, normalizedSettings.longitude)
  };
}

export default function App() {
  const outfitSectionTabs = [
    ["saved", "Saved"],
    ["fitpics", "Fitpics"]
  ];
  const editorRef = useRef(null);
  const importBackupRef = useRef(null);
  const fitpicUploadInputRef = useRef(null);
  const fitpicReplaceInputRef = useRef(null);
  const outfitStageRef = useRef(null);
  const pickerOverlayRef = useRef(null);
  const inlineEditorResizeRef = useRef(null);
  const outfitDebugRef = useRef(null);
  const generationListsRef = useRef(null);
  const workspaceTabsRef = useRef(null);
  const editorImageFrameRef = useRef(null);
  const editorImageRef = useRef(null);
  const paletteCacheRef = useRef(new Map());
  const generatePointerHandledAtRef = useRef(-1);
  const pointerActivatedControlRef = useRef(null);
  const lastInteractionWasPointerRef = useRef(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layering, setLayering] = useState(false);
  const [accessoriesEnabled, setAccessoriesEnabled] = useState(true);
  const [locked, setLocked] = useState({});
  const [excluded, setExcluded] = useState({});
  const [outfit, setOutfit] = useState({});
  const [outfitItemUuids, setOutfitItemUuids] = useState({});
  const [ignoredImportImages, setIgnoredImportImages] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [likedOutfitKeys, setLikedOutfitKeys] = useState({});
  const [outfitAffinity, setOutfitAffinity] = useState({});
  const [recentOutfits, setRecentOutfits] = useState([]);
  const [generateCount, setGenerateCount] = useState(0);
  const [fitpics, setFitpics] = useState([]);
  const [generationLists, setGenerationLists] = useState(defaultGenerationLists);
  const [generationMode, setGenerationMode] = useState(defaultGenerationMode);
  const [outfitFilters, setOutfitFilters] = useState(emptyOutfitFilters);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [activeOutfitsTab, setActiveOutfitsTab] = useState("saved");
  const [selectedSavedOutfitId, setSelectedSavedOutfitId] = useState(null);
  const [editingSavedOutfitId, setEditingSavedOutfitId] = useState(null);
  const [savedOutfitDraft, setSavedOutfitDraft] = useState({ name: "", description: "" });
  const [activeAccessorySlot, setActiveAccessorySlot] = useState(null);
  const [activeOutfitSlot, setActiveOutfitSlot] = useState(null);
  const [selectedAccessorySlot, setSelectedAccessorySlot] = useState(null);
  const [selectedOutfitSlot, setSelectedOutfitSlot] = useState(null);
  const [pickerAnchorSlot, setPickerAnchorSlot] = useState(null);
  const [fitpicPreview, setFitpicPreview] = useState(null);
  const [editingFitpicId, setEditingFitpicId] = useState(null);
  const [fitpicDraft, setFitpicDraft] = useState({ name: "", description: "", tagsText: "", favorite: false });
  const [fitpicImportError, setFitpicImportError] = useState("");
  const [fitpicImporting, setFitpicImporting] = useState(false);
  const [fitpicDropActive, setFitpicDropActive] = useState(false);
  const [wardrobePreviewItemId, setWardrobePreviewItemId] = useState(null);
  const [wardrobeFiltersOpen, setWardrobeFiltersOpen] = useState(false);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false);
  const [wardrobeManageOpen, setWardrobeManageOpen] = useState(false);
  const [selectedWardrobeItemIds, setSelectedWardrobeItemIds] = useState([]);
  const [wardrobeSelectionAnchorId, setWardrobeSelectionAnchorId] = useState(null);
  const [bulkListDraft, setBulkListDraft] = useState(defaultItemList);
  const [bulkCollectionDraft, setBulkCollectionDraft] = useState("");
  const [bulkMetadataEditorOpen, setBulkMetadataEditorOpen] = useState(false);
  const [bulkMetadataDraft, setBulkMetadataDraft] = useState(createEmptyBulkMetadataDraft);
  const [editingId, setEditingId] = useState(null);
  const [editorReturnTarget, setEditorReturnTarget] = useState(null);
  const [editorAdvancedOpen, setEditorAdvancedOpen] = useState(false);
  const [editorStylingOpen, setEditorStylingOpen] = useState(false);
  const [windowState, setWindowState] = useState(defaultWindowState);
  const [draft, setDraft] = useState(emptyForm);
  const [draftCollectionInput, setDraftCollectionInput] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [itemImageDragActive, setItemImageDragActive] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [wardrobeExportOptions, setWardrobeExportOptions] = useState(null);
  const [wardrobeSearch, setWardrobeSearch] = useState("");
  const [wardrobeFilterSearch, setWardrobeFilterSearch] = useState("");
  const [wardrobeFilterSectionsOpen, setWardrobeFilterSectionsOpen] = useState(defaultWardrobeFilterSectionsOpen);
  const [wardrobeFilters, setWardrobeFilters] = useState(emptyWardrobeFilters);
  const [wardrobeSort, setWardrobeSort] = useState(DEFAULT_WARDROBE_SORT);
  const [dashboardFilterSearch, setDashboardFilterSearch] = useState("");
  const [dashboardFilterSectionsOpen, setDashboardFilterSectionsOpen] = useState(defaultWardrobeFilterSectionsOpen);
  const [dashboardFilters, setDashboardFilters] = useState(emptyWardrobeFilters);
  const [dashboardSort, setDashboardSort] = useState(DEFAULT_WARDROBE_SORT);
  const [outfitPalette, setOutfitPalette] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(getIsMobileViewport);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [outfitFiltersOpen, setOutfitFiltersOpen] = useState(false);
  const [generationListsOpen, setGenerationListsOpen] = useState(false);
  const [weatherSettings, setWeatherSettings] = useState(emptyWeatherSettings);
  const [weatherLocationDraft, setWeatherLocationDraft] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [outfitDebugOpen, setOutfitDebugOpen] = useState(false);
  const [guidedDebugPayload, setGuidedDebugPayload] = useState([]);
  const [canUseDebugPopout, setCanUseDebugPopout] = useState(getCanUseDebugPopout);
  const [hasHydratedAppState, setHasHydratedAppState] = useState(false);
  const wardrobeSelectClickTimeoutRef = useRef(null);
  const wardrobePendingSelectionRef = useRef(null);
  const outfitItemPreviewClickTimeoutRef = useRef(null);
  const pendingOutfitItemPreviewRef = useRef(null);
  const fitpicDropDepthRef = useRef(0);

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );
  const wardrobePreviewItem = wardrobePreviewItemId ? itemsById[wardrobePreviewItemId] ?? null : null;
  const isWardrobePreviewItemEquipped = wardrobePreviewItem
    ? Object.values(outfit).includes(wardrobePreviewItem.id)
    : false;
  const editingFitpic = editingFitpicId ? fitpics.find((fitpic) => fitpic.id === editingFitpicId) ?? null : null;
  const activeEditorWindowStateKey = getEditorWindowStateKey(editingId, editorReturnTarget);
  const activeEditorWidth = windowState[activeEditorWindowStateKey]?.width
    ?? defaultWindowState[activeEditorWindowStateKey].width;

  useEffect(() => {
    if (!fitpicPreview) {
      return;
    }

    const nextPreview = fitpics.find((fitpic) => fitpic.id === fitpicPreview.id) ?? null;
    setFitpicPreview(nextPreview);
  }, [fitpicPreview, fitpics]);

  function noteInteractionModality(event) {
    if (event.type === "pointerdown") {
      lastInteractionWasPointerRef.current = true;
      return;
    }

    if (event.type !== "keydown") {
      return;
    }

    if (event.key === "Tab" || event.key === "Enter" || event.key === " " || event.key.startsWith("Arrow")) {
      lastInteractionWasPointerRef.current = false;
      pointerActivatedControlRef.current = null;
    }
  }

  function registerPointerActivatedControl(event) {
    if (event.detail === 0 || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    pointerActivatedControlRef.current = event.currentTarget;
    lastInteractionWasPointerRef.current = true;
  }

  function blurPointerActivatedControl(event) {
    registerPointerActivatedControl(event);

    if (!(event.currentTarget instanceof HTMLElement) || event.detail === 0) {
      return;
    }

    const target = event.currentTarget;

    window.setTimeout(() => {
      if (document.activeElement === target) {
        target.blur();
      }

      if (pointerActivatedControlRef.current === target) {
        pointerActivatedControlRef.current = null;
      }
    }, 0);
  }

  function preventMouseButtonFocus(event) {
    if (event?.detail !== 0) {
      event.preventDefault();
    }
  }

  function blurRetainedPointerFocus() {
    const activeElement = document.activeElement;
    const pointerActivatedControl = pointerActivatedControlRef.current;

    if (
      !lastInteractionWasPointerRef.current
      || !(activeElement instanceof HTMLElement)
      || !(pointerActivatedControl instanceof HTMLElement)
      || activeElement !== pointerActivatedControl
    ) {
      return;
    }

    activeElement.blur();
    pointerActivatedControlRef.current = null;
  }
  const isDockExpanded = isMobileViewport ? dockExpanded : true;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const handleChange = (event) => {
      setIsMobileViewport(event.matches);
      setDockExpanded(event.matches ? controlsOpen || activePanel === "wardrobe" || activePanel === "outfits" : true);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [activePanel, controlsOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1180px)");
    const handleChange = (event) => {
      setCanUseDebugPopout(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    return () => {
      if (wardrobeSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      }
      wardrobePendingSelectionRef.current = null;

      if (outfitItemPreviewClickTimeoutRef.current !== null) {
        window.clearTimeout(outfitItemPreviewClickTimeoutRef.current);
      }
      pendingOutfitItemPreviewRef.current = null;
    };
  }, []);

  const currentOutfitItems = useMemo(() => {
    const slots = accessoriesEnabled ? [...visibleSlots, ...accessorySlots] : visibleSlots;
    const seen = new Set();

    return slots
      .map((slot) => itemsById[outfit[slot]])
      .filter((item) => {
        if (!item || seen.has(item.id)) {
          return false;
        }

        seen.add(item.id);
        return true;
      });
  }, [accessoriesEnabled, itemsById, outfit]);
  const hasLockedOutfitSlots = visibleSlots.some((slot) => Boolean(locked[slot]));
  const currentOutfitKey = useMemo(() => getOutfitKey(outfit, layering), [outfit, layering]);
  const isCurrentOutfitLiked = Boolean(likedOutfitKeys[currentOutfitKey]);
  const currentSavedOutfit = useMemo(
    () => savedOutfits.find((savedOutfit) => getOutfitKey(savedOutfit.outfit, savedOutfit.layering) === currentOutfitKey) ?? null,
    [savedOutfits, currentOutfitKey]
  );
  const isCurrentOutfitSaved = Boolean(currentSavedOutfit);
  const explanationRecentOutfits = useMemo(
    () =>
      recentOutfits[0]?.key === currentOutfitKey
        ? recentOutfits.slice(1)
        : recentOutfits,
    [recentOutfits, currentOutfitKey]
  );
  const guidedDebugPayloadMatchesOutfit = useMemo(
    () =>
      guidedDebugPayload.length > 0 &&
      guidedDebugPayload.every((entry) => entry?.slot && outfit?.[entry.slot] === entry.itemId),
    [guidedDebugPayload, outfit]
  );
  const currentOutfitStyleChip = useMemo(
    () => getCurrentOutfitStyleChip(currentOutfitItems, outfitFilters.style ?? []),
    [currentOutfitItems, outfitFilters.style]
  );
  const compactWeatherLocationName = useMemo(
    () => getCompactWeatherLocationName(weatherSettings.locationName),
    [weatherSettings.locationName]
  );
  const currentOutfitClimateChip = useMemo(
    () =>
      getCurrentOutfitClimateChip(
        ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"]
          .map((slot) => {
            const item = itemsById[outfit[slot]];
            return item ? { slot, item } : null;
          })
          .filter(Boolean)
      ),
    [itemsById, outfit]
  );
  const currentOutfitDominantStyle = useMemo(
    () => getOutfitDominantStyle(outfit, itemsById),
    [outfit, itemsById]
  );
  const currentOutfitStyleTarget = useMemo(
    () => ((outfitFilters.style ?? []).length ? outfitFilters.style.join(", ") : currentOutfitStyleChip),
    [currentOutfitStyleChip, outfitFilters.style]
  );
  const guidedDebugDetails = useMemo(
    () => (generationMode === "guided" && guidedDebugPayloadMatchesOutfit ? guidedDebugPayload : []),
    [generationMode, guidedDebugPayload, guidedDebugPayloadMatchesOutfit]
  );
  const showDebugPopout = outfitDebugOpen && canUseDebugPopout && !isMobileViewport;
  const currentOutfitDebugReasons = useMemo(
    () =>
      generationMode === "guided"
        ? guidedDebugPayloadMatchesOutfit
          ? summarizeGuidedDebugPayload(guidedDebugPayload)
          : summarizeGuidedExplanation(
              outfit,
              itemsById,
              outfitFilters,
              weatherData,
              outfitAffinity,
              explanationRecentOutfits,
              layering
            )
        : [],
    [outfit, itemsById, outfitFilters, weatherData, outfitAffinity, explanationRecentOutfits, layering, generationMode, guidedDebugPayload, guidedDebugPayloadMatchesOutfit]
  );
  const activeOutfitFilterCount = Object.values(outfitFilters).reduce(
    (sum, values) => sum + (Array.isArray(values) ? values.length : 0),
    0
  );
  const generationSourceItems = useMemo(
    () => items.filter((item) => {
      const itemCollections = normalizeCollections(item.collections);
      const includedCollections = outfitFilters.collections ?? [];
      const excludedCollections = outfitFilters.collectionsExcluded ?? [];

      if (includedCollections.length && !includedCollections.some((collection) => itemCollections.includes(collection))) {
        return false;
      }

      if (excludedCollections.length && excludedCollections.some((collection) => itemCollections.includes(collection))) {
        return false;
      }

      return true;
    }),
    [items, outfitFilters.collections, outfitFilters.collectionsExcluded]
  );
  const compatibleAccessoryOptions = useMemo(() => {
    if (!activeAccessorySlot) {
      return [];
    }

    return getAccessoryOptions(activeAccessorySlot);
  }, [activeAccessorySlot, items, excluded, generationLists]);
  const typeSuggestions = useMemo(() => {
    const seen = new Set();
    return [...defaultTypeSuggestions, ...items.map((item) => item.type).filter(Boolean)].filter((value) => {
      const key = value.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);

  function renderOutfitDebugPanel(panelClassName = "") {
    const className = ["outfit-debug-panel", panelClassName].filter(Boolean).join(" ");

    return (
      <div className={className}>
        {generationMode === "guided" ? (
          <>
            <div className="outfit-debug-context">
              <div className="outfit-debug-row">
                <span>Mode</span>
                <strong>Guided</strong>
              </div>
              <div className="outfit-debug-row">
                <span>Style target</span>
                <strong>{currentOutfitStyleTarget || "Unspecified"}</strong>
              </div>
              <div className="outfit-debug-row">
                <span>Climate</span>
                <strong>{currentOutfitClimateChip}</strong>
              </div>
              {currentOutfitDominantStyle ? (
                <div className="outfit-debug-row">
                  <span>Dominant style</span>
                  <strong>{currentOutfitDominantStyle}</strong>
                </div>
              ) : null}
            </div>

            {guidedDebugDetails.length ? (
              <div className="outfit-debug-slot-grid">
                {guidedDebugDetails.map((entry) => {
                  const selectedItem = itemsById[entry.itemId];
                  const reasons = getGuidedBreakdownDisplayEntries(entry.breakdown, 3);
                  const topCandidates = (entry.topCandidates ?? []).slice(0, 5);

                  return (
                    <section key={entry.slot} className="outfit-debug-slot">
                      <h4 className="outfit-debug-slot-title">{entry.slot}</h4>
                      <div className="outfit-debug-slot-block">
                        <span className="outfit-debug-label">Selected</span>
                        <div className="outfit-debug-value-list">
                          <div className="outfit-debug-value-row">
                            <span>{selectedItem?.name ?? entry.itemId}</span>
                            <strong>{entry.score.toFixed(1)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="outfit-debug-slot-block">
                        <span className="outfit-debug-label">Reasons</span>
                        <div className="outfit-debug-value-list">
                          {reasons.map((reason) => (
                            <div key={`${entry.slot}-${reason.key}`} className="outfit-debug-value-row">
                              <span>{reason.label}</span>
                              <strong>{reason.value > 0 ? `+${reason.value.toFixed(1)}` : reason.value.toFixed(1)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="outfit-debug-slot-block">
                        <span className="outfit-debug-label">Top alternatives</span>
                        <div className="outfit-debug-value-list">
                          {topCandidates.map((candidate) => (
                            <div key={`${entry.slot}-${candidate.itemId}`} className="outfit-debug-value-row">
                              <span>{itemsById[candidate.itemId]?.name ?? candidate.itemId}</span>
                              <strong>{candidate.score.toFixed(1)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : currentOutfitDebugReasons.length ? (
              <>
                <p className="outfit-debug-note">
                  Detailed slot rankings are only available for the exact generated outfit. This view is showing a fallback summary.
                </p>
                {currentOutfitDebugReasons.map((reason) => (
                  <div key={reason.key} className="outfit-debug-row">
                    <span>{reason.label}</span>
                    <strong>{reason.value > 0 ? `+${reason.value.toFixed(1)}` : reason.value.toFixed(1)}</strong>
                  </div>
                ))}
              </>
            ) : (
              <p className="outfit-debug-empty">No guided scoring reasons available.</p>
            )}
          </>
        ) : (
          <p className="outfit-debug-empty">Guided scoring is disabled in Random mode.</p>
        )}
      </div>
    );
  }
  const brandSuggestions = useMemo(() => {
    const seen = new Set();
    return items.map((item) => item.brand).filter((value) => {
      const key = value?.trim?.().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const colorSuggestions = useMemo(() => {
    const seen = new Set();
    return items.map((item) => item.color).filter((value) => {
      const key = value?.trim?.().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const nameSuggestions = useMemo(() => {
    const seen = new Set();
    return items.map((item) => item.name).filter((value) => {
      const key = value?.trim?.().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [items]);
  const resolvedTypeDefaults = useMemo(() => resolveTypeDefaults(draft.type), [draft.type]);
  const advancedOverrideFields = useMemo(
    () => getAdvancedOverrideFields(draft, resolvedTypeDefaults),
    [draft, resolvedTypeDefaults]
  );
  const advancedOverrideSet = useMemo(() => new Set(advancedOverrideFields), [advancedOverrideFields]);
  const advancedMetadataOverrideCount = useMemo(
    () => advancedOverrideFields.filter((field) => advancedEditorFields.includes(field)).length,
    [advancedOverrideFields]
  );
  const stylingOverrideCount = useMemo(
    () => advancedOverrideFields.filter((field) => stylingEditorFields.includes(field)).length,
    [advancedOverrideFields]
  );
  const selectedStyleTagCount = normalizeTagList(draft.styleTags, styleTagOptions).length;
  const selectedClimateTagCount = normalizeTagList(draft.climateTags, editableClimateTagOptions).length;
  const itemListOptions = useMemo(
    () => getItemStatusOptions([
      ...items.map((item) => item.status ?? item.list),
      ...Object.keys(generationLists ?? {}),
      draft.status,
      ...(wardrobeFilters.status ?? [])
    ]),
    [draft.status, generationLists, items, wardrobeFilters.status]
  );
  const dashboardItemListOptions = useMemo(
    () => getItemStatusOptions([
      ...items.map((item) => item.status ?? item.list),
      ...Object.keys(generationLists ?? {}),
      ...(dashboardFilters.status ?? [])
    ]),
    [dashboardFilters.status, generationLists, items]
  );
  const collectionOptions = useMemo(
    () =>
      [...new Set(items.flatMap((item) => normalizeCollections(item.collections)))].sort((left, right) => left.localeCompare(right)),
    [items]
  );
  const wardrobeSearchTextById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, getWardrobeSearchText(item)])),
    [items]
  );
  const wardrobeFilterOptions = useMemo(
    () =>
      getWardrobeFilterOptions(items, wardrobeFilters, {
        itemStatusOptions: itemListOptions,
        styleTagOptions,
        climateFilterOptions: climateTagOptions
      }),
    [itemListOptions, items, wardrobeFilters]
  );
  const dashboardFilterOptions = useMemo(
    () =>
      getWardrobeFilterOptions(items, dashboardFilters, {
        itemStatusOptions: dashboardItemListOptions,
        styleTagOptions,
        climateFilterOptions: climateTagOptions
      }),
    [dashboardItemListOptions, items, dashboardFilters]
  );
  const canRemoveDraftBackground = isLocalDataImage(draft.imageUrl);
  const activeWardrobeFilterCount = Object.entries(wardrobeFilters).reduce(
    (count, [key, value]) =>
      count + (
        wardrobeMultiValueFilterKeys.includes(key) || wardrobeExcludedMultiValueFilterKeys.includes(key)
          ? value.length
          : value
            ? 1
            : 0
      ),
    0
  );
  const hasActiveWardrobeFilters = activeWardrobeFilterCount > 0;
  const activeDashboardFilterCount = Object.entries(dashboardFilters).reduce(
    (count, [key, value]) =>
      count + (
        wardrobeMultiValueFilterKeys.includes(key) || wardrobeExcludedMultiValueFilterKeys.includes(key)
          ? value.length
          : value
            ? 1
            : 0
      ),
    0
  );
  const hasActiveDashboardFilters = activeDashboardFilterCount > 0;
  const includedGenerationLists = useMemo(
    () => itemListOptions.filter((list) => isGenerationListEnabled(list)),
    [itemListOptions, generationLists]
  );
  const generationListsSummary = useMemo(() => {
    if (!includedGenerationLists.length) {
      return "None";
    }

    if (includedGenerationLists.length <= 2) {
      return includedGenerationLists.join(", ");
    }

    return `${includedGenerationLists.length} included`;
  }, [includedGenerationLists]);
  const buildActiveFilterChips = (filters) => [
    ...[
      ["Brand", "brand"],
      ["Type", "type"],
      ["Garment", "garmentType"],
      ["Color", "color"],
      ["Style", "style"],
      ["Climate", "climate"],
      ["Weight", "weight"],
      ["Status", "status"],
      ["Collections", "collections"]
    ].flatMap(([label, key]) => [
      ...getIncludedFilterValues(filters, key).map((value) => ({ label, value, excluded: false })),
      ...getExcludedFilterValues(filters, key).map((value) => ({ label, value, excluded: true }))
    ]),
    ...(filters.laundry ? [{ label: "Exclude", value: filters.laundry, excluded: false }] : []),
    ...(filters.favorite ? [{ label: "Favorite", value: filters.favorite, excluded: false }] : [])
  ].map((filter) => ({
    ...filter,
    value:
      filter.label === "Favorite"
        ? filter.value === "yes"
          ? "Yes"
          : "No"
        : filter.label === "Exclude"
          ? filter.value === "show"
            ? "Show excluded"
            : "Hide excluded"
          : filter.value === "__none__"
            ? filter.excluded
              ? `Has ${filter.label.toLowerCase()}`
              : `No ${filter.label.toLowerCase()}`
            : filter.excluded
              ? `Not ${filter.value}`
              : filter.value
  }));
  const activeWardrobeFilterChips = buildActiveFilterChips(wardrobeFilters);
  const activeDashboardFilterChips = buildActiveFilterChips(dashboardFilters);
  const wardrobeFilterPanelSections = useMemo(
    () => [
      { label: "Brand", key: "brand", options: wardrobeFilterOptions.brand, includeNone: true, kind: "multi" },
      { label: "Garment", key: "garmentType", options: wardrobeFilterOptions.garmentType, includeNone: true, kind: "multi" },
      { label: "Type", key: "type", options: wardrobeFilterOptions.type, includeNone: true, kind: "multi" },
      { label: "Color", key: "color", options: wardrobeFilterOptions.color, includeNone: true, kind: "multi" },
      { label: "Style", key: "style", options: wardrobeFilterOptions.style, includeNone: false, kind: "multi" },
      { label: "Climate", key: "climate", options: wardrobeFilterOptions.climate, includeNone: true, kind: "multi" },
      { label: "Weight", key: "weight", options: wardrobeFilterOptions.weight, includeNone: true, kind: "multi" },
      { label: "Status", key: "status", options: wardrobeFilterOptions.status, includeNone: false, kind: "multi" },
      { label: "Collections", key: "collections", options: wardrobeFilterOptions.collections, includeNone: false, kind: "multi" },
      {
        label: "Favorite",
        key: "favorite",
        options: [
          { label: "Favorites", value: "yes" },
          { label: "Not favorites", value: "no" }
        ],
        includeNone: false,
        kind: "single"
      },
      {
        label: "Exclude",
        key: "laundry",
        options: [
          { label: "Show excluded", value: "show" },
          { label: "Hide excluded", value: "hide" }
        ],
        includeNone: false,
        kind: "single"
      }
    ],
    [wardrobeFilterOptions]
  );
  const dashboardFilterPanelSections = useMemo(
    () => [
      { label: "Brand", key: "brand", options: dashboardFilterOptions.brand, includeNone: true, kind: "multi" },
      { label: "Garment", key: "garmentType", options: dashboardFilterOptions.garmentType, includeNone: true, kind: "multi" },
      { label: "Type", key: "type", options: dashboardFilterOptions.type, includeNone: true, kind: "multi" },
      { label: "Color", key: "color", options: dashboardFilterOptions.color, includeNone: true, kind: "multi" },
      { label: "Style", key: "style", options: dashboardFilterOptions.style, includeNone: false, kind: "multi" },
      { label: "Climate", key: "climate", options: dashboardFilterOptions.climate, includeNone: true, kind: "multi" },
      { label: "Weight", key: "weight", options: dashboardFilterOptions.weight, includeNone: true, kind: "multi" },
      { label: "Status", key: "status", options: dashboardFilterOptions.status, includeNone: false, kind: "multi" },
      { label: "Collections", key: "collections", options: dashboardFilterOptions.collections, includeNone: false, kind: "multi" },
      {
        label: "Favorite",
        key: "favorite",
        options: [
          { label: "Favorites", value: "yes" },
          { label: "Not favorites", value: "no" }
        ],
        includeNone: false,
        kind: "single"
      },
      {
        label: "Exclude",
        key: "laundry",
        options: [
          { label: "Show excluded", value: "show" },
          { label: "Hide excluded", value: "hide" }
        ],
        includeNone: false,
        kind: "single"
      }
    ],
    [dashboardFilterOptions]
  );
  const normalizedWardrobeFilterSearch = wardrobeFilterSearch.trim().toLowerCase();
  const normalizedDashboardFilterSearch = dashboardFilterSearch.trim().toLowerCase();

  function requestConfirmation({ title, message, confirmLabel = "Confirm" }) {
    return new Promise((resolve) => {
      setConfirmation({
        title,
        message,
        confirmLabel,
        onCancel: () => {
          setConfirmation(null);
          resolve(false);
        },
        onConfirm: () => {
          setConfirmation(null);
          resolve(true);
        }
      });
    });
  }

  function clearWardrobeSelection() {
    setSelectedWardrobeItemIds([]);
    setWardrobeSelectionAnchorId(null);
    setBulkCollectionDraft("");
    setBulkMetadataEditorOpen(false);
    setBulkMetadataDraft(createEmptyBulkMetadataDraft());
  }

  async function persistBulkSelectionUpdate(updater) {
    const timestamp = new Date().toISOString();
    let updatedEditingDraft = null;

    const { nextItems, changedItems } = updateSelectedItems(items, selectedWardrobeItemIds, (item) => {
      const draftItem = updater(item);
      const normalizedItem = normalizeStoredItem(draftItem, normalizeTimestamp(item.createdAt) || timestamp);

      if (!hasMeaningfulItemChange(item, normalizedItem)) {
        return item;
      }

      const nextItem = {
        ...normalizedItem,
        createdAt: normalizeTimestamp(item.createdAt) || normalizedItem.createdAt,
        updatedAt: timestamp
      };

      if (editingId === item.id) {
        updatedEditingDraft = nextItem;
      }

      return nextItem;
    });

    if (!changedItems.length) {
      return false;
    }

    await Promise.all(changedItems.map((item) => saveItem(item)));
    setItems(nextItems);

    if (updatedEditingDraft) {
      setDraft(updatedEditingDraft);
    }

    return true;
  }

  async function moveSelectedItemsToList(status) {
    const normalizedStatus = normalizeStatus(status);
    const confirmed = await requestConfirmation({
      title: `Set status for ${selectedWardrobeItemCount} selected item${selectedWardrobeItemCount === 1 ? "" : "s"}?`,
      message: `Set status to ${normalizedStatus} for the selected items.`,
      confirmLabel: "Set status"
    });

    if (!confirmed) {
      return;
    }

    await persistBulkSelectionUpdate((item) => setItemStatus(item, normalizedStatus));
  }

  async function addCollectionToSelectedItems(collection) {
    const normalizedCollection = collection.trim();
    if (!normalizedCollection) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: `Add collection to ${selectedWardrobeItemCount} selected item${selectedWardrobeItemCount === 1 ? "" : "s"}?`,
      message: `Add ${normalizedCollection} to the selected items.`,
      confirmLabel: "Add collection"
    });

    if (!confirmed) {
      return;
    }

    const didUpdate = await persistBulkSelectionUpdate((item) => addCollectionToItem(item, normalizedCollection));
    if (didUpdate) {
      setBulkCollectionDraft("");
    }
  }

  async function removeCollectionFromSelectedItems(collection) {
    const normalizedCollection = collection.trim();
    if (!normalizedCollection) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: `Remove collection from ${selectedWardrobeItemCount} selected item${selectedWardrobeItemCount === 1 ? "" : "s"}?`,
      message: `Remove ${normalizedCollection} from the selected items.`,
      confirmLabel: "Remove collection"
    });

    if (!confirmed) {
      return;
    }

    const didUpdate = await persistBulkSelectionUpdate((item) => removeCollectionFromItem(item, normalizedCollection));
    if (didUpdate) {
      setBulkCollectionDraft("");
    }
  }

  async function clearSelectedItemCollections() {
    const confirmed = await requestConfirmation({
      title: `Clear collections for ${selectedWardrobeItemCount} selected item${selectedWardrobeItemCount === 1 ? "" : "s"}?`,
      message: "Remove all collections from the selected items.",
      confirmLabel: "Clear collections"
    });

    if (!confirmed) {
      return;
    }

    const didUpdate = await persistBulkSelectionUpdate((item) => clearItemCollections(item));
    if (didUpdate) {
      setBulkCollectionDraft("");
    }
  }

  function openBulkMetadataEditor(nextDraftOverrides = {}) {
    if (selectedWardrobeItems.length < 2) {
      return;
    }

    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImageDragActive(false);
    setEditingId(null);
    setEditorReturnTarget(null);
    setEditorAdvancedOpen(false);
    setDraft(emptyForm);
    setBulkMetadataDraft({
      ...createEmptyBulkMetadataDraft(),
      ...nextDraftOverrides
    });
    setBulkMetadataEditorOpen(true);
  }

  function editSelectedWardrobeItems() {
    if (selectedWardrobeItems.length === 1) {
      if (editingId === selectedWardrobeItems[0].id && editorReturnTarget === "wardrobe") {
        cancelEdit();
        return;
      }

      startEdit(selectedWardrobeItems[0]);
      return;
    }

    if (selectedWardrobeItems.length > 1) {
      openBulkMetadataEditor();
    }
  }

  async function setSelectedItemsFavoriteState(favorite) {
    await persistBulkSelectionUpdate((item) => ({
      ...item,
      favorite
    }));
  }

  async function setSelectedItemsExcludedState(shouldExclude) {
    if (!selectedWardrobeItemIds.length) {
      return;
    }

    const selectedIdSet = new Set(selectedWardrobeItemIds);

    setExcluded((current) => {
      const nextExcluded = { ...current };

      if (shouldExclude) {
        selectedWardrobeItemIds.forEach((itemId) => {
          nextExcluded[itemId] = true;
        });
      } else {
        selectedWardrobeItemIds.forEach((itemId) => {
          delete nextExcluded[itemId];
        });
      }

      if (!shouldExclude) {
        return nextExcluded;
      }

      setOutfit((previous) => {
        const sanitized = Object.fromEntries(
          Object.entries(previous).map(([slot, equippedId]) => [
            slot,
            selectedIdSet.has(equippedId) ? null : equippedId
          ])
        );

        return buildNextOutfit(generationSourceItems, sanitized, locked, layering, nextExcluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits);
      });

      return nextExcluded;
    });
  }

  function setBulkMetadataFieldMode(field, mode) {
    setBulkMetadataDraft((current) => ({
      ...current,
      [`${field}Mode`]: mode
    }));
  }

  function setBulkMetadataFieldValue(field, value) {
    setBulkMetadataDraft((current) => ({
      ...current,
      [`${field}Value`]: value
    }));
  }

  function toggleBulkMetadataTag(tagGroup, mode, tag) {
    const keyMap = {
      styleTags: ["styleTagsToAdd", "styleTagsToRemove"],
      climateTags: ["climateTagsToAdd", "climateTagsToRemove"]
    };
    const [addKey, removeKey] = keyMap[tagGroup];

    setBulkMetadataDraft((current) =>
      mode === "add"
        ? toggleBulkTagAssignment(current, addKey, removeKey, tag)
        : toggleBulkTagRemoval(current, addKey, removeKey, tag)
    );
  }

  async function applyBulkMetadataChanges(event) {
    event.preventDefault();

    const normalizedBulkCollectionValue = bulkMetadataDraft.collectionsValue.trim();
    const normalizedBulkStatusValue = normalizeStatus(bulkMetadataDraft.statusValue);
    const collectionActionRequiresValue = ["add", "remove"].includes(bulkMetadataDraft.collectionsMode);

    if (collectionActionRequiresValue && !normalizedBulkCollectionValue) {
      return;
    }

    const summaryParts = [];

    if (bulkMetadataDraft.statusMode === "set") {
      summaryParts.push(`set status to ${normalizedBulkStatusValue}`);
    }

    if (bulkMetadataDraft.collectionsMode === "add") {
      summaryParts.push(`add collection ${normalizedBulkCollectionValue}`);
    } else if (bulkMetadataDraft.collectionsMode === "remove") {
      summaryParts.push(`remove collection ${normalizedBulkCollectionValue}`);
    } else if (bulkMetadataDraft.collectionsMode === "clear") {
      summaryParts.push("clear collections");
    }

    const confirmed = await requestConfirmation({
      title: `Apply changes to ${selectedWardrobeItemCount} selected item${selectedWardrobeItemCount === 1 ? "" : "s"}?`,
      message: summaryParts.length
        ? `Apply these changes: ${summaryParts.join(", ")}.`
        : "Apply the selected bulk metadata changes.",
      confirmLabel: "Apply changes"
    });

    if (!confirmed) {
      return;
    }

    const didUpdate = await persistBulkSelectionUpdate((item) => {
      let nextItem = { ...item };

      if (bulkMetadataDraft.statusMode === "set") {
        nextItem = setItemStatus(nextItem, normalizedBulkStatusValue);
      }

      if (bulkMetadataDraft.typeMode === "set") {
        nextItem = applyTypeDefaultsToDraft(nextItem, bulkMetadataDraft.typeValue);
      } else if (bulkMetadataDraft.typeMode === "clear") {
        nextItem = applyTypeDefaultsToDraft(nextItem, "");
      }

      [
        ["color", ""],
        ["brand", ""],
        ["name", ""],
        ["description", ""],
        ["size", ""],
        ["weight", ""],
        ["quantity", ""],
        ["value", ""],
        ["retailValue", ""]
      ].forEach(([field, emptyValue]) => {
        const mode = bulkMetadataDraft[`${field}Mode`];

        if (mode === "set") {
          nextItem[field] = bulkMetadataDraft[`${field}Value`];
        } else if (mode === "clear") {
          nextItem[field] = emptyValue;
        }
      });

      bulkMetadataDraft.styleTagsToAdd.forEach((tag) => {
        nextItem.styleTags = addTagToItemTags(nextItem.styleTags, tag, styleTagOptions);
      });
      bulkMetadataDraft.styleTagsToRemove.forEach((tag) => {
        nextItem.styleTags = removeTagFromItemTags(nextItem.styleTags, tag, styleTagOptions);
      });
      bulkMetadataDraft.climateTagsToAdd.forEach((tag) => {
        nextItem.climateTags = addTagToItemTags(nextItem.climateTags, tag, editableClimateTagOptions);
      });
      bulkMetadataDraft.climateTagsToRemove.forEach((tag) => {
        nextItem.climateTags = removeTagFromItemTags(nextItem.climateTags, tag, editableClimateTagOptions);
      });

      if (bulkMetadataDraft.collectionsMode === "add") {
        nextItem = addCollectionToItem(nextItem, normalizedBulkCollectionValue);
      } else if (bulkMetadataDraft.collectionsMode === "remove") {
        nextItem = removeCollectionFromItem(nextItem, normalizedBulkCollectionValue);
      } else if (bulkMetadataDraft.collectionsMode === "clear") {
        nextItem = clearItemCollections(nextItem);
      }

      return nextItem;
    });

    if (didUpdate) {
      setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    }
  }

  async function handleBulkDeleteSelected() {
    if (!selectedWardrobeItemCount) {
      return;
    }

    const selectedItemLabel = selectedWardrobeItemCount === 1 ? "item" : "items";
    const selectedCollectionLabel = selectedWardrobeItemCount === 1 ? "This selected wardrobe item" : "These selected wardrobe items";
    const confirmed = await requestConfirmation({
      title: `Delete ${selectedWardrobeItemCount} ${selectedItemLabel}?`,
      message: `${selectedCollectionLabel} will be removed from outfits and saved outfits in this browser.`,
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    const { nextItems, removedIds } = removeSelectedItems(items, selectedWardrobeItemIds);

    await Promise.all(removedIds.map((itemId) => deleteItem(itemId)));
    setItems(nextItems);
    const nextCurrentOutfit = removedIds.reduce((nextOutfit, itemId) => clearItemIdFromOutfit(nextOutfit, itemId), outfit);
    setOutfit(nextCurrentOutfit);
    setOutfitItemUuids((current) => syncOutfitItemUuids(nextCurrentOutfit, current, itemsById));
    setSavedOutfits((current) =>
      current.map((savedOutfit) => ({
        ...savedOutfit,
        outfit: removedIds.reduce(
          (nextOutfit, itemId) => clearItemIdFromOutfit(nextOutfit, itemId),
          savedOutfit.outfit
        ),
        outfitItemUuids: syncOutfitItemUuids(
          removedIds.reduce(
            (nextOutfit, itemId) => clearItemIdFromOutfit(nextOutfit, itemId),
            savedOutfit.outfit
          ),
          savedOutfit.outfitItemUuids,
          itemsById
        )
      }))
    );
  }

  const visibleWardrobeItems = useMemo(() => {
    const filtered = filterWardrobeItems(items, wardrobeFilters, excluded, wardrobeSearch, wardrobeSearchTextById);
    return sortWardrobeItems(filtered, wardrobeSort);
  }, [excluded, items, wardrobeFilters, wardrobeSearch, wardrobeSearchTextById, wardrobeSort]);
  const visibleDashboardItems = useMemo(() => {
    const filtered = filterWardrobeItems(items, dashboardFilters, excluded, "", wardrobeSearchTextById);
    return sortWardrobeItems(filtered, dashboardSort);
  }, [dashboardFilters, dashboardSort, excluded, items, wardrobeSearchTextById]);
  const visibleWardrobeItemIds = useMemo(
    () => visibleWardrobeItems.map((item) => item.id),
    [visibleWardrobeItems]
  );
  const wardrobePreviewNavigation = useMemo(
    () => getWardrobePreviewNavigation(visibleWardrobeItemIds, wardrobePreviewItemId),
    [visibleWardrobeItemIds, wardrobePreviewItemId]
  );
  const selectedWardrobeItemCount = selectedWardrobeItemIds.length;
  const hasWardrobeSelection = selectedWardrobeItemCount > 0;
  const favoriteWardrobeItemCount = useMemo(
    () => items.reduce((count, item) => count + (item.favorite ? 1 : 0), 0),
    [items]
  );
  const favoriteDashboardItemCount = useMemo(
    () => visibleDashboardItems.reduce((count, item) => count + (item.favorite ? 1 : 0), 0),
    [visibleDashboardItems]
  );
  const selectedWardrobeItems = useMemo(
    () => selectedWardrobeItemIds.map((itemId) => itemsById[itemId]).filter(Boolean),
    [itemsById, selectedWardrobeItemIds]
  );
  const areAllSelectedWardrobeItemsFavorite = useMemo(
    () => selectedWardrobeItems.length > 0 && selectedWardrobeItems.every((item) => Boolean(item.favorite)),
    [selectedWardrobeItems]
  );
  const areAllSelectedWardrobeItemsExcluded = useMemo(
    () => selectedWardrobeItems.length > 0 && selectedWardrobeItems.every((item) => Boolean(excluded[item.id])),
    [excluded, selectedWardrobeItems]
  );
  const bulkFavoriteActionLabel = areAllSelectedWardrobeItemsFavorite ? "Unfavorite" : "Favorite";
  const bulkExcludeActionLabel = areAllSelectedWardrobeItemsExcluded ? "Include" : "Exclude";

  const wardrobeWorth = useMemo(() => {
    const categories = garmentTypes;
    const byCategory = Object.fromEntries(
      categories.map((category) => [category, { category, count: 0, value: 0, retailValue: 0 }])
    );

    visibleWardrobeItems
      .forEach((item) => {
        const category = getWorthCategory(item);
        const quantity = normalizeQuantity(item.quantity);
        byCategory[category].count += quantity;
        byCategory[category].value += getNumericValue(item.value) * quantity;
        byCategory[category].retailValue += getNumericValue(item.retailValue) * quantity;
      });

    const rows = categories.map((category) => byCategory[category]);
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const totalRetailValue = rows.reduce((sum, row) => sum + row.retailValue, 0);
    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    const maxValue = Math.max(...rows.flatMap((row) => [row.value, row.retailValue]), 1);

    return { rows, totalValue, totalRetailValue, totalCount, maxValue };
  }, [visibleWardrobeItems]);
  const wardrobePreviewPositionLabel = useMemo(() => {
    if (wardrobePreviewNavigation.currentIndex < 0 || wardrobePreviewNavigation.totalCount <= 0) {
      return null;
    }

    return `${wardrobePreviewNavigation.currentIndex + 1} of ${wardrobePreviewNavigation.totalCount}`;
  }, [wardrobePreviewNavigation.currentIndex, wardrobePreviewNavigation.totalCount]);

  useEffect(() => {
    if (!wardrobePreviewItemId) {
      return;
    }

    if (!visibleWardrobeItemIds.includes(wardrobePreviewItemId)) {
      setWardrobePreviewItemId(null);
    }
  }, [visibleWardrobeItemIds, wardrobePreviewItemId]);
  const wardrobePreviewMeta = useMemo(() => {
    if (!wardrobePreviewItem) {
      return null;
    }

    const valueLabel = getNumericValue(wardrobePreviewItem.value) > 0
      ? `Value ${formatCurrency(wardrobePreviewItem.value)}`
      : null;
    const quantityLabel = Number(wardrobePreviewItem.quantity) > 1
      ? `Qty ${Math.round(Number(wardrobePreviewItem.quantity))}`
      : null;

    return [
      wardrobePreviewPositionLabel,
      wardrobePreviewItem.type?.trim() || null,
      wardrobePreviewItem.size?.trim() || null,
      valueLabel,
      normalizeStatus(wardrobePreviewItem.status ?? wardrobePreviewItem.list),
      quantityLabel,
      normalizeCollections(wardrobePreviewItem.collections).length
        ? normalizeCollections(wardrobePreviewItem.collections).join(", ")
        : null,
      excluded[wardrobePreviewItem.id] ? "Excluded from generation" : null
    ]
      .filter(Boolean)
      .join(" · ");
  }, [excluded, wardrobePreviewItem, wardrobePreviewPositionLabel]);
  const dashboardWorth = useMemo(() => {
    const categories = garmentTypes;
    const byCategory = Object.fromEntries(
      categories.map((category) => [category, { category, count: 0, value: 0, retailValue: 0 }])
    );

    visibleDashboardItems.forEach((item) => {
      const category = getWorthCategory(item);
      const quantity = normalizeQuantity(item.quantity);
      byCategory[category].count += quantity;
      byCategory[category].value += getNumericValue(item.value) * quantity;
      byCategory[category].retailValue += getNumericValue(item.retailValue) * quantity;
    });

    const rows = categories.map((category) => byCategory[category]);
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const totalRetailValue = rows.reduce((sum, row) => sum + row.retailValue, 0);
    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    const maxValue = Math.max(...rows.flatMap((row) => [row.value, row.retailValue]), 1);

    return { rows, totalValue, totalRetailValue, totalCount, maxValue };
  }, [visibleDashboardItems]);
  const hasWardrobeEditorOpen = Boolean(editingId || bulkMetadataEditorOpen);
  const showInlineWardrobeEditor = Boolean(
    hasWardrobeEditorOpen && activePanel === "wardrobe" && editorReturnTarget !== "outfit" && !isMobileViewport
  );

  useEffect(() => {
    let cancelled = false;

    async function updateOutfitPalette() {
      if (!currentOutfitItems.length) {
        setOutfitPalette([]);
        return;
      }

      const itemPalettes = await Promise.all(
        currentOutfitItems.map(async (item) => {
          const cacheKey = `${item.id}:${item.imageUrl}:${item.color}`;
          if (!paletteCacheRef.current.has(cacheKey)) {
            paletteCacheRef.current.set(cacheKey, await extractItemPalette(item));
          }

          return {
            item,
            colors: paletteCacheRef.current.get(cacheKey)
          };
        })
      );

      if (!cancelled) {
        setOutfitPalette(mergePaletteColors(itemPalettes));
      }
    }

    updateOutfitPalette();

    return () => {
      cancelled = true;
    };
  }, [currentOutfitItems]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [storedItems, storedAppState] = await Promise.all([loadItems(), load(), getOrCreateDeviceId()]);
      const fallbackTimestampBaseMs = Date.now() - Math.max(storedItems.length - 1, 0) * 1000;
      const normalizedItems = storedItems
        .map((item, index) => normalizeStoredItem(item, createFallbackItemTimestamp(fallbackTimestampBaseMs, index)))
        .map((item) =>
          (storedAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION
            ? restoreLegacyBakedImageScale(item)
            : item
        );
      const shouldApplyStyleWeightMigration =
        (storedAppState?.itemDefaultsMigrationVersion ?? 0) < ITEM_DEFAULTS_MIGRATION_VERSION;
      const shouldApplyImagePresentationMigration =
        (storedAppState?.imagePresentationMigrationVersion ?? 0) < IMAGE_PRESENTATION_MIGRATION_VERSION;
      const styleWeightedItems = shouldApplyStyleWeightMigration
        ? normalizedItems.map(applyMappedStyleWeightDefaults)
        : normalizedItems;
      const effectiveItems = shouldApplyImagePresentationMigration
        ? await Promise.all(styleWeightedItems.map((item) => bakeItemImagePresentation(item)))
        : styleWeightedItems;
      const migratedItems = effectiveItems.filter(
        (item, index) =>
          itemNeedsRetailMigration(storedItems[index], item) ||
          itemNeedsImageFrameScaleMigration(storedItems[index], item) ||
          itemNeedsImageScaleMigration(storedItems[index], item) ||
          itemNeedsImageOffsetMigration(storedItems[index], item) ||
          itemNeedsImageCropMigration(storedItems[index], item) ||
          itemNeedsImageContractMigration(storedItems[index], item) ||
          itemNeedsFavoriteMigration(storedItems[index], item) ||
          itemNeedsQuantityMigration(storedItems[index], item) ||
          itemNeedsDescriptionMigration(storedItems[index], item) ||
          itemNeedsColorMigration(storedItems[index], item) ||
          (!shouldApplyStyleWeightMigration && itemNeedsWeightMigration(storedItems[index], item)) ||
          itemNeedsGarmentTypeMigration(storedItems[index], item) ||
          (!shouldApplyStyleWeightMigration && itemNeedsTagMigration(storedItems[index], item)) ||
          itemNeedsClimateTagMigration(storedItems[index], item) ||
          itemNeedsItemUuidMigration(storedItems[index], item) ||
          itemNeedsImportMetadataMigration(storedItems[index], item) ||
          itemNeedsDefaultMetadataMigration(storedItems[index], item) ||
          itemNeedsTimestampMigration(storedItems[index], item) ||
          (shouldApplyStyleWeightMigration &&
            itemNeedsStyleWeightMappingMigration(storedItems[index], item, areEditorValuesEqual))
      );

      if (cancelled) {
        return;
      }

      if (migratedItems.length) {
        await Promise.all(migratedItems.map((item) => saveItem(item)));
      }

      let hydratedAppState;
      if (storedAppState) {
        hydratedAppState = normalizeHydratedAppState(storedAppState, {
          fallbackOutfit: {},
          normalizeWeatherSettings,
          itemsById: Object.fromEntries(effectiveItems.map((item) => [item.id, item]))
        });
      } else {
        const defaultData = getDefaultData();
        const defaultState = defaultData.appState;
        const fallbackOutfit = defaultState.outfit ?? buildNextOutfit(effectiveItems, {}, {}, false, {}, defaultGenerationLists, emptyOutfitFilters, null, defaultGenerationMode, normalizeOutfitAffinity(defaultState.outfitAffinity), normalizeRecentOutfits(defaultState.recentOutfits));
        hydratedAppState = normalizeHydratedAppState(defaultState, {
          fallbackOutfit,
          normalizeWeatherSettings,
          itemsById: Object.fromEntries(effectiveItems.map((item) => [item.id, item]))
        });
      }

      setItems(effectiveItems);
      setLayering(hydratedAppState.layering);
      setAccessoriesEnabled(hydratedAppState.accessoriesEnabled);
      setLocked(hydratedAppState.locked);
      setExcluded(hydratedAppState.excluded);
      setOutfit(hydratedAppState.outfit);
      setOutfitItemUuids(hydratedAppState.outfitItemUuids);
      setGuidedDebugPayload(hydratedAppState.guidedDebugPayload);
      setIgnoredImportImages(hydratedAppState.ignoredImportImages);
      setSavedOutfits(hydratedAppState.savedOutfits);
      setLikedOutfitKeys(hydratedAppState.likedOutfitKeys);
      setOutfitAffinity(hydratedAppState.outfitAffinity);
      setRecentOutfits(hydratedAppState.recentOutfits);
      setGenerateCount(hydratedAppState.generateCount);
      setGenerationLists(hydratedAppState.generationLists);
      setGenerationMode(hydratedAppState.generationMode);
      setOutfitFilters(hydratedAppState.outfitFilters);
      setWeatherSettings(hydratedAppState.weatherSettings);
      setWeatherLocationDraft(hydratedAppState.weatherLocationDraft);
      setWeatherData(hydratedAppState.weatherData);
      setFitpics(hydratedAppState.fitpics);
      setWardrobeFilters(hydratedAppState.wardrobeFilters);
      setWardrobeSort(hydratedAppState.wardrobeSort);
      setWindowState(hydratedAppState.windowState);

      await backfillLocalSyncMetadata({
        items: effectiveItems,
        savedOutfits: hydratedAppState.savedOutfits
      });

      setLoading(false);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    setHasHydratedAppState(true);
  }, [loading]);

  useEffect(() => {
    if (loading || !hasHydratedAppState) {
      return;
    }

    saveAppState({
      itemDefaultsMigrationVersion: ITEM_DEFAULTS_MIGRATION_VERSION,
      imagePresentationMigrationVersion: IMAGE_PRESENTATION_MIGRATION_VERSION,
      layering,
      accessoriesEnabled,
      locked,
      excluded,
      outfit,
      outfitItemUuids,
      ignoredImportImages,
      savedOutfits,
      likedOutfitKeys,
      outfitAffinity,
      recentOutfits,
      generateCount,
      generationLists,
      generationMode,
      outfitFilters,
      weatherSettings,
      weatherData,
      fitpics,
      wardrobeFilters: normalizeWardrobeFilters(wardrobeFilters),
      wardrobeSort,
      windowState
    });
  }, [
    layering,
    accessoriesEnabled,
    locked,
    excluded,
    outfit,
    outfitItemUuids,
    ignoredImportImages,
    savedOutfits,
    likedOutfitKeys,
    outfitAffinity,
    recentOutfits,
    generateCount,
    generationLists,
    generationMode,
    outfitFilters,
    weatherSettings,
    weatherData,
    fitpics,
    wardrobeFilters,
    wardrobeSort,
    windowState,
    loading,
    hasHydratedAppState
  ]);

  useEffect(() => {
    if (loading || !items.length) {
      return;
    }

    setOutfit((current) => {
      const missingEquipped = Object.values(current).some(
        (itemId) => itemId && !itemsById[itemId]
      );

      if (!missingEquipped) {
        return current;
      }

      const sanitized = { ...current };

      Object.entries(sanitized).forEach(([slot, itemId]) => {
        if (itemId && !itemsById[itemId]) {
          sanitized[slot] = null;
        }
      });

      const nextOutfit = buildNextOutfit(generationSourceItems, sanitized, locked, layering, excluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits);
      setGuidedDebugPayload([]);
      return nextOutfit;
    });
  }, [generationSourceItems, items, itemsById, locked, layering, excluded, generationLists, generationMode, outfitFilters, weatherData, outfitAffinity, recentOutfits, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }

    setOutfitItemUuids((current) => {
      const next = syncOutfitItemUuids(outfit, current, itemsById);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
    setSavedOutfits((current) => {
      const next = current.map((savedOutfit) => syncSavedOutfitItemUuids(savedOutfit, itemsById));
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [itemsById, outfit, loading]);

  useEffect(() => {
    const validIds = items.map((item) => item.id);

    setSelectedWardrobeItemIds((current) => pruneSelectedIds(current, validIds));
    setWardrobeSelectionAnchorId((current) => (current && validIds.includes(current) ? current : null));
  }, [items]);

  useEffect(() => {
    if (!itemListOptions.includes(bulkListDraft)) {
      setBulkListDraft(itemListOptions[0] ?? defaultItemList);
    }
  }, [bulkListDraft, itemListOptions]);

  useEffect(() => {
    if (!selectedWardrobeItemIds.length && bulkMetadataEditorOpen) {
      setBulkMetadataEditorOpen(false);
      setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    }
  }, [bulkMetadataEditorOpen, selectedWardrobeItemIds.length]);

  useEffect(() => {
    if (!wardrobePreviewItemId || itemsById[wardrobePreviewItemId]) {
      return;
    }

    setWardrobePreviewItemId(null);
  }, [itemsById, wardrobePreviewItemId]);

  useEffect(() => {
    if (!selectedSavedOutfitId) {
      return;
    }

    if (activeOutfitsTab !== "saved" || !savedOutfits.some((savedOutfit) => savedOutfit.id === selectedSavedOutfitId)) {
      setSelectedSavedOutfitId(null);
    }
  }, [activeOutfitsTab, savedOutfits, selectedSavedOutfitId]);

  useEffect(() => {
    if (!activeOutfitSlot && !activeAccessorySlot && !selectedOutfitSlot && !selectedAccessorySlot) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (
        event.target instanceof Element &&
        (
          event.target.closest(".outfit-slot.is-active") ||
          event.target.closest(".accessory-slot.is-active")
        )
      ) {
        return;
      }

      if (workspaceTabsRef.current?.contains(event.target)) {
        return;
      }

      if (pickerOverlayRef.current?.contains(event.target)) {
        return;
      }

      if (activeOutfitSlot || activeAccessorySlot) {
        closePickerOverlay();
        return;
      }

      clearSelectedOutfitItem();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [activeAccessorySlot, activeOutfitSlot, selectedAccessorySlot, selectedOutfitSlot]);

  useEffect(() => {
    if (!outfitDebugOpen) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (workspaceTabsRef.current?.contains(event.target)) {
        return;
      }

      if (outfitDebugRef.current?.contains(event.target)) {
        return;
      }

      setOutfitDebugOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [outfitDebugOpen]);

  useEffect(() => {
    if (!generationListsOpen) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (workspaceTabsRef.current?.contains(event.target)) {
        return;
      }

      if (generationListsRef.current?.contains(event.target)) {
        return;
      }

      setGenerationListsOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [generationListsOpen]);

  useEffect(() => {
    document.addEventListener("pointerdown", noteInteractionModality, true);
    document.addEventListener("keydown", noteInteractionModality, true);
    return () => {
      document.removeEventListener("pointerdown", noteInteractionModality, true);
      document.removeEventListener("keydown", noteInteractionModality, true);
    };
  }, []);

  useEffect(() => {
    function handleDocumentKeyDown(event) {
      if (wardrobePreviewItemId) {
        const navigationDirection = getWardrobePreviewDirectionForKey(event);

        if (navigationDirection && !isEditableKeyboardTarget(event.target)) {
          const nextItemId = navigationDirection === "previous"
            ? wardrobePreviewNavigation.previousItemId
            : wardrobePreviewNavigation.nextItemId;

          if (nextItemId) {
            event.preventDefault();
            blurRetainedPointerFocus();
            setWardrobePreviewItemId(nextItemId);
            return;
          }
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      if (confirmation) {
        event.preventDefault();
        blurRetainedPointerFocus();
        confirmation.onCancel();
        return;
      }

      if (fitpicPreview) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setFitpicPreview(null);
        return;
      }

      if (wardrobePreviewItemId) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobePreviewItemId(null);
        return;
      }

      if (editingId || bulkMetadataEditorOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        cancelEdit({ clearSelection: true, blurActiveElement: true });
        return;
      }

      if (activeOutfitSlot || activeAccessorySlot) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closePickerOverlay();
        return;
      }

      if (selectedOutfitSlot || selectedAccessorySlot) {
        event.preventDefault();
        blurRetainedPointerFocus();
        clearSelectedOutfitItem();
        return;
      }

      if (wardrobeFiltersOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeFiltersOpen(false);
        return;
      }

      if (wardrobeManageOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setWardrobeManageOpen(false);
        return;
      }

      if (selectedWardrobeItemCount) {
        event.preventDefault();
        blurRetainedPointerFocus();
        clearWardrobeSelection();
        return;
      }

      if (generationListsOpen) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setGenerationListsOpen(false);
        return;
      }

      if (activePanel) {
        event.preventDefault();
        blurRetainedPointerFocus();
        closeWorkspacePanel();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [
    activeAccessorySlot,
    activeOutfitSlot,
    activePanel,
    confirmation,
    editingId,
    bulkMetadataEditorOpen,
    fitpicPreview,
    wardrobePreviewNavigation.nextItemId,
    wardrobePreviewNavigation.previousItemId,
    wardrobePreviewItemId,
    selectedWardrobeItemCount,
    wardrobeFiltersOpen,
    wardrobeManageOpen,
    generationListsOpen,
    selectedAccessorySlot,
    selectedOutfitSlot
  ]);

  function handleGenerate() {
    setActivePanel(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    clearSelectedOutfitItem();
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    setEditingId(null);
    setEditorReturnTarget(null);
    setOutfit((current) => {
      const result = buildNextOutfitWithDebug(generationSourceItems, current, locked, layering, excluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits);
      const nextOutfit = result.outfit;
      setGuidedDebugPayload(generationMode === "guided" ? result.guidedDebugPayload : []);
      if (generationMode === "guided") {
        setRecentOutfits((currentRecentOutfits) =>
          rememberRecentOutfit(currentRecentOutfits, nextOutfit, layering, { preserveLiked: true })
        );
      }
      return nextOutfit;
    });
    setGenerateCount((current) => current + 1);
  }

  function handleGeneratePointerUp(event) {
    generatePointerHandledAtRef.current = event.timeStamp;
    blurPointerActivatedControl(event);
    handleGenerate();
  }

  function handleGenerateClick(event) {
    if (Math.abs(event.timeStamp - generatePointerHandledAtRef.current) < 500) {
      return;
    }

    blurPointerActivatedControl(event);
    handleGenerate();
  }

  function handleReroll(slot) {
    if (locked[slot]) {
      return;
    }

    const pool = getSlotOptions(slot).filter((item) => item.id !== outfit[slot]);

    const nextItem = pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering);

    setOutfit((current) => ({
      ...current,
      [slot]: nextItem?.id ?? null
    }));
  }

  function getSlotOptions(slot) {
    return getEligibleSlotPool(generationSourceItems, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById);
  }

  function getSlotPickerOptions(slot) {
    let pool = getPool(generationSourceItems, slot, {}, generationLists, layering);

    if (layering && (slot === "TopInner" || slot === "TopOuter")) {
      const otherTopSlot = getOtherTopSlot(slot);
      const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

      if (otherItem?.layerType === "Both") {
        pool = pool.filter((item) => item.layerType !== "Both");
      }

      pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
    }

    return pool;
  }

  function getAccessoryOptions(slot) {
    return items.filter(
      (item) =>
        item.garmentType === "Accessory" &&
        item.accessorySlot === slot &&
        isEligibleForGeneration(item, excluded, generationLists)
    );
  }

  function setOutfitSlot(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
  }

  function removeOutfitSlot(slot) {
    setOutfitSlot(slot, null);
  }

  function cycleOutfitSlot(slot, direction) {
    const options = getSlotOptions(slot);

    if (!options.length) {
      setOutfitSlot(slot, null);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfitSlot(slot, options[nextIndex].id);
  }

  function cycleAccessorySlot(slot, direction) {
    const options = getAccessoryOptions(slot);

    if (!options.length) {
      removeAccessoryFromSlot(slot);
      return;
    }

    const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
    const fallbackIndex = direction > 0 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex + direction + options.length) % options.length;

    setOutfit((current) => ({
      ...current,
      [slot]: options[nextIndex].id
    }));
  }

  function toggleLayering() {
    setLayering((current) => {
      const nextValue = !current;

      setOutfit((previous) => transitionLayering(previous, current, nextValue));

      return nextValue;
    });
  }

  function transitionLayering(previous, currentLayering, nextLayering) {
    const nextOutfit = { ...previous };

    if (!currentLayering && nextLayering) {
      const visibleTop = itemsById[nextOutfit.TopInner];

      if (visibleTop?.layerType === "Outer") {
        nextOutfit.TopOuter = nextOutfit.TopOuter || nextOutfit.TopInner;
        nextOutfit.TopInner = null;
      }

      if (nextOutfit.TopInner && nextOutfit.TopOuter === nextOutfit.TopInner) {
        nextOutfit.TopOuter = null;
      }

      if (!nextOutfit.TopInner) {
        nextOutfit.TopInner = pickRandom(getSlotOptionsForOutfit("TopInner", nextOutfit))?.id ?? null;
      }

      if (!nextOutfit.TopOuter) {
        nextOutfit.TopOuter = pickRandom(getSlotOptionsForOutfit("TopOuter", nextOutfit))?.id ?? null;
      }

      return nextOutfit;
    }

    if (currentLayering && !nextLayering && !nextOutfit.TopInner && nextOutfit.TopOuter) {
      nextOutfit.TopInner = nextOutfit.TopOuter;
    }

    return nextOutfit;
  }

  function applyLoadedData(nextItems, hydratedAppState) {
    setItems(nextItems);
    setLayering(hydratedAppState.layering);
    setAccessoriesEnabled(hydratedAppState.accessoriesEnabled);
    setLocked(hydratedAppState.locked);
    setExcluded(hydratedAppState.excluded);
    setOutfit(hydratedAppState.outfit);
    setOutfitItemUuids(hydratedAppState.outfitItemUuids);
    setGuidedDebugPayload(hydratedAppState.guidedDebugPayload);
    setIgnoredImportImages(hydratedAppState.ignoredImportImages);
    setSavedOutfits(hydratedAppState.savedOutfits);
    setLikedOutfitKeys(hydratedAppState.likedOutfitKeys);
    setOutfitAffinity(hydratedAppState.outfitAffinity);
    setRecentOutfits(hydratedAppState.recentOutfits);
    setGenerateCount(hydratedAppState.generateCount);
    setGenerationLists(hydratedAppState.generationLists);
    setGenerationMode(hydratedAppState.generationMode);
    setOutfitFilters(hydratedAppState.outfitFilters);
    setWeatherSettings(hydratedAppState.weatherSettings);
    setWeatherLocationDraft(hydratedAppState.weatherLocationDraft);
    setWeatherData(hydratedAppState.weatherData);
    setFitpics(hydratedAppState.fitpics);
    setWardrobeFilters(hydratedAppState.wardrobeFilters);
    setWardrobeSort(hydratedAppState.wardrobeSort);
    setWindowState(hydratedAppState.windowState);
    setEditingId(null);
    setEditorReturnTarget(null);
    setDraft(emptyForm);
    setActivePanel(null);
    setControlsOpen(true);
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    clearSelectedOutfitItem();
    setPickerAnchorSlot(null);
    setFitpicPreview(null);
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
  }

  async function handleExportBackup() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${APP_ID}-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportLibraryCsv() {
    const csv = await exportLibraryCsv();
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8"
    });
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `outfit-library-export-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportBackup(event) {
    const [file] = event.target.files;
    event.target.value = "";

    if (!file) {
      return;
    }

    let backup;

    try {
      backup = JSON.parse(await readFileAsText(file));
    } catch {
      window.alert("This backup file could not be read.");
      return;
    }

    if (!validateBackup(backup)) {
      window.alert("This is not a valid outfit app backup.");
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Import backup?",
      message: "This will replace all wardrobe data in this browser.",
      confirmLabel: "Import"
    });

    if (!confirmed) {
      return;
    }

    const preparedBackup = await prepareBackupImport(backup, {
      normalizeStoredItem,
      createFallbackItemTimestamp,
      restoreLegacyBakedImageScale,
      bakeItemImagePresentation,
      applyMappedStyleWeightDefaults,
      normalizeHydratedAppState,
      buildNextOutfit,
      normalizeOutfitAffinity,
      normalizeRecentOutfits,
      normalizeWeatherSettings,
      defaultGenerationLists,
      emptyOutfitFilters,
      defaultGenerationMode,
      migrationVersions: {
        itemDefaults: ITEM_DEFAULTS_MIGRATION_VERSION,
        imagePresentation: IMAGE_PRESENTATION_MIGRATION_VERSION
      }
    });

    await replaceWithBackup(preparedBackup.backup);
    applyLoadedData(preparedBackup.items, preparedBackup.appState);
    window.alert("Backup imported.");
  }

  async function handleExportOutfitImage() {
    const stage = outfitStageRef.current;

    if (!stage) {
      return;
    }

    const frameEntries = [...stage.querySelectorAll(".outfit-slot .managed-image, .accessory-slot.has-item .managed-image")]
      .map((element) => {
        const itemId = element.dataset.itemId;
        const item = itemId ? itemsById[itemId] : null;

        return item ? { element, item } : null;
      })
      .filter(Boolean);

    if (!frameEntries.length) {
      window.alert("There is no outfit image to export.");
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const imageRects = frameEntries.map(({ element }) => element.getBoundingClientRect());
    const margin = 24;
    const cropLeft = Math.max(Math.min(...imageRects.map((rect) => rect.left)) - margin, stageRect.left);
    const cropTop = Math.max(Math.min(...imageRects.map((rect) => rect.top)) - margin, stageRect.top);
    const cropRight = Math.min(Math.max(...imageRects.map((rect) => rect.right)) + margin, stageRect.right);
    const cropBottom = Math.min(Math.max(...imageRects.map((rect) => rect.bottom)) + margin, stageRect.bottom);
    const cropWidth = Math.max(cropRight - cropLeft, 1);
    const cropHeight = Math.max(cropBottom - cropTop, 1);
    const scale = 2;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.round(cropWidth * scale);
    canvas.height = Math.round(cropHeight * scale);
    context.scale(scale, scale);
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#f7f7f7";
    context.fillRect(0, 0, cropWidth, cropHeight);

    try {
      const loadedEntries = await Promise.all(
        frameEntries.map(async ({ element, item }) => ({
          element,
          item,
          image: await loadImage(resolveImageUrl(item.imageUrl))
        }))
      );

      loadedEntries.forEach(({ element, item, image }) => {
        const imageRect = element.getBoundingClientRect();
        drawManagedImageToCanvas(
          context,
          item,
          image,
          imageRect.left - cropLeft,
          imageRect.top - cropTop,
          imageRect.width,
          imageRect.height,
          { useFrameScale: true, useCrop: true, usePresentation: true }
        );
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `outfit-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The outfit image could not be exported.");
    }
  }

  function truncateCanvasText(context, text, maxWidth) {
    const normalizedText = String(text || "").trim();

    if (!normalizedText || context.measureText(normalizedText).width <= maxWidth) {
      return normalizedText;
    }

    const ellipsis = "...";
    let truncatedText = normalizedText;

    while (truncatedText.length > 0) {
      truncatedText = truncatedText.slice(0, -1).trimEnd();

      if (context.measureText(`${truncatedText}${ellipsis}`).width <= maxWidth) {
        return `${truncatedText}${ellipsis}`;
      }
    }

    return ellipsis;
  }

  function openWardrobeExportDialog() {
    setWardrobeExportOptions(createWardrobeSpreadExportOptions("compact"));
  }

  async function handleExportWardrobeImage(options = createWardrobeSpreadExportOptions("compact")) {
    const normalizedOptions = normalizeWardrobeSpreadExportOptions(options);
    const exportItems = getWardrobeSpreadExportOrderedItems(visibleWardrobeItems, normalizedOptions);

    if (!exportItems.length) {
      window.alert("There are no filtered wardrobe pieces to export.");
      return;
    }

    const labelRowCount = getWardrobeSpreadExportLabelRowCount(normalizedOptions);
    const {
      cellHeight,
      cellSize,
      columns,
      padding,
      canvasWidth,
      canvasHeight,
      exportScale,
      pixelWidth,
      pixelHeight
    } = getWardrobeSpreadExportRenderConfig(exportItems.length, { labelRowCount });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      window.alert("The wardrobe image could not be exported.");
      return;
    }

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    context.scale(exportScale, exportScale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const documentStyles = getComputedStyle(document.documentElement);
    const exportBackgroundColor = documentStyles.getPropertyValue("--bg").trim() || "#f7f7f7";
    const exportTextColor = documentStyles.getPropertyValue("--text").trim() || "#111";
    const exportMutedTextColor = documentStyles.getPropertyValue("--muted-strong").trim() || "rgba(17, 17, 17, 0.75)";
    const exportFontFamily = documentStyles.getPropertyValue("font-family").trim() || "monospace";
    context.fillStyle = exportBackgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    try {
      const loadedItems = await Promise.all(
        exportItems.map(async (item) => {
          const exportImageUrl = resolveImageUrl(getWardrobeSpreadExportImageUrl(item));

          if (!exportImageUrl) {
            throw new Error("Missing export image.");
          }

          return {
            item,
            image: await loadImage(exportImageUrl)
          };
        })
      );

      loadedItems.forEach(({ item, image }, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellLeft = padding + column * cellSize;
        const cellTop = padding + row * cellHeight;
        const maxImageSize = cellSize * 0.78;
        const sourceRect = getManagedImageSourceRect(item, image.naturalWidth, image.naturalHeight);
        const baseScale = Math.min(maxImageSize / sourceRect.width, maxImageSize / sourceRect.height, 1);
        const frameWidth = sourceRect.width * baseScale;
        const frameHeight = sourceRect.height * baseScale;
        const jitterX = normalizedOptions.shuffleItems ? (Math.random() - 0.5) * cellSize * 0.22 : 0;
        const jitterY = normalizedOptions.shuffleItems ? (Math.random() - 0.5) * cellSize * 0.22 : 0;
        const frameX = cellLeft + (cellSize - frameWidth) / 2 + jitterX;
        const frameY = cellTop + (cellSize - frameHeight) / 2 + jitterY;
        const labelRows = getWardrobeSpreadExportLabelRows(item, normalizedOptions);

        drawManagedImageToCanvas(context, item, image, frameX, frameY, frameWidth, frameHeight);

        if (!labelRows.length) {
          return;
        }

        context.textAlign = "center";
        context.textBaseline = "top";
        context.font = `500 ${WARDROBE_SPREAD_LABEL_FONT_SIZE}px ${exportFontFamily}`;

        labelRows.forEach(({ key, text }, labelIndex) => {
          if (!text) {
            return;
          }

          const textY = cellTop
            + cellSize
            + WARDROBE_SPREAD_LABEL_TOP_GAP
            + labelIndex * (WARDROBE_SPREAD_LABEL_LINE_HEIGHT + WARDROBE_SPREAD_LABEL_GAP);
          const textWidth = cellSize - WARDROBE_SPREAD_LABEL_SIDE_PADDING * 2;
          const displayText = truncateCanvasText(context, text, textWidth);

          context.fillStyle = key === "name" ? exportTextColor : exportMutedTextColor;
          context.fillText(displayText, cellLeft + cellSize / 2, textY, textWidth);
        });
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `wardrobe-wishlist-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      window.alert("The wardrobe image could not be exported.");
    }
  }

  async function handleConfirmWardrobeExport() {
    const nextOptions = wardrobeExportOptions ? { ...wardrobeExportOptions } : createWardrobeSpreadExportOptions("compact");
    setWardrobeExportOptions(null);
    await handleExportWardrobeImage(nextOptions);
  }

  async function handleResetToDefault() {
    const confirmed = await requestConfirmation({
      title: "Reset to default?",
      message:
        "This will replace all local wardrobe data, saved outfits, fitpics, settings, and imported backup data for this site.",
      confirmLabel: "Reset"
    });

    if (!confirmed) {
      return;
    }

    const defaultData = await resetToDefaults();
    await applyLoadedData(defaultData.items, defaultData.appState);
    window.alert("Default data restored.");
  }

  function getSlotOptionsForOutfit(slot, nextOutfit) {
    return getEligibleSlotPool(generationSourceItems, slot, excluded, generationLists, true, outfitFilters, weatherData, nextOutfit, itemsById)
      .filter((item) => item.id !== nextOutfit[getOtherTopSlot(slot)]);
  }

  function toggleAccessories() {
    setAccessoriesEnabled((current) => {
      const nextValue = !current;

      if (!nextValue) {
        setOutfit((previous) => {
          const nextOutfit = { ...previous };
          accessorySlots.forEach((slot) => {
            nextOutfit[slot] = null;
          });
          return nextOutfit;
        });
        setLocked((previous) => {
          const nextLocked = { ...previous };
          accessorySlots.forEach((slot) => {
            delete nextLocked[slot];
          });
          return nextLocked;
        });
        setActiveAccessorySlot(null);
      }

      return nextValue;
    });
  }

  function toggleLock(slot) {
    setLocked((current) => ({
      ...current,
      [slot]: !current[slot]
    }));
  }

  function unlockAllOutfitSlots() {
    setLocked((current) => {
      if (!visibleSlots.some((slot) => current[slot])) {
        return current;
      }

      const nextLocked = { ...current };
      visibleSlots.forEach((slot) => {
        nextLocked[slot] = false;
      });
      return nextLocked;
    });
  }

  function equipItem(item) {
    let slot = resolveSlotForItem(item);
    if (!slot) {
      return;
    }

    if (!layering && item.garmentType === "Top") {
      slot = "TopInner";
    }

    if (outfit[slot] === item.id) {
      setOutfit((current) => ({
        ...current,
        [slot]: null
      }));
      return;
    }

    setOutfit((current) => {
      const nextOutfit = {
        ...current,
        [slot]: item.id
      };

      if (slot === "TopInner" || slot === "TopOuter") {
        const otherTopSlot = getOtherTopSlot(slot);
        const otherItem = otherTopSlot ? itemsById[current[otherTopSlot]] : null;

        if (otherItem && isNonStackableTopType(item) && normalizeType(otherItem.type) === normalizeType(item.type)) {
          nextOutfit[otherTopSlot] = null;
        }
      }

      return nextOutfit;
    });
  }

  function handleWardrobePreviewClick(item, event) {
    registerPointerActivatedControl(event);
    const shiftKey = event.shiftKey;
    const toggleKey = event.metaKey || event.ctrlKey;
    const pendingSelection = wardrobePendingSelectionRef.current;

    if (pendingSelection && pendingSelection.item.id !== item.id) {
      flushPendingWardrobeSelection();
    }

    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
    }

    wardrobePendingSelectionRef.current = {
      item,
      shiftKey,
      toggleKey
    };

    wardrobeSelectClickTimeoutRef.current = window.setTimeout(() => {
      flushPendingWardrobeSelection();
    }, WARDROBE_PREVIEW_DOUBLE_CLICK_MS);

    blurPointerActivatedControl(event);
  }

  function handleWardrobeSelection(item, shiftKey, toggleKey) {
    const nextSelectionState = getNextSelectionState({
      selectedIds: selectedWardrobeItemIds,
      orderedIds: visibleWardrobeItemIds,
      clickedId: item.id,
      anchorId: wardrobeSelectionAnchorId,
      shiftKey,
      toggleKey
    });

    setSelectedWardrobeItemIds(nextSelectionState.selectedIds);
    setWardrobeSelectionAnchorId(nextSelectionState.anchorId);
  }

  function flushPendingWardrobeSelection() {
    const pendingSelection = wardrobePendingSelectionRef.current;

    if (!pendingSelection) {
      return;
    }

    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }

    wardrobePendingSelectionRef.current = null;
    handleWardrobeSelection(pendingSelection.item, pendingSelection.shiftKey, pendingSelection.toggleKey);
  }

  function openWardrobePreview(itemId) {
    closeUtilityWindows();
    setFitpicPreview(null);
    setWardrobePreviewItemId(itemId);
  }

  function closeWardrobePreview() {
    setWardrobePreviewItemId(null);
  }

  function showPreviousWardrobePreviewItem() {
    if (wardrobePreviewNavigation.previousItemId) {
      setWardrobePreviewItemId(wardrobePreviewNavigation.previousItemId);
    }
  }

  function showNextWardrobePreviewItem() {
    if (wardrobePreviewNavigation.nextItemId) {
      setWardrobePreviewItemId(wardrobePreviewNavigation.nextItemId);
    }
  }

  function handleWardrobePreviewDoubleClick(item, event) {
    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }
    wardrobePendingSelectionRef.current = null;

    event.currentTarget.blur();
    openWardrobePreview(item.id);
  }

  function handleWardrobePreviewKeyDown(item, event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }

    wardrobePendingSelectionRef.current = null;
    openWardrobePreview(item.id);
  }

  function editWardrobePreviewItem() {
    if (!wardrobePreviewItem) {
      return;
    }

    const previewedItem = wardrobePreviewItem;
    closeWardrobePreview();
    startEdit(previewedItem, {
      returnTarget: activePanel === "wardrobe" ? "wardrobe" : "outfit"
    });
  }

  async function deleteWardrobePreviewItem() {
    if (!wardrobePreviewItem) {
      return;
    }

    const deleted = await handleDelete(wardrobePreviewItem.id);

    if (deleted) {
      closeWardrobePreview();
    }
  }

  function equipWardrobePreviewItem() {
    if (!wardrobePreviewItem) {
      return;
    }

    equipItem(wardrobePreviewItem);
  }

  function toggleWardrobePreviewExcluded() {
    if (!wardrobePreviewItem) {
      return;
    }

    toggleExcluded(wardrobePreviewItem.id);
  }

  async function toggleWardrobePreviewFavorite() {
    if (!wardrobePreviewItem) {
      return;
    }

    const timestamp = new Date().toISOString();
    const nextItem = {
      ...wardrobePreviewItem,
      favorite: !wardrobePreviewItem.favorite,
      updatedAt: timestamp
    };

    await saveItem(nextItem);
    setItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)));

    if (editingId === nextItem.id) {
      setDraft(nextItem);
    }
  }

  function handleOutfitItemPreviewClick(item, selectItem, openPicker, event) {
    if (event) {
      registerPointerActivatedControl(event);
    }

    if (!item) {
      clearSelectedOutfitItem();
      openPicker();
      if (event) {
        blurPointerActivatedControl(event);
      }
      return;
    }

    if (!isMobileViewport) {
      if (event?.detail <= 1) {
        selectItem();
      }

      if (event) {
        blurPointerActivatedControl(event);
      }
      return;
    }

    if (outfitItemPreviewClickTimeoutRef.current !== null) {
      window.clearTimeout(outfitItemPreviewClickTimeoutRef.current);
    }

    pendingOutfitItemPreviewRef.current = {
      itemId: item.id,
      openPicker
    };

    outfitItemPreviewClickTimeoutRef.current = window.setTimeout(() => {
      const pendingPreview = pendingOutfitItemPreviewRef.current;
      outfitItemPreviewClickTimeoutRef.current = null;
      pendingOutfitItemPreviewRef.current = null;

      pendingPreview?.openPicker?.();
    }, WARDROBE_PREVIEW_DOUBLE_CLICK_MS);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function handleOutfitItemPreviewDoubleClick(item, event) {
    if (!item) {
      return;
    }

    if (outfitItemPreviewClickTimeoutRef.current !== null) {
      window.clearTimeout(outfitItemPreviewClickTimeoutRef.current);
      outfitItemPreviewClickTimeoutRef.current = null;
    }

    pendingOutfitItemPreviewRef.current = null;
    clearSelectedOutfitItem();
    event.currentTarget.blur();
    openWardrobePreview(item.id);
  }

  function selectOutfitItem(slot) {
    setSelectedOutfitSlot(slot);
    setSelectedAccessorySlot(null);
  }

  function selectAccessoryItem(slot) {
    setSelectedAccessorySlot(slot);
    setSelectedOutfitSlot(null);
  }

  function clearSelectedOutfitItem() {
    setSelectedOutfitSlot(null);
    setSelectedAccessorySlot(null);
  }

  function resolveSlotForItem(item) {
    if (item.garmentType === "Headwear") {
      return "Headwear";
    }

    if (item.garmentType === "Bottom") {
      return "Bottom";
    }

    if (item.garmentType === "Footwear") {
      return "Footwear";
    }

    if (item.garmentType === "Accessory") {
      return item.accessorySlot || null;
    }

    if (item.garmentType === "Outerwear") {
      return "TopOuter";
    }

    if (item.garmentType !== "Top") {
      return null;
    }

    if (item.layerType === "Outer") {
      return "TopOuter";
    }

    return "TopInner";
  }

  function startCreate(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    if (editingId === "new" && editorReturnTarget === "wardrobe") {
      cancelEdit();
      return;
    }

    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImageDragActive(false);
    setBulkMetadataEditorOpen(false);
    setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    setEditorReturnTarget("wardrobe");
    setEditorAdvancedOpen(false);
    setEditorStylingOpen(false);
    setEditingId("new");
    setDraft(emptyForm);
    setDraftCollectionInput("");
  }

  function startEdit(item, options = {}) {
    const normalizedItem = normalizeStoredItem(item);
    const requestedReturnTarget = options.returnTarget ?? "wardrobe";

    if (editingId === item.id && editorReturnTarget === requestedReturnTarget) {
      cancelEdit();
      return;
    }

    const shouldOpenAdvanced = getAdvancedOverrideFields(
      normalizedItem,
      resolveTypeDefaults(normalizedItem.type)
    ).some((field) => advancedEditorFields.includes(field));

    closeUtilityWindows();
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
    setImageUploadError("");
    setImageProcessing(false);
    setItemImageDragActive(false);
    setBulkMetadataEditorOpen(false);
    setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    setEditorReturnTarget(requestedReturnTarget);
    setEditorAdvancedOpen(shouldOpenAdvanced);
    setEditorStylingOpen(false);
    setEditingId(item.id);
    setDraft(normalizedItem);
    setDraftCollectionInput("");
  }

  function cancelEdit(options = {}) {
    const { clearSelection = false, blurActiveElement = false } = options;

    if (blurActiveElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setBulkMetadataEditorOpen(false);
    setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    setEditingId(null);
    setEditorReturnTarget(null);
    setEditorAdvancedOpen(false);
    setEditorStylingOpen(false);
    setDraft(emptyForm);
    setDraftCollectionInput("");
    setImageUploadError("");
    setImageProcessing(false);
    setItemImageDragActive(false);

    if (clearSelection) {
      clearWardrobeSelection();
    }
  }

  function startFloatingEdit(item) {
    startEdit(item, { returnTarget: "outfit" });
    closePickerOverlay();
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
  }

  function toggleExcluded(itemId, options = {}) {
    const { rerollOnEquippedExclude = true } = options;

    setExcluded((current) => {
      const nextValue = !current[itemId];
      const nextExcluded = {
        ...current,
        [itemId]: nextValue
      };

      if (!nextValue || !rerollOnEquippedExclude) {
        return nextExcluded;
      }

      setOutfit((previous) => {
        const sanitized = Object.fromEntries(
          Object.entries(previous).map(([slot, equippedId]) => [
            slot,
            equippedId === itemId ? null : equippedId
          ])
        );

        return buildNextOutfit(generationSourceItems, sanitized, locked, layering, nextExcluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits);
      });

      return nextExcluded;
    });
  }

  function clearExcluded() {
    setExcluded({});
  }

  function clearWardrobeFilters() {
    setWardrobeFilters(emptyWardrobeFilters);
    setWardrobeFilterSearch("");
  }

  function clearDashboardFilters() {
    setDashboardFilters(emptyWardrobeFilters);
    setDashboardFilterSearch("");
  }

  function toggleWardrobeFilterSection(key) {
    setWardrobeFilterSectionsOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function toggleDashboardFilterSection(key) {
    setDashboardFilterSectionsOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function toggleWardrobeFilterValue(key, value) {
    setWardrobeFilters((current) => toggleMultiFilterValueState(current, key, value));
  }

  function toggleWardrobeFilterValueWithMode(key, value, shouldExclude = false) {
    setWardrobeFilters((current) => toggleMultiFilterValueState(current, key, value, shouldExclude));
  }

  function toggleDashboardFilterValue(key, value) {
    setDashboardFilters((current) => toggleMultiFilterValueState(current, key, value));
  }

  function toggleDashboardFilterValueWithMode(key, value, shouldExclude = false) {
    setDashboardFilters((current) => toggleMultiFilterValueState(current, key, value, shouldExclude));
  }

  function setWardrobeToggleFilter(key, value) {
    setWardrobeFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function setDashboardToggleFilter(key, value) {
    setDashboardFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function toggleOutfitFilter(group, value, shouldExclude = false) {
    setOutfitFilters((current) => toggleMultiFilterValueState(current, group, value, shouldExclude));
  }

  function clearOutfitFilters() {
    setOutfitFilters(emptyOutfitFilters);
  }

  async function refreshWeather(locationOverride = weatherLocationDraft) {
    const query = locationOverride.trim();

    if (!query) {
      setWeatherError("Enter a city first.");
      return;
    }

    try {
      setWeatherLoading(true);
      setWeatherError("");
      const currentWeatherSettings = normalizeWeatherSettings(weatherSettings);
      const shouldUseSavedLocation =
        currentWeatherSettings.locationName &&
        query === currentWeatherSettings.locationName &&
        Number.isFinite(currentWeatherSettings.latitude) &&
        Number.isFinite(currentWeatherSettings.longitude);
      const nextWeather = shouldUseSavedLocation
        ? await fetchWeatherForSavedLocation(currentWeatherSettings)
        : await fetchWeatherForLocation(query);
      setWeatherSettings(nextWeather.settings);
      setWeatherLocationDraft(nextWeather.settings.locationName);
      setWeatherData(nextWeather.weather);
    } catch (error) {
      setWeatherError(error?.message || "Weather could not be loaded.");
    } finally {
      setWeatherLoading(false);
    }
  }

  function applyWeatherFilters() {
    if (!weatherData?.suggestedFilters?.length) {
      return;
    }

    closeUtilityWindows();
    setOutfitFilters((current) => ({
      ...current,
      climate: weatherData.suggestedFilters
    }));
    setControlsOpen(true);
  }

  function toggleDraftTag(field, value, options) {
    setDraft((current) => {
      const selectedValues = normalizeTagList(current[field], options);
      const isSelected = selectedValues.includes(value);

      return {
        ...current,
        [field]: isSelected
          ? selectedValues.filter((selectedValue) => selectedValue !== value)
          : [...selectedValues, value]
      };
    });
  }

  function toggleGenerationList(list) {
    setGenerationLists((current) => {
      const currentValue = getGenerationListState(list, current);

      return {
        ...current,
        [list]: !currentValue
      };
    });
  }

  function toggleGenerationListWithMode(list, shouldExclude = false) {
    setGenerationLists((current) => {
      const nextState = getNextGenerationListState(getGenerationListState(list, current), shouldExclude);

      return {
        ...current,
        [list]: nextState
      };
    });
  }

  function getNextGenerationListState(currentValue, shouldExclude = false) {
    if (shouldExclude) {
      return currentValue === "exclude" ? false : "exclude";
    }

    return currentValue === true ? false : true;
  }

  function getGenerationListState(list, listState = generationLists) {
    if (Object.hasOwn(listState, list)) {
      return listState[list];
    }

    if (!itemLists.includes(list)) {
      return listState[defaultItemList];
    }

    return list === defaultItemList;
  }

  function isGenerationListEnabled(list) {
    return getGenerationListState(list) === true;
  }

  function isGenerationListExcluded(list) {
    return getGenerationListState(list) === "exclude";
  }

  function setAdvancedField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function addDraftCollection(nextCollection = draftCollectionInput) {
    const normalizedCollection = typeof nextCollection === "string" ? nextCollection.trim() : "";

    if (!normalizedCollection) {
      return;
    }

    setDraft((current) => ({
      ...current,
      collections: addCollectionToList(current.collections, normalizedCollection)
    }));
    setDraftCollectionInput("");
  }

  function removeDraftCollection(collectionToRemove) {
    setDraft((current) => ({
      ...current,
      collections: removeCollectionFromList(current.collections, collectionToRemove)
    }));
  }

  function resetAdvancedField(field) {
    const nextValue = Array.isArray(resolvedTypeDefaults[field])
      ? [...resolvedTypeDefaults[field]]
      : resolvedTypeDefaults[field];

    setDraft((current) => {
      const nextDraft = {
        ...current,
        [field]: nextValue
      };

      if (["garmentType", "layerType", "accessorySlot", "size"].includes(field)) {
        return applyGarmentRules(nextDraft, resolvedTypeDefaults);
      }

      return nextDraft;
    });
  }

  function renderAdvancedLabel(label, field) {
    return (
      <span className="editor-label-row">
        <span>{label}</span>
        {advancedOverrideSet.has(field) ? (
          <span className="editor-label-actions">
            <span className="field-status-text">Custom</span>
            <button
              type="button"
              className="editor-inline-reset"
              onClick={() => resetAdvancedField(field)}
            >
              Reset
            </button>
          </span>
        ) : null}
      </span>
    );
  }

  async function submitItem(event) {
    event.preventDefault();
    await persistDraftItem();
  }

  async function persistDraftItem({ duplicate = false } = {}) {
    const trimmedName = draft.name.trim();
    const trimmedDescription = draft.description.trim();
    const trimmedImageUrl = draft.imageUrl.trim();
    const trimmedBrand = draft.brand.trim();
    const trimmedType = draft.type.trim();
    const trimmedColor = normalizeItemColor(draft.color);
    const trimmedSize = draft.size.trim();
    const normalizedWeight = normalizeWeight(draft.weight);
    const normalizedValue = String(draft.value ?? "").replace(/[^\d]/g, "");
    const normalizedRetailValue = String(draft.retailValue ?? "").replace(/[^\d]/g, "");
    const normalizedImageFrameScale = normalizeImageFrameScale(draft.imageFrameScale);
    const normalizedImageScale = normalizeImageScale(draft.imageScale);
    const normalizedImageOffsetX = normalizeImageOffset(draft.imageOffsetX);
    const normalizedImageOffsetY = normalizeImageOffset(draft.imageOffsetY);
    const normalizedImageCrop = getNormalizedImageCrop(draft);
    const normalizedQuantity = normalizeQuantity(draft.quantity);

    if (!trimmedImageUrl) {
      setEditorAdvancedOpen(true);
      setImageUploadError("Choose an image or enter an image URL before saving.");
      return;
    }

    setImageUploadError("");

    if (
      !duplicate &&
      editingId === "new" &&
      !trimmedName &&
      !trimmedBrand &&
      !trimmedType &&
      !trimmedColor &&
      !normalizedValue &&
      !normalizedRetailValue &&
      !trimmedSize
    ) {
      return;
    }

    const normalizedDraft = await bakeItemImagePresentation({
      ...draft,
      name: trimmedName,
      imageUrl: trimmedImageUrl,
      imageFrameScale: normalizedImageFrameScale,
      imageScale: normalizedImageScale,
      imageOffsetX: normalizedImageOffsetX,
      imageOffsetY: normalizedImageOffsetY,
      imageCropX: normalizedImageCrop.x,
      imageCropY: normalizedImageCrop.y,
      imageCropWidth: normalizedImageCrop.width,
      imageCropHeight: normalizedImageCrop.height,
      brand: trimmedBrand,
      description: trimmedDescription,
      type: normalizeItemType(trimmedType),
      color: trimmedColor,
      weight: normalizedWeight,
      favorite: Boolean(draft.favorite),
      value: normalizedValue,
      retailValue: normalizedRetailValue,
      size: trimmedSize,
      status: normalizeStatus(draft.status),
      list: normalizeStatus(draft.status),
      collections: normalizeCollections(draft.collections),
      quantity: normalizedQuantity,
      styleTags: normalizeTagList(draft.styleTags, styleTagOptions),
      climateTags: normalizeTagList(draft.climateTags, editableClimateTagOptions)
    });

    const timestamp = new Date().toISOString();
    const nextItem = {
      ...normalizedDraft,
      itemUuid: normalizeItemUuid(draft.itemUuid, createItemUuid),
      importedAt: normalizeTimestamp(draft.importedAt) || normalizeTimestamp(draft.createdAt) || timestamp,
      createdAt:
        duplicate || editingId === "new"
          ? timestamp
          : normalizeTimestamp(draft.createdAt) || timestamp,
      updatedAt: timestamp,
      id:
        duplicate || editingId === "new"
          ? createUniqueItemId(
              {
                ...normalizedDraft
              },
              items
            )
          : createUniqueItemId(
              {
                ...normalizedDraft
              },
              items,
              draft.id
            ),
      name: trimmedName
    };
    await saveItem(nextItem);

    if (!duplicate && editingId !== "new" && draft.id !== nextItem.id) {
      await deleteItem(draft.id, { skipSyncMetadata: true });
    }

    setItems((current) => {
      const existingIndex = current.findIndex((item) =>
        item.id === (duplicate || editingId === "new" ? nextItem.id : draft.id)
      );

      if (existingIndex === -1) {
        return [...current, nextItem];
      }

      const clone = [...current];
      clone[existingIndex] = nextItem;
      return clone;
    });

    if (!duplicate && editingId !== "new" && draft.id !== nextItem.id) {
      const nextCurrentOutfit = replaceItemIdInOutfit(outfit, draft.id, nextItem.id);
      setOutfit(nextCurrentOutfit);
      setOutfitItemUuids((current) =>
        syncOutfitItemUuids(nextCurrentOutfit, current, {
          ...itemsById,
          [nextItem.id]: nextItem
        })
      );
      setSavedOutfits((current) =>
        current.map((savedOutfit) => ({
          ...savedOutfit,
          outfit: replaceItemIdInOutfit(savedOutfit.outfit, draft.id, nextItem.id),
          outfitItemUuids: syncOutfitItemUuids(
            replaceItemIdInOutfit(savedOutfit.outfit, draft.id, nextItem.id),
            savedOutfit.outfitItemUuids,
            {
              ...itemsById,
              [nextItem.id]: nextItem
            }
          )
        }))
      );
    }

    if (duplicate) {
      setEditingId(nextItem.id);
      setDraft(nextItem);
      return nextItem;
    }

    const shouldReturnToWardrobe = editorReturnTarget === "wardrobe" && activePanel !== "wardrobe";
    cancelEdit();

    if (shouldReturnToWardrobe) {
      setActivePanel("wardrobe");
      setControlsOpen(false);
    }

    return nextItem;
  }

  async function duplicateDraftItem() {
    if (editingId === "new") {
      return;
    }

    await persistDraftItem({ duplicate: true });
  }

  async function ingestItemImageFile(file, options = {}) {
    if (!file) {
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    try {
      setImageUploadError("");
      const importMetadata = await readImageFileMetadata(file, {
        readFileAsDataUrl,
        loadImage
      });
      const imageUrl = await compressImageSource(file);
      setDraft((current) => ({
        ...current,
        ...importMetadata,
        importedAt: normalizeTimestamp(current.importedAt) || importMetadata.importedAt,
        imageUrl,
        imageFrameScale: 100,
        imageScale: 100,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageCropX: 0,
        imageCropY: 0,
        imageCropWidth: 100,
        imageCropHeight: 100
      }));
      if (options.ignoredExtraFiles) {
        setImageUploadError("Using the first image only. Additional files were ignored.");
      }
    } catch (error) {
      setImageUploadError(error?.message || "This image could not be processed.");
    }
  }

  async function handleItemImageUpload(event) {
    const [file] = event.target.files;

    if (!file) {
      return;
    }

    try {
      await ingestItemImageFile(file);
    } finally {
      event.target.value = "";
    }
  }

  function handleItemImageDragEnter(event) {
    event.preventDefault();
    if (imageProcessing) {
      return;
    }
    setItemImageDragActive(true);
  }

  function handleItemImageDragOver(event) {
    event.preventDefault();
    if (imageProcessing) {
      return;
    }
    setItemImageDragActive(true);
  }

  function handleItemImageDragLeave(event) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setItemImageDragActive(false);
  }

  async function handleItemImageDrop(event) {
    event.preventDefault();
    setItemImageDragActive(false);

    if (imageProcessing) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer?.files ?? []);

    if (!droppedFiles.length) {
      return;
    }

    const firstImageFile = droppedFiles.find((file) => file.type?.startsWith("image/"));

    if (!firstImageFile) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    await ingestItemImageFile(firstImageFile, {
      ignoredExtraFiles: droppedFiles.length > 1
    });
  }

  function removeDraftImage() {
    setDraft((current) => ({
      ...current,
      imageUrl: "",
      imageFrameScale: 100,
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageCropX: 0,
      imageCropY: 0,
      imageCropWidth: 100,
      imageCropHeight: 100
    }));
    setImageUploadError("");
  }

  function resetDraftImageCrop() {
    setDraft((current) => ({
      ...current,
      imageFrameScale: 100,
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageCropX: 0,
      imageCropY: 0,
      imageCropWidth: 100,
      imageCropHeight: 100
    }));
  }

  async function removeDraftBackground() {
    const originalImageUrl = draft.imageUrl.trim();

    if (!isLocalDataImage(originalImageUrl) || imageProcessing) {
      return;
    }

    try {
      setImageProcessing(true);
      setImageUploadError("");
      const inputBlob = await dataUrlToBlob(originalImageUrl);
      const backgroundRemovalModule = await import("@imgly/background-removal");
      const removeBackground = getRemoveBackgroundExport(backgroundRemovalModule);
      const transparentBlob = await removeBackground(inputBlob, {
        model: "small",
        output: {
          format: "image/png",
          quality: 0.9
        }
      });
      const compressedImageUrl = await compressImageSource(transparentBlob);
      setDraft((current) => ({
        ...current,
        imageUrl: compressedImageUrl,
        imageFrameScale: 100,
        imageScale: 100,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageCropX: 0,
        imageCropY: 0,
        imageCropWidth: 100,
        imageCropHeight: 100
      }));
    } catch (error) {
      setImageUploadError(error?.message || "Background could not be removed.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleDelete(itemId) {
    const confirmed = await requestConfirmation({
      title: "Delete item?",
      message: "This wardrobe item will be removed from outfits and saved outfits in this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return false;
    }

    await deleteItem(itemId);
    setItems((current) => current.filter((item) => item.id !== itemId));
    const nextCurrentOutfit = clearItemIdFromOutfit(outfit, itemId);
    setOutfit(nextCurrentOutfit);
    setOutfitItemUuids((current) => syncOutfitItemUuids(nextCurrentOutfit, current, itemsById));
    setSavedOutfits((current) =>
      current.map((savedOutfit) => ({
        ...savedOutfit,
        outfit: clearItemIdFromOutfit(savedOutfit.outfit, itemId),
        outfitItemUuids: syncOutfitItemUuids(
          clearItemIdFromOutfit(savedOutfit.outfit, itemId),
          savedOutfit.outfitItemUuids,
          itemsById
        )
      }))
    );
    return true;
  }

  async function handleEditorDelete() {
    if (!draft.id || editingId === "new") {
      return;
    }

    const deleted = await handleDelete(draft.id);

    if (deleted) {
      cancelEdit();
    }
  }

  function saveCurrentOutfit() {
    setSavedOutfits((current) => {
      const existingSavedOutfit = current.find(
        (savedOutfit) => getOutfitKey(savedOutfit.outfit, savedOutfit.layering) === currentOutfitKey
      );

      if (existingSavedOutfit) {
        if (editingSavedOutfitId === existingSavedOutfit.id) {
          cancelEditSavedOutfit();
        }

        return current.filter((savedOutfit) => savedOutfit.id !== existingSavedOutfit.id);
      }

      const timestamp = new Date().toISOString();

      return [
        normalizeSavedOutfit({
          id: `saved_outfit_${Date.now()}`,
          outfitUuid: createOutfitUuid(),
          name: createSavedOutfitName(current),
          description: "",
          tags: [],
          favorite: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          outfit: { ...outfit },
          outfitItemUuids: syncOutfitItemUuids(outfit, outfitItemUuids, itemsById),
          layering
        }),
        ...current
      ];
    });
  }

  function toggleOutfitLike(outfitToToggle, outfitLayering) {
    const outfitKey = getOutfitKey(outfitToToggle, outfitLayering);
    const isLiked = Boolean(likedOutfitKeys[outfitKey]);

    setLikedOutfitKeys((current) => {
      const nextLookup = { ...current };

      if (isLiked) {
        delete nextLookup[outfitKey];
      } else {
        nextLookup[outfitKey] = true;
      }

      return nextLookup;
    });

    setOutfitAffinity((current) =>
      applyOutfitAffinityDelta(current, outfitToToggle, isLiked ? -1 : 1)
    );
    setRecentOutfits((current) => rememberRecentOutfit(current, outfitToToggle, outfitLayering, { liked: !isLiked }));
  }

  function toggleCurrentOutfitLike() {
    toggleOutfitLike(outfit, layering);
  }

  function toggleSavedOutfitLike(savedOutfit) {
    toggleOutfitLike(savedOutfit.outfit, savedOutfit.layering);
  }

  function loadSavedOutfit(savedOutfit) {
    const sanitizedOutfit = sanitizeOutfitForExistingItems(savedOutfit.outfit, itemsById);

    setLayering(Boolean(savedOutfit.layering));
    setAccessoriesEnabled(hasAccessoryItems(sanitizedOutfit));
    setOutfit(sanitizedOutfit);
    setRecentOutfits((current) =>
      rememberRecentOutfit(
        current,
        sanitizedOutfit,
        Boolean(savedOutfit.layering),
        {
          preserveLiked: true,
          liked: Boolean(likedOutfitKeys[getOutfitKey(savedOutfit.outfit, savedOutfit.layering)])
        }
      )
    );
    setActiveAccessorySlot(null);
    setActiveOutfitSlot(null);
    clearSelectedOutfitItem();
  }

  function renderSavedOutfitPreview(savedOutfit) {
    const previewSlots = getSavedOutfitPreviewSlots(savedOutfit);

    return (
      <div className={`saved-preview ${savedOutfit.layering ? "is-layered" : ""}`} aria-hidden="true">
        {previewSlots.map((slot) => {
          const itemId = savedOutfit.outfit?.[slot];
          const item = itemId ? itemsById[itemId] : null;

          const slotClass = `saved-preview-piece saved-preview-${slot.toLowerCase()}`;

          if (!item) {
            return (
              <div
                key={`${savedOutfit.id}-${slot}`}
                className={`${slotClass} ${itemId ? "saved-preview-missing" : "saved-preview-empty"}`}
              />
            );
          }

          return (
            <div key={`${savedOutfit.id}-${slot}`} className={slotClass}>
              <ManagedItemImage item={item} alt="" dataItemId={item.id} />
            </div>
          );
        })}
      </div>
    );
  }

  function renderAccessorySlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeAccessorySlot === slot || selectedAccessorySlot === slot;

    return (
      <button
        key={slot}
        type="button"
        className={`accessory-slot accessory-slot-${slot.toLowerCase()} ${item ? "has-item" : ""} ${isActive ? "is-active" : ""}`}
        onClick={(event) => handleOutfitItemPreviewClick(item, () => selectAccessoryItem(slot), () => openAccessoryPicker(slot), event)}
        onDoubleClick={(event) => handleOutfitItemPreviewDoubleClick(item, event)}
        aria-label={`${getAccessoryLabel(slot)} options`}
      >
        {item ? (
          <span className="item-figure accessory-figure has-item">
            <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} useFrameScale normalizeToFrameScale useCrop usePresentation />
          </span>
        ) : null}
      </button>
    );
  }

  function openAccessoryPicker(slot) {
    closeUtilityWindows();
    setActiveAccessorySlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);
      setSelectedAccessorySlot(nextSlot);

      if (nextSlot) {
        setActiveOutfitSlot(null);
        setSelectedOutfitSlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function openOutfitSlotPicker(slot) {
    closeUtilityWindows();
    setActiveOutfitSlot((current) => {
      const nextSlot = current === slot ? null : slot;
      setPickerAnchorSlot(nextSlot);
      setSelectedOutfitSlot(nextSlot);

      if (nextSlot) {
        setActiveAccessorySlot(null);
        setSelectedAccessorySlot(null);
        setActivePanel(null);
      }

      return nextSlot;
    });
  }

  function getPickerPositionClass() {
    if (!pickerAnchorSlot) {
      return "picker-overlay-right";
    }

    if (layering && pickerAnchorSlot === "TopOuter") {
      return "picker-overlay-left";
    }

    if (pickerAnchorSlot === "RightHand" || pickerAnchorSlot === "Bag") {
      return "picker-overlay-left";
    }

    return "picker-overlay-right";
  }

  function closePickerOverlay() {
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    clearSelectedOutfitItem();
    setPickerAnchorSlot(null);
    clearSelectedOutfitItem();
  }

  function closeUtilityWindows() {
    setWeatherOpen(false);
    setOutfitFiltersOpen(false);
    setGenerationListsOpen(false);
  }

  function toggleWorkspacePanel(panel, event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    setActivePanel((current) => {
      const nextPanel = current === panel ? null : panel;
      if (nextPanel) {
        closeUtilityWindows();
        setControlsOpen(false);
        setDockExpanded(isMobileViewport);
      } else if (!controlsOpen) {
        setDockExpanded(isMobileViewport ? false : true);
      }
      setActiveOutfitSlot(null);
      setActiveAccessorySlot(null);
      clearSelectedOutfitItem();
      setPickerAnchorSlot(null);
      setWardrobeFiltersOpen(false);
      setDashboardFiltersOpen(false);
      setWardrobeManageOpen(false);
      setFitpicPreview(null);
      cancelEditFitpic();
      setWardrobePreviewItemId(null);
      if (wardrobeSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
        wardrobeSelectClickTimeoutRef.current = null;
      }
      wardrobePendingSelectionRef.current = null;
      cancelEditSavedOutfit();
      setBulkMetadataEditorOpen(false);
      setBulkMetadataDraft(createEmptyBulkMetadataDraft());
      setEditingId(null);
      setEditorReturnTarget(null);
      return nextPanel;
    });
  }

  function closeWorkspacePanel() {
    setActivePanel(null);
    clearSelectedOutfitItem();
    if (!controlsOpen) {
      setDockExpanded(isMobileViewport ? false : true);
    }
    setWardrobeFiltersOpen(false);
    setDashboardFiltersOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    cancelEditFitpic();
    setWardrobePreviewItemId(null);
    setOutfitFiltersOpen(false);
    setGenerationListsOpen(false);
    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }
    wardrobePendingSelectionRef.current = null;
    cancelEditSavedOutfit();
    cancelEdit();
  }

  function toggleControlsWindow(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    if (activePanel) {
      setActivePanel(null);
    }

    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setDashboardFiltersOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    cancelEditFitpic();
    setWardrobePreviewItemId(null);
    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }
    wardrobePendingSelectionRef.current = null;
    cancelEditSavedOutfit();
    setBulkMetadataEditorOpen(false);
    setBulkMetadataDraft(createEmptyBulkMetadataDraft());
    setEditingId(null);
    setEditorReturnTarget(null);
    setControlsOpen((current) => {
      const nextOpen = !current;
      setDockExpanded(isMobileViewport ? nextOpen || activePanel === "wardrobe" || activePanel === "outfits" : true);
      return nextOpen;
    });
  }

  function dismissWardrobeFilters() {
    setWardrobeFiltersOpen(false);
    setWardrobeFilterSearch("");
  }

  function dismissDashboardFilters() {
    setDashboardFiltersOpen(false);
    setDashboardFilterSearch("");
  }

  function handleWardrobeEditorResizeStart(event, mode) {
    event.preventDefault();
    const windowStateKey = getEditorWindowStateKey(editingId, editorReturnTarget);
    const startingWidth = windowState[windowStateKey]?.width ?? defaultWindowState[windowStateKey].width;
    const resizeState = {
      mode,
      startX: event.clientX,
      startWidth: startingWidth
    };
    inlineEditorResizeRef.current = resizeState;

    function handlePointerMove(nextEvent) {
      const deltaX = nextEvent.clientX - resizeState.startX;
      const nextWidth = resizeState.mode === "inline"
        ? resizeState.startWidth - deltaX
        : resizeState.startWidth + deltaX;

      setWindowState((current) => ({
        ...current,
        [windowStateKey]: {
          ...current[windowStateKey],
          width: Math.max(344, Math.min(520, Math.round(nextWidth)))
        }
      }));
    }

    function handlePointerUp() {
      inlineEditorResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function openWardrobeFilters(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    closeUtilityWindows();
    setWardrobeManageOpen(false);
    cancelEditSavedOutfit();
    setWardrobeFiltersOpen((current) => {
      const nextOpen = !current;

      if (!nextOpen) {
        setWardrobeFilterSearch("");
      }

      return nextOpen;
    });
  }

  function openDashboardFilters(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    closeUtilityWindows();
    setDashboardFiltersOpen((current) => {
      const nextOpen = !current;

      if (!nextOpen) {
        setDashboardFilterSearch("");
      }

      return nextOpen;
    });
  }

  function closeWardrobeFilters(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    dismissWardrobeFilters();
  }

  function toggleWardrobeManage(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    closeUtilityWindows();
    dismissWardrobeFilters();
    cancelEditSavedOutfit();
    setWardrobeManageOpen((current) => !current);
  }

  function loadAndCloseSavedOutfit(savedOutfit) {
    loadSavedOutfit(savedOutfit);
    setSelectedSavedOutfitId(null);
    cancelEditSavedOutfit();
    setActivePanel(null);
  }

  function handleSavedOutfitClick(savedOutfit, event) {
    if (isMobileViewport) {
      loadAndCloseSavedOutfit(savedOutfit);
      return;
    }

    if (event?.detail === 0) {
      loadAndCloseSavedOutfit(savedOutfit);
      return;
    }

    if (event?.detail <= 1) {
      setSelectedSavedOutfitId(savedOutfit.id);
    }
  }

  function handleSavedOutfitDoubleClick(savedOutfit, event) {
    if (event) {
      event.preventDefault();
    }

    setSelectedSavedOutfitId(null);
    loadAndCloseSavedOutfit(savedOutfit);
  }

  function renderOutfitSlotPicker() {
    if (!activeOutfitSlot) {
      return null;
    }

    const options = getSlotPickerOptions(activeOutfitSlot);
    const isLocked = Boolean(locked[activeOutfitSlot]);
    const currentItem = itemsById[outfit[activeOutfitSlot]];

    return (
      <div className="slot-picker">
        <div className="slot-picker-header">
          <strong>{getSlotLabel(activeOutfitSlot)}</strong>
          <button type="button" className="ghost-button" onClick={closePickerOverlay}>
            Close
          </button>
        </div>

        <div className="slot-picker-actions">
          <button
            type="button"
            className={`ghost-button ${isLocked ? "is-active" : ""}`}
            onClick={() => toggleLock(activeOutfitSlot)}
          >
            {isLocked ? "Unlock" : "Lock"}
          </button>
          <button type="button" className="ghost-button" onClick={() => handleReroll(activeOutfitSlot)}>
            Reroll
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleOutfitSlot(activeOutfitSlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button type="button" className="ghost-button danger" onClick={() => removeOutfitSlot(activeOutfitSlot)}>
            Remove
          </button>
        </div>

        {options.length ? (
          <div className="slot-picker-list">
            {options.map((item) => {
              const isExcluded = Boolean(excluded[item.id]);

              return (
                <article
                  key={item.id}
                  className={`slot-picker-item ${outfit[activeOutfitSlot] === item.id ? "is-current" : ""} ${isExcluded ? "is-excluded" : ""}`}
                >
                  <button
                    type="button"
                    className="slot-picker-select"
                    onClick={() => setOutfitSlot(activeOutfitSlot, item.id)}
                  >
                    <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                    <span>{buildDisplayName(item)}</span>
                  </button>
                  <button
                    type="button"
                    className={`picker-exclude-toggle ${isExcluded ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExcluded(item.id, { rerollOnEquippedExclude: false });
                    }}
                    aria-label={isExcluded ? "Include item in generation" : "Exclude item from generation"}
                  >
                    {isExcluded ? "×" : "✓"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible items available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderAccessoryPicker() {
    if (!activeAccessorySlot) {
      return null;
    }

    const currentItem = itemsById[outfit[activeAccessorySlot]];

    return (
      <div className="accessory-picker">
        <div className="accessory-picker-header">
          <strong>{getAccessoryLabel(activeAccessorySlot)}</strong>
          <button
            type="button"
            className="ghost-button"
            onClick={closePickerOverlay}
          >
            Close
          </button>
        </div>

        <div className="accessory-picker-actions">
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, -1)}>
            Previous
          </button>
          <button type="button" className="ghost-button" onClick={() => cycleAccessorySlot(activeAccessorySlot, 1)}>
            Next
          </button>
          {currentItem ? (
            <button type="button" className="ghost-button" onClick={() => startFloatingEdit(currentItem)}>
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            onClick={() => removeAccessoryFromSlot(activeAccessorySlot)}
          >
            Remove
          </button>
        </div>

        {compatibleAccessoryOptions.length ? (
          <div className="accessory-picker-list">
            {compatibleAccessoryOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`accessory-picker-item ${outfit[activeAccessorySlot] === item.id ? "is-current" : ""}`}
                onClick={() => swapAccessory(activeAccessorySlot, item.id)}
              >
                <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                <span>{buildDisplayName(item)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>No compatible accessories available for this slot.</p>
          </div>
        )}
      </div>
    );
  }

  function renderSavedOutfitsContent() {
    return (
      <section className="saved-outfits-page" aria-label="Saved outfits">
        {!savedOutfits.length ? (
          <div className="editor-placeholder saved-outfits-empty">
            <p>Save an outfit you like and it will appear here.</p>
          </div>
        ) : (
          <div className="saved-outfits-list">
            {savedOutfits.map((savedOutfit) => {
              const savedOutfitKey = getOutfitKey(savedOutfit.outfit, savedOutfit.layering);
              const isSavedOutfitLiked = Boolean(likedOutfitKeys[savedOutfitKey]);
              const isSelected = selectedSavedOutfitId === savedOutfit.id;

              return (
                <article key={savedOutfit.id} className={`saved-outfit-card ${isSelected ? "is-selected" : ""}`}>
                  {editingSavedOutfitId === savedOutfit.id ? (
                    <form
                      className="saved-outfit-form"
                      onSubmit={(event) => submitSavedOutfit(event, savedOutfit.id)}
                    >
                      <label>
                        Name
                        <input
                          value={savedOutfitDraft.name}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              name: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={savedOutfitDraft.description}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              description: event.target.value
                            }))
                          }
                          rows="3"
                        />
                      </label>
                      <div className="saved-outfit-actions">
                        <button type="submit" className="primary-button">Save</button>
                        <button type="button" className="ghost-button" onClick={cancelEditSavedOutfit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="saved-outfit-load"
                        onClick={(event) => handleSavedOutfitClick(savedOutfit, event)}
                        onDoubleClick={(event) => handleSavedOutfitDoubleClick(savedOutfit, event)}
                      >
                        {renderSavedOutfitPreview(savedOutfit)}
                        <strong>{savedOutfit.name}</strong>
                        <span>{savedOutfit.description || "No description"}</span>
                        {savedOutfitHasMissingItems(savedOutfit, itemsById) ? (
                          <span className="saved-outfit-warning">Missing item</span>
                        ) : null}
                      </button>
                      <div className="saved-outfit-actions">
                        <button
                          type="button"
                          className={`ghost-button ${isSavedOutfitLiked ? "is-active" : ""}`}
                          onClick={() => toggleSavedOutfitLike(savedOutfit)}
                        >
                          {isSavedOutfitLiked ? "Liked" : "Like"}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => startEditSavedOutfit(savedOutfit)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => deleteSavedOutfit(savedOutfit.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderFitpicsContent() {
    return (
      <section className="fitpics-content" aria-label="Fitpics">
        <div
          className={`fitpic-dropzone ${fitpicDropActive ? "is-drag-active" : ""} ${fitpicImporting ? "is-processing" : ""}`}
          onDragEnter={handleFitpicDragEnter}
          onDragOver={handleFitpicDragOver}
          onDragLeave={handleFitpicDragLeave}
          onDrop={handleFitpicDrop}
        >
          <div className="fitpic-dropzone-copy">
            <p className="eyebrow">Import fitpics</p>
            <h3>Drop one or more images here</h3>
            <p>Imported fitpics keep their existing records, appear here immediately, and can be edited afterward.</p>
            {fitpicImportError ? <p className="fitpic-import-error">{fitpicImportError}</p> : null}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => fitpicUploadInputRef.current?.click()}
            disabled={fitpicImporting}
          >
            {fitpicImporting ? "Importing…" : "Choose images"}
          </button>
          <input
            ref={fitpicUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="fitpic-file-input"
            onChange={handleFitpicUpload}
          />
        </div>

        {!fitpics.length ? (
          <div className="editor-placeholder fitpics-empty-state">
            <p>No fitpics yet.</p>
            <p>Import outfit photos here to build an editable visual archive.</p>
          </div>
        ) : (
          <div className="fitpic-list">
            {fitpics.map((fitpic) => (
              <article key={fitpic.id} className="fitpic-card">
                <button
                  type="button"
                  className="fitpic-image-button"
                  onClick={() => openFitpicPreview(fitpic)}
                >
                  <img src={fitpic.imageData} alt={fitpic.name} />
                </button>
                <div className="fitpic-card-copy">
                  <strong title={fitpic.name}>{fitpic.name}</strong>
                  <span>{formatFitpicImportMeta(fitpic) || formatFitpicDate(fitpic.createdAt)}</span>
                  {fitpic.tags.length ? (
                    <span className="fitpic-card-tags" title={fitpic.tags.join(", ")}>
                      {fitpic.tags.join(", ")}
                    </span>
                  ) : null}
                </div>
                <div className="fitpic-card-actions">
                  <button
                    type="button"
                    className={`ghost-button ${fitpic.favorite ? "is-active" : ""}`}
                    onClick={() => toggleFitpicFavorite(fitpic.id)}
                  >
                    {fitpic.favorite ? "Favorited" : "Favorite"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => startEditFitpic(fitpic)}>
                    Edit
                  </button>
                  <button type="button" className="ghost-button danger" onClick={() => deleteFitpic(fitpic.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderDashboardContent() {
    return (
      <section className="panel fitpics-panel outfits-panel dashboard-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Wardrobe analytics</h2>
          </div>
        </div>

        <div className="wardrobe-toolbar wardrobe-toolbar-dashboard">
          <div className="wardrobe-toolbar-leading wardrobe-toolbar-leading-dashboard">
            <div className={`wardrobe-filter-anchor dashboard-filter-anchor ${dashboardFiltersOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className={`secondary-button filter-button ${dashboardFiltersOpen || hasActiveDashboardFilters ? "is-active" : ""}`}
                onClick={openDashboardFilters}
                aria-pressed={dashboardFiltersOpen}
                aria-expanded={dashboardFiltersOpen}
                title={
                  hasActiveDashboardFilters
                    ? `${activeDashboardFilterCount} active filter${activeDashboardFilterCount === 1 ? "" : "s"}`
                    : "No active filters"
                }
              >
                Filter
              </button>

              <div className={`wardrobe-controls ${dashboardFiltersOpen ? "is-open" : ""}`} aria-label="Dashboard filters">
                <div className="wardrobe-controls-body">
                  <div className="wardrobe-filter-search">
                    <input
                      type="search"
                      value={dashboardFilterSearch}
                      onChange={(event) => setDashboardFilterSearch(event.target.value)}
                      placeholder="Search filter options"
                    />
                  </div>
                  {dashboardFilterPanelSections.map((section) => {
                    const selectedCount = section.kind === "multi"
                      ? getSelectedFilterValueCount(dashboardFilters, section.key)
                      : dashboardFilters[section.key]
                        ? 1
                        : 0;
                    const groupMatchesSearch = !normalizedDashboardFilterSearch
                      || section.label.toLowerCase().includes(normalizedDashboardFilterSearch);
                    const resolvedOptions = section.options.map((option) => (
                      typeof option === "string"
                        ? { label: option, value: option }
                        : option
                    ));
                    const filteredOptions = normalizedDashboardFilterSearch && !groupMatchesSearch
                      ? resolvedOptions.filter((option) => option.label.toLowerCase().includes(normalizedDashboardFilterSearch))
                      : resolvedOptions;
                    const noneLabel = `No ${section.label.toLowerCase()}`;
                    const showNoneOption = section.includeNone && (
                      !normalizedDashboardFilterSearch
                      || groupMatchesSearch
                      || noneLabel.includes(normalizedDashboardFilterSearch)
                    );
                    const isOpen = normalizedDashboardFilterSearch ? true : Boolean(dashboardFilterSectionsOpen[section.key]);

                    if (!groupMatchesSearch && !filteredOptions.length && !showNoneOption) {
                      return null;
                    }

                    return (
                      <section key={section.key} className={`wardrobe-filter-group ${isOpen ? "is-open" : ""}`}>
                        <button
                          type="button"
                          className="wardrobe-filter-group-toggle"
                          onClick={() => toggleDashboardFilterSection(section.key)}
                          aria-expanded={isOpen}
                        >
                          <span className="wardrobe-filter-group-copy">
                            <strong>{section.label}</strong>
                            {selectedCount ? (
                              <span className="wardrobe-filter-group-count">{selectedCount} selected</span>
                            ) : null}
                          </span>
                          <span className="wardrobe-filter-group-icon" aria-hidden="true">
                            {isOpen ? "−" : "+"}
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="wardrobe-filter-options">
                            {showNoneOption ? (
                              <button
                                type="button"
                                className={`list-toggle ${
                                  getIncludedFilterValues(dashboardFilters, section.key).includes("__none__")
                                    ? "is-active"
                                    : getExcludedFilterValues(dashboardFilters, section.key).includes("__none__")
                                      ? "is-active is-muted is-excluded"
                                      : ""
                                }`}
                                onClick={(event) => toggleDashboardFilterValueWithMode(section.key, "__none__", event.shiftKey)}
                                aria-pressed={
                                  getIncludedFilterValues(dashboardFilters, section.key).includes("__none__")
                                  || getExcludedFilterValues(dashboardFilters, section.key).includes("__none__")
                                }
                              >
                                {noneLabel}
                              </button>
                            ) : null}
                            {filteredOptions.length ? filteredOptions.map((option) => {
                              const isIncluded = section.kind === "multi"
                                ? getIncludedFilterValues(dashboardFilters, section.key).includes(option.value)
                                : false;
                              const isExcluded = section.kind === "multi"
                                ? getExcludedFilterValues(dashboardFilters, section.key).includes(option.value)
                                : dashboardFilters[section.key] === option.value;
                              const isSelected = section.kind === "multi"
                                ? isIncluded || isExcluded
                                : dashboardFilters[section.key] === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-muted is-excluded" : ""}`}
                                  onMouseDown={(event) => {
                                    if (section.kind === "multi") {
                                      event.preventDefault();
                                    }
                                  }}
                                  onClick={(event) => {
                                    if (section.kind === "multi") {
                                      toggleDashboardFilterValueWithMode(section.key, option.value, event.shiftKey);
                                      return;
                                    }

                                    setDashboardToggleFilter(
                                      section.key,
                                      dashboardFilters[section.key] === option.value ? "" : option.value
                                    );
                                  }}
                                  aria-pressed={isSelected}
                                >
                                  {option.label}
                                </button>
                              );
                            }) : (
                              <p className="wardrobe-filter-empty">No matching options.</p>
                            )}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
                <div className="wardrobe-controls-footer">
                  {hasActiveDashboardFilters ? (
                    <div className="active-filter-summary" aria-label="Active filters">
                      <div className="active-filter-chips">
                        {activeDashboardFilterChips.map((filter) => (
                          <span key={`${filter.label}-${filter.value}-${filter.excluded ? "excluded" : "included"}`} className={`active-filter-chip ${filter.excluded ? "is-excluded" : ""}`}>
                            <span>{filter.label}</span>
                            {filter.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={clearDashboardFilters}
                    disabled={!hasActiveDashboardFilters}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>
            <div className="wardrobe-sort-field">
              <select
                value={dashboardSort}
                onPointerDown={() => {
                  if (dashboardFiltersOpen) {
                    dismissDashboardFilters();
                  }
                }}
                onFocus={() => {
                  if (dashboardFiltersOpen) {
                    dismissDashboardFilters();
                  }
                }}
                onChange={(event) => setDashboardSort(event.target.value)}
              >
                <option value="">Default</option>
                <option value="garmentType">Garment type</option>
                <option value="brand">Brand A-Z</option>
                <option value="type">Type A-Z</option>
                <option value="value">Value</option>
                <option value="paidHigh">Paid high-low</option>
                <option value="paidLow">Paid low-high</option>
                <option value="retailHigh">Retail high-low</option>
                <option value="retailLow">Retail low-high</option>
                <option value="color">Color</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>
          <div className="wardrobe-toolbar-context">
            <span className="wardrobe-results-count">
              {visibleDashboardItems.length} item{visibleDashboardItems.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="wardrobe-stats-grid">
          <div className="wardrobe-stat-card">
            <span>Items</span>
            <strong>{items.length}</strong>
          </div>
          <div className="wardrobe-stat-card">
            <span>Visible</span>
            <strong>{visibleDashboardItems.length}</strong>
          </div>
          <div className="wardrobe-stat-card">
            <span>Selected</span>
            <strong>{selectedWardrobeItemCount}</strong>
          </div>
          <div className="wardrobe-stat-card">
            <span>Favorites</span>
            <strong>{favoriteDashboardItemCount}</strong>
          </div>
          <div className="wardrobe-stat-card">
            <span>Paid value</span>
            <strong>{formatCurrency(dashboardWorth.totalValue)}</strong>
          </div>
          <div className="wardrobe-stat-card">
            <span>Retail value</span>
            <strong>{formatCurrency(dashboardWorth.totalRetailValue)}</strong>
          </div>
        </div>

        <div className="wardrobe-worth-summary">
          <p className="eyebrow">Visible wardrobe worth</p>
          <h2>{formatCurrency(dashboardWorth.totalValue)} / {formatCurrency(dashboardWorth.totalRetailValue)}</h2>
          <span>{dashboardWorth.totalCount} wardrobe pieces · paid / retail</span>
        </div>

        <div className="worth-chart">
          {dashboardWorth.rows.map((row) => (
            <div key={row.category} className="worth-row">
              <div className="worth-row-header">
                <strong>{row.category}</strong>
                <span>{row.count} pieces · {formatCurrency(row.value)} / {formatCurrency(row.retailValue)}</span>
              </div>
              <div className="worth-bar-stack" aria-hidden="true">
                <div className="worth-bar-track">
                  <div
                    className="worth-bar worth-bar-retail"
                    style={{ width: `${Math.max((row.retailValue / dashboardWorth.maxValue) * 100, row.retailValue ? 8 : 0)}%` }}
                  />
                </div>
                <div className="worth-bar-track">
                  <div
                    className="worth-bar"
                    style={{ width: `${Math.max((row.value / dashboardWorth.maxValue) * 100, row.value ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderWardrobeGrid() {
    if (!visibleWardrobeItems.length) {
      return (
        <div className="editor-placeholder wardrobe-empty-state">
          <p>No wardrobe items match the current search and filters.</p>
          <p>Clear filters or add a new item to broaden the library view.</p>
        </div>
      );
    }

    return (
      <div className="wardrobe-grid">
        {visibleWardrobeItems.map((item) => {
          const isEquipped = Object.values(outfit).includes(item.id);
          const isSelected = selectedWardrobeItemIds.includes(item.id);

          return (
            <article
              key={item.id}
              className={`wardrobe-card ${isEquipped ? "is-equipped" : ""} ${excluded[item.id] ? "is-excluded" : ""} ${isSelected ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className={`wardrobe-preview ${isSelected ? "is-selected" : ""}`}
                onClick={(event) => handleWardrobePreviewClick(item, event)}
                onDoubleClick={(event) => handleWardrobePreviewDoubleClick(item, event)}
                onKeyDown={(event) => handleWardrobePreviewKeyDown(item, event)}
                aria-pressed={isSelected}
                aria-label={`Select ${buildDisplayName(item)}. Double-click or press Enter to preview.`}
              >
                <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} />
                {item.favorite ? (
                  <span className="wardrobe-favorite-indicator" aria-hidden="true">♥</span>
                ) : null}
              </button>

              <div className="wardrobe-meta">
                <strong title={buildDisplayName(item)}>{buildDisplayName(item)}</strong>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function startEditSavedOutfit(savedOutfit) {
    setSelectedSavedOutfitId(savedOutfit.id);
    setEditingSavedOutfitId(savedOutfit.id);
    setSavedOutfitDraft({
      name: savedOutfit.name ?? "",
      description: savedOutfit.description ?? ""
    });
  }

  function cancelEditSavedOutfit() {
    setEditingSavedOutfitId(null);
    setSavedOutfitDraft({ name: "", description: "" });
  }

  function submitSavedOutfit(event, savedOutfitId) {
    event.preventDefault();

    const trimmedName = savedOutfitDraft.name.trim();
    const trimmedDescription = savedOutfitDraft.description.trim();
    const updatedAt = new Date().toISOString();

    setSavedOutfits((current) =>
      current.map((savedOutfit) =>
        savedOutfit.id === savedOutfitId
          ? {
              ...savedOutfit,
              name: trimmedName || savedOutfit.name,
              description: trimmedDescription,
              updatedAt
            }
          : savedOutfit
      )
    );

    cancelEditSavedOutfit();
  }

  async function deleteSavedOutfit(savedOutfitId) {
    const confirmed = await requestConfirmation({
      title: "Delete outfit?",
      message: "This saved outfit will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setSavedOutfits((current) => current.filter((savedOutfit) => savedOutfit.id !== savedOutfitId));

    if (editingSavedOutfitId === savedOutfitId) {
      cancelEditSavedOutfit();
    }

    if (selectedSavedOutfitId === savedOutfitId) {
      setSelectedSavedOutfitId(null);
    }
  }

  function openFitpicPreview(fitpic) {
    closeUtilityWindows();
    setEditingFitpicId(null);
    setFitpicPreview(fitpic);
  }

  function startEditFitpic(fitpic) {
    closeUtilityWindows();
    setFitpicPreview(null);
    setFitpicImportError("");
    setEditingFitpicId(fitpic.id);
    setFitpicDraft({
      name: fitpic.name ?? "",
      description: fitpic.description ?? "",
      tagsText: Array.isArray(fitpic.tags) ? fitpic.tags.join(", ") : "",
      favorite: Boolean(fitpic.favorite)
    });
  }

  function cancelEditFitpic() {
    setEditingFitpicId(null);
    setFitpicImportError("");
    setFitpicDraft({ name: "", description: "", tagsText: "", favorite: false });
  }

  function saveFitpicDraft(event) {
    event.preventDefault();

    if (!editingFitpic) {
      cancelEditFitpic();
      return;
    }

    const trimmedName = fitpicDraft.name.trim();
    const nextTags = parseFitpicTagsInput(fitpicDraft.tagsText);
    const updatedAt = new Date().toISOString();
    const nextFitpic = normalizeFitpic({
      ...editingFitpic,
      name: trimmedName || editingFitpic.name,
      description: fitpicDraft.description.trim(),
      tags: nextTags,
      favorite: fitpicDraft.favorite,
      updatedAt
    });

    setFitpics((current) =>
      current.map((fitpic) => (fitpic.id === nextFitpic.id ? nextFitpic : fitpic))
    );
    cancelEditFitpic();
  }

  async function importFitpicFiles(fileList) {
    const files = [...(fileList ?? [])];

    if (!files.length) {
      return;
    }

    const imageFiles = files.filter((file) => file?.type?.startsWith("image/"));

    if (!imageFiles.length) {
      setFitpicImportError("No image files were found.");
      return;
    }

    try {
      setFitpicImporting(true);
      setFitpicImportError("");
      const nextFitpics = await Promise.all(
        imageFiles.map((file) =>
          createImportedFitpicFromFile(file, {
            createId: createFitpicId,
            readFileAsDataUrl,
            loadImage,
            compressImageSource
          })
        )
      );

      setFitpics((current) => [...nextFitpics, ...current]);

      if (imageFiles.length !== files.length) {
        setFitpicImportError("Imported the image files and ignored non-image files.");
      }
    } catch (error) {
      setFitpicImportError(error?.message || "These images could not be imported.");
    } finally {
      setFitpicImporting(false);
    }
  }

  async function handleFitpicUpload(event) {
    try {
      await importFitpicFiles(event.target.files);
    } finally {
      event.target.value = "";
    }
  }

  function handleFitpicDragEnter(event) {
    event.preventDefault();

    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }

    fitpicDropDepthRef.current += 1;
    setFitpicDropActive(true);
  }

  function handleFitpicDragOver(event) {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleFitpicDragLeave(event) {
    event.preventDefault();

    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }

    fitpicDropDepthRef.current = Math.max(0, fitpicDropDepthRef.current - 1);

    if (fitpicDropDepthRef.current === 0) {
      setFitpicDropActive(false);
    }
  }

  async function handleFitpicDrop(event) {
    event.preventDefault();
    fitpicDropDepthRef.current = 0;
    setFitpicDropActive(false);
    await importFitpicFiles(event.dataTransfer?.files);
  }

  async function replaceEditingFitpicImage(event) {
    const [file] = event.target.files ?? [];

    if (!file || !editingFitpic) {
      return;
    }

    try {
      setFitpicImportError("");
      const nextFitpic = await replaceFitpicImageFromFile(editingFitpic, file, {
        readFileAsDataUrl,
        loadImage,
        compressImageSource
      });
      setFitpics((current) =>
        current.map((fitpic) => (fitpic.id === nextFitpic.id ? nextFitpic : fitpic))
      );
    } catch (error) {
      setFitpicImportError(error?.message || "This image could not be used.");
    } finally {
      event.target.value = "";
    }
  }

  function toggleFitpicFavorite(fitpicId) {
    const updatedAt = new Date().toISOString();

    setFitpics((current) =>
      current.map((fitpic) =>
        fitpic.id === fitpicId
          ? normalizeFitpic({
              ...fitpic,
              favorite: !fitpic.favorite,
              updatedAt
            })
          : fitpic
      )
    );
  }

  async function deleteFitpic(fitpicId) {
    const confirmed = await requestConfirmation({
      title: "Delete fitpic?",
      message: "This fitpic will be removed from this browser.",
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    setFitpics((current) => current.filter((fitpic) => fitpic.id !== fitpicId));

    if (fitpicPreview?.id === fitpicId) {
      setFitpicPreview(null);
    }

    if (editingFitpicId === fitpicId) {
      cancelEditFitpic();
    }
  }

  function removeAccessoryFromSlot(slot) {
    setOutfit((current) => ({
      ...current,
      [slot]: null
    }));
    setLocked((current) => ({
      ...current,
      [slot]: false
    }));
  }

  function swapAccessory(slot, itemId) {
    setOutfit((current) => ({
      ...current,
      [slot]: itemId
    }));
    setActiveAccessorySlot(null);
  }

  if (loading) {
    return <main className="app-shell loading-state">Loading wardrobe…</main>;
  }

  const isMobileFullscreenEditorOpen = Boolean((editingId || bulkMetadataEditorOpen) && isMobileViewport);

  const bulkMetadataEditorBody = bulkMetadataEditorOpen ? (
    <form className="editor-form bulk-metadata-editor" onSubmit={applyBulkMetadataChanges}>
      <div className="id-preview bulk-edit-summary">
        <span>Bulk metadata editor</span>
        <strong>{selectedWardrobeItemCount} selected item{selectedWardrobeItemCount === 1 ? "" : "s"}</strong>
      </div>

      <div className="editor-advanced-panel bulk-metadata-grid">
        <label>
          <span className="editor-label-row"><span>Status</span></span>
          <select value={bulkMetadataDraft.statusMode} onChange={(event) => setBulkMetadataFieldMode("status", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
          </select>
          {bulkMetadataDraft.statusMode === "set" ? (
            <select value={bulkMetadataDraft.statusValue} onChange={(event) => setBulkMetadataFieldValue("status", event.target.value)}>
              {itemListOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          ) : null}
        </label>

        <label className="bulk-metadata-span-2">
          <span className="editor-label-row"><span>Collections</span></span>
          <select value={bulkMetadataDraft.collectionsMode} onChange={(event) => setBulkMetadataFieldMode("collections", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="add">Add collection</option>
            <option value="remove">Remove collection</option>
            <option value="clear">Clear all</option>
          </select>
          {["add", "remove"].includes(bulkMetadataDraft.collectionsMode) ? (
            <>
              <input
                list="bulk-editor-collection-suggestions"
                value={bulkMetadataDraft.collectionsValue}
                onChange={(event) => setBulkMetadataFieldValue("collections", event.target.value)}
                placeholder="Summer, Travel, Workwear..."
              />
              <datalist id="bulk-editor-collection-suggestions">
                {collectionOptions.map((collection) => (
                  <option key={collection} value={collection} />
                ))}
              </datalist>
            </>
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Type</span></span>
          <select value={bulkMetadataDraft.typeMode} onChange={(event) => setBulkMetadataFieldMode("type", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.typeMode === "set" ? (
            <>
              <input
                list="item-type-suggestions"
                value={bulkMetadataDraft.typeValue}
                onChange={(event) => setBulkMetadataFieldValue("type", event.target.value)}
                placeholder="Shirt, jacket, trousers..."
              />
              <datalist id="item-type-suggestions">
                {typeSuggestions.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </>
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Color</span></span>
          <select value={bulkMetadataDraft.colorMode} onChange={(event) => setBulkMetadataFieldMode("color", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.colorMode === "set" ? (
            <>
              <input
                list="item-color-suggestions"
                value={bulkMetadataDraft.colorValue}
                onChange={(event) => setBulkMetadataFieldValue("color", event.target.value)}
                placeholder="Black"
              />
              <datalist id="item-color-suggestions">
                {colorSuggestions.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </>
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Brand</span></span>
          <select value={bulkMetadataDraft.brandMode} onChange={(event) => setBulkMetadataFieldMode("brand", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.brandMode === "set" ? (
            <>
              <input
                list="item-brand-suggestions"
                value={bulkMetadataDraft.brandValue}
                onChange={(event) => setBulkMetadataFieldValue("brand", event.target.value)}
                placeholder="Brand"
              />
              <datalist id="item-brand-suggestions">
                {brandSuggestions.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </>
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Name</span></span>
          <select value={bulkMetadataDraft.nameMode} onChange={(event) => setBulkMetadataFieldMode("name", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.nameMode === "set" ? (
            <>
              <input
                list="item-name-suggestions"
                value={bulkMetadataDraft.nameValue}
                onChange={(event) => setBulkMetadataFieldValue("name", event.target.value)}
                placeholder="Grey wool beanie"
              />
              <datalist id="item-name-suggestions">
                {nameSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          ) : null}
        </label>

        <label className="bulk-metadata-span-2">
          <span className="editor-label-row"><span>Description</span></span>
          <select value={bulkMetadataDraft.descriptionMode} onChange={(event) => setBulkMetadataFieldMode("description", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.descriptionMode === "set" ? (
            <textarea
              value={bulkMetadataDraft.descriptionValue}
              onChange={(event) => setBulkMetadataFieldValue("description", event.target.value)}
              rows={3}
              placeholder="Notes, context, fabric, fit, or styling details"
            />
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Size</span></span>
          <select value={bulkMetadataDraft.sizeMode} onChange={(event) => setBulkMetadataFieldMode("size", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.sizeMode === "set" ? (
            <input
              value={bulkMetadataDraft.sizeValue}
              onChange={(event) => setBulkMetadataFieldValue("size", event.target.value)}
              placeholder="M"
            />
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Weight</span></span>
          <select value={bulkMetadataDraft.weightMode} onChange={(event) => setBulkMetadataFieldMode("weight", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.weightMode === "set" ? (
            <select value={bulkMetadataDraft.weightValue} onChange={(event) => setBulkMetadataFieldValue("weight", event.target.value)}>
              <option value="">No weight</option>
              {weightOptions.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Quantity</span></span>
          <select value={bulkMetadataDraft.quantityMode} onChange={(event) => setBulkMetadataFieldMode("quantity", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.quantityMode === "set" ? (
            <input
              inputMode="numeric"
              value={bulkMetadataDraft.quantityValue}
              onChange={(event) => setBulkMetadataFieldValue("quantity", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="1"
            />
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Paid value</span></span>
          <select value={bulkMetadataDraft.valueMode} onChange={(event) => setBulkMetadataFieldMode("value", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.valueMode === "set" ? (
            <input
              inputMode="numeric"
              value={bulkMetadataDraft.valueValue}
              onChange={(event) => setBulkMetadataFieldValue("value", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="120"
            />
          ) : null}
        </label>

        <label>
          <span className="editor-label-row"><span>Retail value</span></span>
          <select value={bulkMetadataDraft.retailValueMode} onChange={(event) => setBulkMetadataFieldMode("retailValue", event.target.value)}>
            <option value="keep">Keep existing</option>
            <option value="set">Set value</option>
            <option value="clear">Clear</option>
          </select>
          {bulkMetadataDraft.retailValueMode === "set" ? (
            <input
              inputMode="numeric"
              value={bulkMetadataDraft.retailValueValue}
              onChange={(event) => setBulkMetadataFieldValue("retailValue", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="280"
            />
          ) : null}
        </label>

        <section className="metadata-tag-group" aria-label="Style metadata">
          <span className="editor-label-row"><span>Style tags</span></span>
          <div className="bulk-tag-editor">
            <div>
              <p className="bulk-tag-heading">Add</p>
              <div className="metadata-tag-options">
                {styleTagOptions.map((tag) => (
                  <button
                    key={`style-add-${tag}`}
                    type="button"
                    className={`list-toggle ${(bulkMetadataDraft.styleTagsToAdd ?? []).includes(tag) ? "is-active" : ""}`}
                    onClick={() => toggleBulkMetadataTag("styleTags", "add", tag)}
                    aria-pressed={(bulkMetadataDraft.styleTagsToAdd ?? []).includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="bulk-tag-heading">Remove</p>
              <div className="metadata-tag-options">
                {styleTagOptions.map((tag) => (
                  <button
                    key={`style-remove-${tag}`}
                    type="button"
                    className={`list-toggle is-muted ${(bulkMetadataDraft.styleTagsToRemove ?? []).includes(tag) ? "is-active" : ""}`}
                    onClick={() => toggleBulkMetadataTag("styleTags", "remove", tag)}
                    aria-pressed={(bulkMetadataDraft.styleTagsToRemove ?? []).includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="metadata-tag-group" aria-label="Climate metadata">
          <span className="editor-label-row"><span>Climate tags</span></span>
          <div className="bulk-tag-editor">
            <div>
              <p className="bulk-tag-heading">Add</p>
              <div className="metadata-tag-options">
                {editableClimateTagOptions.map((tag) => (
                  <button
                    key={`climate-add-${tag}`}
                    type="button"
                    className={`list-toggle ${(bulkMetadataDraft.climateTagsToAdd ?? []).includes(tag) ? "is-active" : ""}`}
                    onClick={() => toggleBulkMetadataTag("climateTags", "add", tag)}
                    aria-pressed={(bulkMetadataDraft.climateTagsToAdd ?? []).includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="bulk-tag-heading">Remove</p>
              <div className="metadata-tag-options">
                {editableClimateTagOptions.map((tag) => (
                  <button
                    key={`climate-remove-${tag}`}
                    type="button"
                    className={`list-toggle is-muted ${(bulkMetadataDraft.climateTagsToRemove ?? []).includes(tag) ? "is-active" : ""}`}
                    onClick={() => toggleBulkMetadataTag("climateTags", "remove", tag)}
                    aria-pressed={(bulkMetadataDraft.climateTagsToRemove ?? []).includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-button">Apply metadata</button>
        <button type="button" className="secondary-button" onClick={() => setBulkMetadataDraft(createEmptyBulkMetadataDraft())}>
          Reset
        </button>
        <button type="button" className="secondary-button" onClick={cancelEdit}>Close</button>
      </div>
    </form>
  ) : null;

  const editorBody = editingId ? (
    <form className="editor-form" onSubmit={submitItem}>
      <div
        className={`item-image-upload ${itemImageDragActive ? "is-drag-active" : ""}`}
        onDragEnter={handleItemImageDragEnter}
        onDragOver={handleItemImageDragOver}
        onDragLeave={handleItemImageDragLeave}
        onDrop={handleItemImageDrop}
      >
        <div className="item-image-preview">
          {draft.imageUrl.trim() ? (
            <ManagedItemImage item={draft} alt="" frameRef={editorImageFrameRef} imageRef={editorImageRef} />
          ) : (
            <span>No image selected</span>
          )}
        </div>
        <div className="item-image-actions">
          <div className="item-image-action-group item-image-action-group-primary">
            <label className="upload-button">
              {draft.imageUrl.trim() ? "Change image" : "Choose image"}
              <input type="file" accept="image/*" onChange={handleItemImageUpload} disabled={imageProcessing} />
            </label>
            {draft.imageUrl.trim() ? (
              <button type="button" className="ghost-button" onClick={resetDraftImageCrop} disabled={imageProcessing}>
                Reset crop
              </button>
            ) : null}
          </div>
          <div className="item-image-action-group item-image-action-group-secondary">
            <button
              type="button"
              className="secondary-button"
              onClick={removeDraftBackground}
              disabled={!canRemoveDraftBackground || imageProcessing}
            >
              {imageProcessing ? "Removing..." : "Remove background"}
            </button>
            {draft.imageUrl.trim() ? (
              <button type="button" className="ghost-button" onClick={removeDraftImage} disabled={imageProcessing}>
                Remove image
              </button>
            ) : null}
          </div>
          <label className="image-size-field">
            Image size
            <div className="image-scale-control">
              <input
                type="range"
                min="50"
                max="180"
                step="5"
                value={normalizeImageScale(draft.imageScale)}
                onChange={(event) => setAdvancedField("imageScale", Number(event.target.value))}
              />
              <input
                inputMode="numeric"
                value={normalizeImageScale(draft.imageScale)}
                onChange={(event) => setAdvancedField("imageScale", normalizeImageScale(event.target.value))}
                aria-label="Image size percentage"
              />
              <span>%</span>
            </div>
          </label>
        </div>
        {imageUploadError ? <p className="form-error">{imageUploadError}</p> : null}
      </div>

      <div className="editor-core-fields">
        <label>
          Type
          <input
            list="item-type-suggestions"
            value={draft.type}
            onChange={(event) => setDraft((current) => applyTypeDefaultsToDraft(current, event.target.value))}
            placeholder="Shirt, jacket, trousers..."
          />
        </label>
        <datalist id="item-type-suggestions">
          {typeSuggestions.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>

        <label>
          {renderAdvancedLabel("Garment", "garmentType")}
          <select
            value={draft.garmentType}
            onChange={(event) =>
              setDraft((current) =>
                applyGarmentRules(
                  { ...current, garmentType: event.target.value },
                  resolveTypeDefaults(current.type)
                )
              )
            }
          >
            {garmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          Color
          <input
            list="item-color-suggestions"
            value={draft.color}
            onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
            placeholder="Black"
          />
        </label>
        <datalist id="item-color-suggestions">
          {colorSuggestions.map((color) => (
            <option key={color} value={color} />
          ))}
        </datalist>

        <div className="editor-list-favorite-row">
          <label>
            {renderAdvancedLabel("Status", "status")}
            <select value={draft.status} onChange={(event) => setAdvancedField("status", event.target.value)}>
              {itemListOptions.map((list) => (
                <option key={list} value={list}>
                  {list}
                </option>
              ))}
            </select>
          </label>

          <div className="editor-favorite-field" aria-label="Favorite">
            <div className="editor-favorite-actions">
              {advancedOverrideSet.has("favorite") ? (
                <button
                  type="button"
                  className="editor-inline-reset"
                  onClick={() => resetAdvancedField("favorite")}
                >
                  Reset
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={`editor-favorite-button ${draft.favorite ? "is-active" : ""}`}
              aria-pressed={Boolean(draft.favorite)}
              aria-label={draft.favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => setAdvancedField("favorite", !draft.favorite)}
            >
              <span aria-hidden="true">{draft.favorite ? "♥" : "♡"}</span>
            </button>
          </div>
        </div>

        <label className="editor-span-2">
          Collections
          <div className="editor-advanced-panel editor-styling-panel">
            <div className="metadata-tag-options">
              {normalizeCollections(draft.collections).map((collection) => (
                <button
                  key={collection}
                  type="button"
                  className="list-toggle is-active"
                  onClick={() => removeDraftCollection(collection)}
                  aria-label={`Remove ${collection} collection`}
                >
                  {collection} ×
                </button>
              ))}
            </div>
            <div className="editor-list-favorite-row">
              <input
                list="item-collection-suggestions"
                value={draftCollectionInput}
                onChange={(event) => setDraftCollectionInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDraftCollection();
                  }
                }}
                placeholder="Add collection"
              />
              <button type="button" className="secondary-button" onClick={() => addDraftCollection()}>
                Add
              </button>
            </div>
          </div>
        </label>
        <datalist id="item-collection-suggestions">
          {collectionOptions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>

        <label>
          {renderAdvancedLabel("Brand", "brand")}
          <input
            list="item-brand-suggestions"
            value={draft.brand}
            onChange={(event) => setAdvancedField("brand", event.target.value)}
            placeholder="Brand"
          />
        </label>
        <datalist id="item-brand-suggestions">
          {brandSuggestions.map((brand) => (
            <option key={brand} value={brand} />
          ))}
        </datalist>

        <label>
          {renderAdvancedLabel("Name", "name")}
          <input
            list="item-name-suggestions"
            value={draft.name}
            onChange={(event) => setAdvancedField("name", event.target.value)}
            placeholder=""
          />
        </label>
        <datalist id="item-name-suggestions">
          {nameSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <label className="editor-span-2">
          {renderAdvancedLabel("Description", "description")}
          <textarea
            value={draft.description}
            onChange={(event) => setAdvancedField("description", event.target.value)}
            rows={2}
            placeholder="Notes, context, fabric, fit, or styling details"
          />
        </label>
      </div>

      <div className="editor-advanced-toggle-row">
        <button
          type="button"
          className={`ghost-button editor-advanced-toggle ${editorAdvancedOpen ? "is-active" : ""}`}
          onClick={() => setEditorAdvancedOpen((current) => !current)}
          aria-expanded={editorAdvancedOpen}
        >
          {editorAdvancedOpen ? "Hide advanced" : "Advanced"}
        </button>
        <span className="editor-advanced-summary">
          {advancedMetadataOverrideCount
            ? `${advancedMetadataOverrideCount} custom field${advancedMetadataOverrideCount === 1 ? "" : "s"}`
            : "Defaults active"}
        </span>
      </div>

      {editorAdvancedOpen ? (
        <div className="editor-advanced-panel">
          {draft.garmentType === "Top" || draft.garmentType === "Outerwear" ? (
            <label>
              {renderAdvancedLabel("Layer type", "layerType")}
              <select
                value={draft.layerType}
                onChange={(event) => setAdvancedField("layerType", event.target.value)}
              >
                {layerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {draft.garmentType === "Accessory" ? (
            <label>
              {renderAdvancedLabel("Accessory slot", "accessorySlot")}
              <select
                value={draft.accessorySlot}
                onChange={(event) => setAdvancedField("accessorySlot", event.target.value)}
              >
                <option value="">Select slot</option>
                {accessorySlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {getAccessoryLabel(slot)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            {renderAdvancedLabel("Size", "size")}
            <input value={draft.size} onChange={(event) => setAdvancedField("size", event.target.value)} placeholder="M" />
          </label>

          <label>
            {renderAdvancedLabel("Weight", "weight")}
            <select value={draft.weight} onChange={(event) => setAdvancedField("weight", event.target.value)}>
              <option value="">No weight</option>
              {weightOptions.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </label>

          <label>
            {renderAdvancedLabel("Quantity", "quantity")}
            <input
              inputMode="numeric"
              min="1"
              value={draft.quantity}
              onChange={(event) => setAdvancedField("quantity", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="1"
            />
          </label>

          <label>
            {renderAdvancedLabel("Paid value", "value")}
            <input
              inputMode="numeric"
              value={draft.value}
              onChange={(event) => setAdvancedField("value", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="120"
            />
          </label>

          <label>
            {renderAdvancedLabel("Retail value", "retailValue")}
            <input
              inputMode="numeric"
              value={draft.retailValue}
              onChange={(event) => setAdvancedField("retailValue", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="280"
            />
          </label>
        </div>
      ) : null}

      <div className="editor-advanced-toggle-row">
        <button
          type="button"
          className={`ghost-button editor-advanced-toggle ${editorStylingOpen ? "is-active" : ""}`}
          onClick={() => setEditorStylingOpen((current) => !current)}
          aria-expanded={editorStylingOpen}
        >
          {editorStylingOpen ? "Hide styling" : "Styling"}
        </button>
        <span className="editor-advanced-summary">
          {selectedStyleTagCount || selectedClimateTagCount
            ? `${selectedStyleTagCount + selectedClimateTagCount} tag${selectedStyleTagCount + selectedClimateTagCount === 1 ? "" : "s"} selected`
            : stylingOverrideCount
              ? `${stylingOverrideCount} custom field${stylingOverrideCount === 1 ? "" : "s"}`
              : "No styling tags"}
        </span>
      </div>

      {editorStylingOpen ? (
        <div className="editor-advanced-panel editor-styling-panel">
          <section className="metadata-tag-group" aria-label="Style metadata">
            {renderAdvancedLabel("Style tags", "styleTags")}
            <div className="metadata-tag-options">
              {styleTagOptions.map((tag) => {
                const isSelected = normalizeTagList(draft.styleTags, styleTagOptions).includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    className={`list-toggle ${isSelected ? "is-active" : ""}`}
                    onClick={() => toggleDraftTag("styleTags", tag, styleTagOptions)}
                    aria-pressed={isSelected}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="metadata-tag-group" aria-label="Climate metadata">
            {renderAdvancedLabel("Climate tags", "climateTags")}
            <div className="metadata-tag-options">
              {editableClimateTagOptions.map((tag) => {
                const isSelected = normalizeTagList(draft.climateTags, editableClimateTagOptions).includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    className={`list-toggle ${isSelected ? "is-active" : ""}`}
                    onClick={() => toggleDraftTag("climateTags", tag, editableClimateTagOptions)}
                    aria-pressed={isSelected}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-button">Save item</button>
        {editingId !== "new" ? (
          <button type="button" className="secondary-button" onClick={duplicateDraftItem}>
            Duplicate
          </button>
        ) : null}
        {editingId !== "new" ? (
          <button type="button" className="ghost-button danger" onClick={handleEditorDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
      </div>
    </form>
  ) : bulkMetadataEditorOpen ? (
    bulkMetadataEditorBody
  ) : (
    <div className="editor-placeholder">
      <p>Select an item to edit it, or use Add item to create a wardrobe entry.</p>
      <p>Uploaded item images are saved in this browser and included in backup JSON.</p>
    </div>
  );

  function renderOutfitSlot(slot) {
    const item = itemsById[outfit[slot]];
    const isActive = activeOutfitSlot === slot || selectedOutfitSlot === slot;
    return (
      <div key={slot} className="outfit-slot-wrap">
        <article
          className={`outfit-slot outfit-slot-${slot.toLowerCase()} ${locked[slot] ? "is-locked" : ""} ${isActive ? "is-active" : ""}`}
        >
          <button
            type="button"
            className={`item-figure ${item ? "has-item" : "is-empty"}`}
            onClick={(event) => handleOutfitItemPreviewClick(item, () => selectOutfitItem(slot), () => openOutfitSlotPicker(slot), event)}
            onDoubleClick={(event) => handleOutfitItemPreviewDoubleClick(item, event)}
            aria-label={`${getSlotLabel(slot)} options`}
          >
            {item ? <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} useFrameScale normalizeToFrameScale useCrop usePresentation /> : <span aria-hidden="true" />}
          </button>
          {item ? (
            <div className="outfit-slot-hover-actions">
              <button
                type="button"
                className="outfit-slot-hover-button"
                onMouseDown={preventMouseButtonFocus}
                onClick={(event) => {
                  event.stopPropagation();
                  startFloatingEdit(item);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="outfit-slot-hover-button"
                onMouseDown={preventMouseButtonFocus}
                onClick={(event) => {
                  event.stopPropagation();
                  openOutfitSlotPicker(slot);
                }}
              >
                Select
              </button>
            </div>
          ) : null}
        </article>
      </div>
    );
  }

  const workspaceDock = isMobileFullscreenEditorOpen ? null : createPortal(
    <div
      ref={workspaceTabsRef}
      className={`workspace-tabs ${isDockExpanded ? "is-dock-expanded" : ""} ${paletteOpen ? "is-palette-open" : ""}`}
      aria-label="Workspace sections"
    >
      <button
        type="button"
        className="workspace-tab is-active"
        onPointerUp={handleGeneratePointerUp}
        onClick={handleGenerateClick}
      >
        Generate
      </button>
      <button
        type="button"
        className={`workspace-tab ${controlsOpen && !activePanel ? "is-active" : ""}`}
        onClick={toggleControlsWindow}
        aria-pressed={controlsOpen && !activePanel}
      >
        CONTROLS
      </button>
      <div className={`workspace-tab-group ${isDockExpanded ? "is-expanded" : ""}`}>
        {[
          ["wardrobe", "Wardrobe"],
          ["outfits", "Outfits"],
          ["dashboard", "Dashboard"]
        ].map(([panel, label]) => (
          <button
            key={panel}
            type="button"
            className={`workspace-tab ${activePanel === panel ? "is-active" : ""}`}
            onClick={(event) => toggleWorkspacePanel(panel, event)}
            aria-pressed={activePanel === panel}
            tabIndex={isDockExpanded ? 0 : -1}
          >
            {label}
          </button>
        ))}
      </div>
      {outfitPalette.length ? (
        paletteOpen ? (
          <button
            type="button"
            className="outfit-palette-inline"
            onClick={(event) => {
              blurPointerActivatedControl(event);
              setPaletteOpen(false);
            }}
            aria-label="Hide outfit color palette"
            title="Hide color palette"
          >
            {outfitPalette.map((entry) => (
              <span
                key={`${entry.color}-${entry.label}`}
                className="outfit-palette-swatch"
                style={{ backgroundColor: entry.color }}
                title={`${entry.label}: ${entry.color}`}
              />
            ))}
          </button>
        ) : (
          <button
            type="button"
            className="palette-tab"
            onClick={(event) => {
              blurPointerActivatedControl(event);
              setPaletteOpen(true);
            }}
            aria-label="Toggle outfit color palette"
            aria-expanded={paletteOpen}
            title="Color palette"
          >
            <span style={{ backgroundColor: outfitPalette[0].color }} />
          </button>
        )
      ) : null}
    </div>,
    document.body
  );

  return (
    <main className="app-shell">
      <section className="content-grid">
        <div className="current-outfit-panel">
          <div ref={outfitStageRef} className="outfit-stage">
            {accessoriesEnabled ? (
              <div className="accessory-ring">
                {accessorySlots.map((slot) => renderAccessorySlot(slot))}
              </div>
            ) : null}

            <div className="outfit-grid">
              {outfitLayout.map((entry) => {
                if (entry === "TopGroup") {
                  if (layering) {
                    return (
                      <div key={entry} className="top-layer-row">
                        {renderOutfitSlot("TopInner")}
                        {renderOutfitSlot("TopOuter")}
                      </div>
                    );
                  }

                  return renderOutfitSlot("TopInner");
                }

                return renderOutfitSlot(entry);
              })}
            </div>
          </div>

        </div>

        {activeOutfitSlot || activeAccessorySlot ? (
          <div ref={pickerOverlayRef} className={`picker-overlay ${getPickerPositionClass()}`}>
            {activeOutfitSlot ? renderOutfitSlotPicker() : renderAccessoryPicker()}
          </div>
        ) : null}

        {controlsOpen && !activePanel ? (
          <div className="controls-window" aria-label="Outfit controls">
            <div className="controls-window-header">
              <p className="eyebrow">Current outfit</p>
              <button
                type="button"
                className="controls-hide-button"
                onClick={() => setControlsOpen(false)}
                aria-label="Hide controls"
              >
                ×
              </button>
            </div>

            <div className="controls-group controls-group-top">
              <button type="button" className={`secondary-button ${layering ? "is-active" : ""}`} onClick={toggleLayering}>
                Layering: {layering ? "On" : "Off"}
              </button>
              <button type="button" className={`secondary-button ${accessoriesEnabled ? "is-active" : ""}`} onClick={toggleAccessories}>
                Accessories: {accessoriesEnabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                className={`secondary-button ${generationMode === "guided" ? "is-active" : ""}`}
                onClick={() =>
                  setGenerationMode((current) => (current === "guided" ? "random" : "guided"))
                }
              >
                Generation: {generationMode === "guided" ? "Guided" : "Random"}
              </button>
            </div>

            <div className="controls-group controls-group-bottom">
              <button
                type="button"
                className={`ghost-button ${isCurrentOutfitLiked ? "is-active" : ""}`}
                onClick={toggleCurrentOutfitLike}
              >
                {isCurrentOutfitLiked ? "Liked outfit" : "Like outfit"}
              </button>
              <button
                type="button"
                className={`ghost-button ${isCurrentOutfitSaved ? "is-active" : ""}`}
                onClick={saveCurrentOutfit}
              >
                {isCurrentOutfitSaved ? "Saved outfit" : "Save outfit"}
              </button>
              <button type="button" className="ghost-button" onClick={handleExportOutfitImage}>
                Export outfit image
              </button>
              {hasLockedOutfitSlots ? (
                <button type="button" className="ghost-button" onClick={unlockAllOutfitSlots}>
                  Unlock all
                </button>
              ) : null}
            </div>

            <div className="controls-group">
              <div className={`controls-outfit-filters ${outfitFiltersOpen ? "is-open" : ""}`} aria-label="Outfit filters">
                <button
                  type="button"
                  className={`controls-outfit-filters-toggle ${outfitFiltersOpen ? "is-active" : ""}`}
                  onClick={() => setOutfitFiltersOpen((current) => !current)}
                  aria-expanded={outfitFiltersOpen}
                >
                  <span>Outfit filters</span>
                  <span>
                    {activeOutfitFilterCount > 0
                      ? `${activeOutfitFilterCount} active`
                      : "None"}
                  </span>
                </button>

                {outfitFiltersOpen ? (
                  <div className="outfit-filters-panel">
                    <div className="outfit-filter-groups">
                      {Object.entries(outfitFilterOptions).map(([group, options]) => (
                        <section key={group} className="outfit-filter-group">
                          <p className="eyebrow">{group}</p>
                          <div className="outfit-filter-options">
                            {options.map((option) => {
                              const isIncluded = getIncludedFilterValues(outfitFilters, group).includes(option);
                              const isExcluded = getExcludedFilterValues(outfitFilters, group).includes(option);
                              const isSelected = isIncluded || isExcluded;

                              return (
                                <button
                                  key={option}
                                  type="button"
                                  className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-excluded" : ""}`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={(event) => toggleOutfitFilter(group, option, event.shiftKey)}
                                  aria-pressed={isSelected}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                      {collectionOptions.length ? (
                        <section className="outfit-filter-group">
                          <p className="eyebrow">collections</p>
                          <div className="outfit-filter-options">
                            {collectionOptions.map((collection) => {
                              const isIncluded = getIncludedFilterValues(outfitFilters, "collections").includes(collection);
                              const isExcluded = getExcludedFilterValues(outfitFilters, "collections").includes(collection);
                              const isSelected = isIncluded || isExcluded;

                              return (
                                <button
                                  key={collection}
                                  type="button"
                                  className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-excluded" : ""}`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={(event) => toggleOutfitFilter("collections", collection, event.shiftKey)}
                                  aria-pressed={isSelected}
                                >
                                  {collection}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ) : null}
                    </div>

                    <button type="button" className="ghost-button outfit-filters-clear-button" onClick={clearOutfitFilters}>
                      Clear outfit filters
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                ref={generationListsRef}
                className={`controls-generation-lists ${generationListsOpen ? "is-open" : ""}`}
                aria-label="Generation lists"
              >
                <button
                  type="button"
                  className={`controls-generation-lists-toggle ${generationListsOpen ? "is-active" : ""}`}
                  onClick={() => setGenerationListsOpen((current) => !current)}
                  aria-expanded={generationListsOpen}
                >
                  <span>Status</span>
                  <span>{generationListsSummary}</span>
                </button>

                {generationListsOpen ? (
                  <div className="controls-generation-lists-panel">
                    {itemListOptions.map((list) => {
                      const isSelected = isGenerationListEnabled(list);
                      const isExcluded = isGenerationListExcluded(list);

                      return (
                        <button
                          key={list}
                          type="button"
                          className={`list-toggle controls-generation-list-option ${isSelected ? "is-active" : isExcluded ? "is-active is-excluded" : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => toggleGenerationListWithMode(list, event.shiftKey)}
                          aria-pressed={isSelected || isExcluded}
                        >
                          <span>{list}</span>
                          <span className="controls-generation-list-mark" aria-hidden="true">
                            {isSelected ? "✓" : isExcluded ? "X" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className={`controls-weather ${weatherOpen ? "is-open" : ""}`} aria-label="Weather controls">
                <button
                  type="button"
                  className={`controls-weather-toggle ${weatherOpen ? "is-active" : ""}`}
                  onClick={() => setWeatherOpen((current) => !current)}
                  aria-expanded={weatherOpen}
                >
                  <span>Weather</span>
                  <span>
                    {Number.isFinite(weatherData?.temperature)
                      ? `${Math.round(weatherData.temperature)}°C`
                      : compactWeatherLocationName
                        ? compactWeatherLocationName
                        : "Set location"}
                  </span>
                </button>

                {weatherOpen ? (
                  <div className="weather-window weather-window-controls" aria-label="Current weather">
                    <form
                      className="weather-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        refreshWeather();
                      }}
                    >
                      <input
                        aria-label="Location"
                        value={weatherLocationDraft}
                        onChange={(event) => setWeatherLocationDraft(event.target.value)}
                        placeholder="Berlin"
                      />
                      <button type="submit" className="secondary-button" disabled={weatherLoading}>
                        {weatherLoading ? "Loading..." : "Update"}
                      </button>
                    </form>

                    {weatherData ? (
                      <div className="weather-summary">
                        <strong>{Math.round(weatherData.temperature)}°C</strong>
                        <span>{weatherData.condition}</span>
                        {compactWeatherLocationName ? <span>{compactWeatherLocationName}</span> : null}
                        {Number.isFinite(weatherData.low) && Number.isFinite(weatherData.high) ? (
                          <span>{Math.round(weatherData.low)}° / {Math.round(weatherData.high)}°</span>
                        ) : null}
                        {weatherData.suggestedFilters?.length ? (
                          <span>{weatherData.suggestedFilters.join(" + ")}</span>
                        ) : null}
                      </div>
                    ) : null}

                    {weatherError ? <p className="weather-error">{weatherError}</p> : null}

                    <button
                      type="button"
                      className="ghost-button"
                      onClick={applyWeatherFilters}
                      disabled={!weatherData?.suggestedFilters?.length}
                    >
                      Apply weather filter
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="controls-group">
              <div ref={outfitDebugRef} className="outfit-feedback-panel">
                <div className="outfit-feedback-header">
                  <div className="outfit-feedback-chips" aria-label="Outfit reasons">
                    <span className="active-filter-chip">{currentOutfitStyleChip}</span>
                    <span className="active-filter-chip">{currentOutfitClimateChip}</span>
                  </div>
                  <button
                    type="button"
                    className={`ghost-button outfit-debug-toggle ${outfitDebugOpen ? "is-active" : ""}`}
                    onClick={() => setOutfitDebugOpen((current) => !current)}
                    aria-expanded={outfitDebugOpen}
                  >
                    {outfitDebugOpen ? "Hide" : "Debug"}
                  </button>
                </div>

                {outfitDebugOpen && !showDebugPopout ? renderOutfitDebugPanel("is-inline") : null}
                {showDebugPopout ? renderOutfitDebugPanel("outfit-debug-popout") : null}
              </div>
            </div>

            <div className="controls-group controls-group-generate-count">
              <span className="controls-generate-count-label">Generate count:</span>
              <span className="controls-generate-count-value">{generateCount}</span>
              <button type="button" className="ghost-button controls-generate-count-reset" onClick={() => setGenerateCount(0)}>
                Reset
              </button>
            </div>
          </div>
        ) : null}

        {activePanel ? (
          <div className="floating-backdrop active-panel-backdrop" onClick={closeWorkspacePanel}>
        <div
          className={`active-panel-overlay ${activePanel === "wardrobe" ? "is-wardrobe-panel" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
        {activePanel === "wardrobe" ? (
        <div className="wardrobe-workspace">
          <div className="panel wardrobe-panel">
            <div className="panel-header">
              <div className="wardrobe-toolbar">
                <div className="wardrobe-toolbar-leading">
                  <div className="wardrobe-search-field">
                    <input
                      type="search"
                      value={wardrobeSearch}
                      onPointerDown={() => {
                        if (wardrobeFiltersOpen) {
                          dismissWardrobeFilters();
                        }
                      }}
                      onFocus={() => {
                        if (wardrobeFiltersOpen) {
                          dismissWardrobeFilters();
                        }
                      }}
                      onChange={(event) => setWardrobeSearch(event.target.value)}
                      placeholder="Search wardrobe"
                    />
                  </div>
                  <div className={`wardrobe-filter-anchor ${wardrobeFiltersOpen ? "is-open" : ""}`}>
                    <button
                      type="button"
                      className={`secondary-button filter-button ${wardrobeFiltersOpen || hasActiveWardrobeFilters ? "is-active" : ""}`}
                      onClick={openWardrobeFilters}
                      aria-pressed={wardrobeFiltersOpen}
                      aria-expanded={wardrobeFiltersOpen}
                      title={
                        hasActiveWardrobeFilters
                          ? `${activeWardrobeFilterCount} active filter${activeWardrobeFilterCount === 1 ? "" : "s"}`
                          : "No active filters"
                      }
                    >
                      Filter
                    </button>

                    <div className={`wardrobe-controls ${wardrobeFiltersOpen ? "is-open" : ""}`} aria-label="Wardrobe filters">
                      <div className="wardrobe-controls-body">
                        <div className="wardrobe-filter-search">
                          <input
                            type="search"
                            value={wardrobeFilterSearch}
                            onChange={(event) => setWardrobeFilterSearch(event.target.value)}
                            placeholder="Search filter options"
                          />
                        </div>
                        {wardrobeFilterPanelSections.map((section) => {
                          const selectedCount = section.kind === "multi"
                            ? getSelectedFilterValueCount(wardrobeFilters, section.key)
                            : wardrobeFilters[section.key]
                              ? 1
                              : 0;
                          const groupMatchesSearch = !normalizedWardrobeFilterSearch
                            || section.label.toLowerCase().includes(normalizedWardrobeFilterSearch);
                          const resolvedOptions = section.options.map((option) => (
                            typeof option === "string"
                              ? { label: option, value: option }
                              : option
                          ));
                          const filteredOptions = normalizedWardrobeFilterSearch && !groupMatchesSearch
                            ? resolvedOptions.filter((option) => option.label.toLowerCase().includes(normalizedWardrobeFilterSearch))
                            : resolvedOptions;
                          const noneLabel = `No ${section.label.toLowerCase()}`;
                          const showNoneOption = section.includeNone && (
                            !normalizedWardrobeFilterSearch
                            || groupMatchesSearch
                            || noneLabel.includes(normalizedWardrobeFilterSearch)
                          );
                          const isOpen = normalizedWardrobeFilterSearch ? true : Boolean(wardrobeFilterSectionsOpen[section.key]);

                          if (!groupMatchesSearch && !filteredOptions.length && !showNoneOption) {
                            return null;
                          }

                          return (
                            <section key={section.key} className={`wardrobe-filter-group ${isOpen ? "is-open" : ""}`}>
                              <button
                                type="button"
                                className="wardrobe-filter-group-toggle"
                                onClick={() => toggleWardrobeFilterSection(section.key)}
                                aria-expanded={isOpen}
                              >
                                <span className="wardrobe-filter-group-copy">
                                  <strong>{section.label}</strong>
                                  {selectedCount ? (
                                    <span className="wardrobe-filter-group-count">{selectedCount} selected</span>
                                  ) : null}
                                </span>
                                <span className="wardrobe-filter-group-icon" aria-hidden="true">
                                  {isOpen ? "−" : "+"}
                                </span>
                              </button>
                              {isOpen ? (
                                <div className="wardrobe-filter-options">
                                  {showNoneOption ? (
                                    <button
                                      type="button"
                                      className={`list-toggle ${
                                        getIncludedFilterValues(wardrobeFilters, section.key).includes("__none__")
                                          ? "is-active"
                                          : getExcludedFilterValues(wardrobeFilters, section.key).includes("__none__")
                                            ? "is-active is-muted is-excluded"
                                            : ""
                                      }`}
                                      onClick={(event) => toggleWardrobeFilterValueWithMode(section.key, "__none__", event.shiftKey)}
                                      aria-pressed={
                                        getIncludedFilterValues(wardrobeFilters, section.key).includes("__none__")
                                        || getExcludedFilterValues(wardrobeFilters, section.key).includes("__none__")
                                      }
                                    >
                                      {noneLabel}
                                    </button>
                                  ) : null}
                                  {filteredOptions.length ? filteredOptions.map((option) => {
                                    const isIncluded = section.kind === "multi"
                                      ? getIncludedFilterValues(wardrobeFilters, section.key).includes(option.value)
                                      : false;
                                    const isExcluded = section.kind === "multi"
                                      ? getExcludedFilterValues(wardrobeFilters, section.key).includes(option.value)
                                      : false;
                                    const isSelected = section.kind === "multi"
                                      ? isIncluded || isExcluded
                                      : wardrobeFilters[section.key] === option.value;

                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-muted is-excluded" : ""}`}
                                        onMouseDown={(event) => {
                                          if (section.kind === "multi") {
                                            event.preventDefault();
                                          }
                                        }}
                                        onClick={(event) => {
                                          if (section.kind === "multi") {
                                            toggleWardrobeFilterValueWithMode(section.key, option.value, event.shiftKey);
                                            return;
                                          }

                                          setWardrobeToggleFilter(
                                            section.key,
                                            wardrobeFilters[section.key] === option.value ? "" : option.value
                                          );
                                        }}
                                        aria-pressed={isSelected}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  }) : (
                                    <p className="wardrobe-filter-empty">No matching options.</p>
                                  )}
                                </div>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>
                      <div className="wardrobe-controls-footer">
                        {wardrobeSearch || hasActiveWardrobeFilters ? (
                          <div className="active-filter-summary" aria-label="Active filters">
                            <div className="active-filter-chips">
                              {wardrobeSearch ? (
                                <span className="active-filter-chip">
                                  <span>Search</span>
                                  {wardrobeSearch}
                                </span>
                              ) : null}
                              {activeWardrobeFilterChips.map((filter) => (
                                <span key={`${filter.label}-${filter.value}-${filter.excluded ? "excluded" : "included"}`} className={`active-filter-chip ${filter.excluded ? "is-excluded" : ""}`}>
                                  <span>{filter.label}</span>
                                  {filter.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            clearWardrobeFilters();
                            setWardrobeSearch("");
                          }}
                          disabled={!wardrobeSearch && !hasActiveWardrobeFilters}
                        >
                          Clear search + filters
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="wardrobe-sort-field">
                    <select
                      value={wardrobeSort}
                      onPointerDown={() => {
                        if (wardrobeFiltersOpen) {
                          dismissWardrobeFilters();
                        }
                      }}
                      onFocus={() => {
                        if (wardrobeFiltersOpen) {
                          dismissWardrobeFilters();
                        }
                      }}
                      onChange={(event) => setWardrobeSort(event.target.value)}
                    >
                      <option value="">Default</option>
                      <option value="garmentType">Garment type</option>
                      <option value="brand">Brand A-Z</option>
                      <option value="type">Type A-Z</option>
                      <option value="value">Value</option>
                      <option value="paidHigh">Paid high-low</option>
                      <option value="paidLow">Paid low-high</option>
                      <option value="retailHigh">Retail high-low</option>
                      <option value="retailLow">Retail low-high</option>
                      <option value="color">Color</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </div>
                  <div className="wardrobe-primary-actions">
                    <div className="wardrobe-manage-anchor">
                      <button
                        type="button"
                        className={`secondary-button ${wardrobeManageOpen ? "is-active" : ""}`}
                        onClick={toggleWardrobeManage}
                        aria-expanded={wardrobeManageOpen}
                      >
                        Manage
                      </button>
                      <div
                        className={`wardrobe-manage-window ${wardrobeManageOpen ? "is-open" : ""}`}
                        aria-label="Wardrobe management"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="wardrobe-manage-grid">
                          <section className="wardrobe-manage-section">
                            <div className="wardrobe-manage-actions">
                              <button type="button" className="ghost-button" onClick={openWardrobeExportDialog}>
                                Export Wardrobe Image
                              </button>
                              <button type="button" className="ghost-button" onClick={handleExportLibraryCsv}>
                                Export Library CSV
                              </button>
                              <button type="button" className="ghost-button" onClick={handleExportBackup}>
                                Export Backup
                              </button>
                              <button type="button" className="ghost-button" onClick={() => importBackupRef.current?.click()}>
                                Import Backup
                              </button>
                              <div className="wardrobe-manage-divider" aria-hidden="true" />
                              <button type="button" className="ghost-button secondary-button" onClick={clearExcluded}>
                                Clear excluded
                              </button>
                              <button type="button" className="ghost-button danger" onClick={handleResetToDefault}>
                                Reset To Default
                              </button>
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`primary-button ${editingId === "new" && editorReturnTarget !== "outfit" ? "is-active" : ""}`}
                      onClick={(event) => startCreate(event)}
                      aria-pressed={editingId === "new" && editorReturnTarget !== "outfit"}
                    >
                      Add Item
                    </button>
                  </div>
                </div>
                <div className="wardrobe-toolbar-context">
                  <span className="wardrobe-results-count">
                    {visibleWardrobeItems.length} item{visibleWardrobeItems.length === 1 ? "" : "s"}
                  </span>
                  {hasWardrobeSelection ? (
                    <WardrobeSelectionBar
                      inline
                      selectedCount={selectedWardrobeItemCount}
                      bulkCollectionDraft={bulkCollectionDraft}
                      bulkListDraft={bulkListDraft}
                      collectionOptions={collectionOptions}
                      itemListOptions={itemListOptions}
                      setBulkCollectionDraft={setBulkCollectionDraft}
                      setBulkListDraft={setBulkListDraft}
                      favoriteActionLabel={bulkFavoriteActionLabel}
                      excludeActionLabel={bulkExcludeActionLabel}
                      onEdit={editSelectedWardrobeItems}
                      onClear={clearWardrobeSelection}
                      onMoveToList={moveSelectedItemsToList}
                      onAddCollection={addCollectionToSelectedItems}
                      onRemoveCollection={removeCollectionFromSelectedItems}
                      onClearCollections={clearSelectedItemCollections}
                      onFavoriteToggle={() => setSelectedItemsFavoriteState(!areAllSelectedWardrobeItemsFavorite)}
                      onExcludeToggle={() => setSelectedItemsExcludedState(!areAllSelectedWardrobeItemsExcluded)}
                      onDelete={handleBulkDeleteSelected}
                      onCloseEdit={cancelEdit}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {wardrobeFiltersOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={closeWardrobeFilters} />
            ) : null}

            {wardrobeManageOpen ? (
              <div className="floating-backdrop filter-backdrop" onClick={() => setWardrobeManageOpen(false)} />
            ) : null}

            <input
              ref={importBackupRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={handleImportBackup}
            />

            <div
              className={`wardrobe-panel-body ${showInlineWardrobeEditor ? "has-side-editor" : ""}`}
              style={{ "--wardrobe-editor-width": `${activeEditorWidth}px` }}
            >
              <div className="wardrobe-panel-scroll">
                {renderWardrobeGrid()}
              </div>

              {showInlineWardrobeEditor ? (
                <>
                  <div
                    className="wardrobe-editor-resize-handle"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize editor"
                    onPointerDown={(event) => handleWardrobeEditorResizeStart(event, "inline")}
                  />
                  <aside ref={editorRef} className="panel side-editor is-open">
                    {editorBody}
                  </aside>
                </>
              ) : null}
            </div>
          </div>
        </div>
        ) : null}

        {activePanel === "outfits" ? (
        <section className="insights-stack">
          <div className="panel fitpics-panel outfits-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Outfits</p>
                <h2>Outfit archive</h2>
              </div>
            </div>
            <div className="outfits-panel-tabs" role="tablist" aria-label="Outfits sections">
              {outfitSectionTabs.map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`outfits-panel-tab ${activeOutfitsTab === tab ? "is-active" : ""}`}
                  onClick={() => setActiveOutfitsTab(tab)}
                  role="tab"
                  aria-selected={activeOutfitsTab === tab}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeOutfitsTab === "saved" ? renderSavedOutfitsContent() : renderFitpicsContent()}
          </div>
        </section>
        ) : null}
        {activePanel === "dashboard" ? (
        <section className="insights-stack">
          {renderDashboardContent()}
        </section>
        ) : null}
        </div>
        </div>
        ) : null}

        {(editingId || bulkMetadataEditorOpen) && !showInlineWardrobeEditor ? (
          <aside
            ref={editorRef}
            className={`panel floating-item-editor ${isMobileViewport ? "is-mobile-fullscreen" : ""} ${activePanel === "wardrobe" ? "is-wardrobe-editor" : ""} ${editorReturnTarget === "outfit" ? "is-outfit-editor" : ""}`}
            style={{ "--wardrobe-editor-width": `${activeEditorWidth}px` }}
          >
            {editorReturnTarget === "outfit" && !isMobileViewport ? (
              <div
                className="wardrobe-editor-resize-handle is-floating"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize editor"
                onPointerDown={(event) => handleWardrobeEditorResizeStart(event, "floating")}
              />
            ) : null}
            {editorBody}
          </aside>
        ) : null}

        <ConfirmationDialog
          open={Boolean(confirmation)}
          title={confirmation?.title ?? ""}
          message={confirmation?.message ?? ""}
          confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
          onCancel={confirmation?.onCancel}
          onConfirm={confirmation?.onConfirm}
        />

        <WardrobeExportDialog
          open={Boolean(wardrobeExportOptions)}
          options={wardrobeExportOptions ?? createWardrobeSpreadExportOptions("compact")}
          onChange={setWardrobeExportOptions}
          onCancel={() => setWardrobeExportOptions(null)}
          onConfirm={handleConfirmWardrobeExport}
        />

        {workspaceDock}

        <PreviewOverlay
          open={Boolean(wardrobePreviewItem)}
          eyebrow=""
          title={wardrobePreviewItem ? buildDisplayName(wardrobePreviewItem) : ""}
          meta={wardrobePreviewMeta}
          onClose={closeWardrobePreview}
          actions={wardrobePreviewItem ? (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={equipWardrobePreviewItem}
                disabled={!resolveSlotForItem(wardrobePreviewItem)}
              >
                {isWardrobePreviewItemEquipped ? "Unequip" : "Equip"}
              </button>
              <button
                type="button"
                className={`ghost-button preview-overlay-favorite-button ${wardrobePreviewItem.favorite ? "is-active" : ""}`}
                onClick={toggleWardrobePreviewFavorite}
                aria-label={wardrobePreviewItem.favorite ? "Remove from favorites" : "Add to favorites"}
                title={wardrobePreviewItem.favorite ? "Unfavorite" : "Favorite"}
              >
                <span aria-hidden="true">{wardrobePreviewItem.favorite ? "♥" : "♡"}</span>
              </button>
              <button type="button" className="ghost-button" onClick={toggleWardrobePreviewExcluded}>
                {excluded[wardrobePreviewItem.id] ? "Include" : "Exclude"}
              </button>
              <button type="button" className="ghost-button" onClick={editWardrobePreviewItem}>
                Edit
              </button>
              <button type="button" className="ghost-button danger" onClick={deleteWardrobePreviewItem}>
                Delete
              </button>
            </>
          ) : null}
        >
          {wardrobePreviewItem ? (
            <div className="wardrobe-item-preview-content">
              <div className="wardrobe-item-preview-image">
                <button
                  type="button"
                  className="preview-overlay-nav preview-overlay-nav-left"
                  onClick={showPreviousWardrobePreviewItem}
                  aria-label="Previous visible wardrobe item"
                  title="Previous item"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <ManagedItemImage
                  item={wardrobePreviewItem}
                  alt={buildDisplayName(wardrobePreviewItem)}
                  className="wardrobe-item-preview-plain"
                  dataItemId={wardrobePreviewItem.id}
                />
                <button
                  type="button"
                  className="preview-overlay-nav preview-overlay-nav-right"
                  onClick={showNextWardrobePreviewItem}
                  aria-label="Next visible wardrobe item"
                  title="Next item"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              {wardrobePreviewItem.description?.trim() ? (
                <div className="wardrobe-item-preview-copy">
                  <p>{wardrobePreviewItem.description.trim()}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </PreviewOverlay>

        <PreviewOverlay
          open={Boolean(fitpicPreview)}
          eyebrow="Fitpic"
          title={fitpicPreview?.name ?? ""}
          meta={fitpicPreview ? formatFitpicImportMeta(fitpicPreview) || formatFitpicDate(fitpicPreview.createdAt) : null}
          onClose={() => setFitpicPreview(null)}
          actions={fitpicPreview ? (
            <>
              <button type="button" className="ghost-button" onClick={() => startEditFitpic(fitpicPreview)}>
                Edit
              </button>
              <button
                type="button"
                className={`ghost-button ${fitpicPreview.favorite ? "is-active" : ""}`}
                onClick={() => toggleFitpicFavorite(fitpicPreview.id)}
              >
                {fitpicPreview.favorite ? "Favorited" : "Favorite"}
              </button>
            </>
          ) : null}
        >
          {fitpicPreview ? (
            <div className="fitpic-preview-content">
              <img className="preview-overlay-fitpic-image" src={fitpicPreview.imageData} alt={fitpicPreview.name} />
              {(fitpicPreview.description || fitpicPreview.tags.length) ? (
                <div className="fitpic-preview-copy">
                  {fitpicPreview.description ? <p>{fitpicPreview.description}</p> : null}
                  {fitpicPreview.tags.length ? <p className="fitpic-preview-tags">{fitpicPreview.tags.join(", ")}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </PreviewOverlay>

        <PreviewOverlay
          open={Boolean(editingFitpic)}
          eyebrow="Edit fitpic"
          title={editingFitpic?.name ?? "Fitpic"}
          meta={editingFitpic ? formatFitpicImportMeta(editingFitpic) : null}
          onClose={cancelEditFitpic}
          actions={editingFitpic ? (
            <>
              <button type="submit" form="fitpic-editor-form" className="primary-button">
                Save
              </button>
              <button type="button" className="ghost-button" onClick={cancelEditFitpic}>
                Cancel
              </button>
              <button type="button" className="ghost-button danger" onClick={() => deleteFitpic(editingFitpic.id)}>
                Delete
              </button>
            </>
          ) : null}
        >
          {editingFitpic ? (
            <form id="fitpic-editor-form" className="fitpic-editor" onSubmit={saveFitpicDraft}>
              <div className="fitpic-editor-media">
                <img className="fitpic-editor-image" src={editingFitpic.imageData} alt={editingFitpic.name} />
                <div className="fitpic-editor-media-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => fitpicReplaceInputRef.current?.click()}
                  >
                    Replace image
                  </button>
                  <input
                    ref={fitpicReplaceInputRef}
                    type="file"
                    accept="image/*"
                    className="fitpic-file-input"
                    onChange={replaceEditingFitpicImage}
                  />
                </div>
              </div>

              <div className="fitpic-editor-fields">
                <label>
                  <span className="editor-label-row"><span>Name / title</span></span>
                  <input
                    value={fitpicDraft.name}
                    onChange={(event) =>
                      setFitpicDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  <span className="editor-label-row"><span>Description</span></span>
                  <textarea
                    rows="4"
                    value={fitpicDraft.description}
                    onChange={(event) =>
                      setFitpicDraft((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  <span className="editor-label-row"><span>Tags</span></span>
                  <input
                    value={fitpicDraft.tagsText}
                    onChange={(event) =>
                      setFitpicDraft((current) => ({
                        ...current,
                        tagsText: event.target.value
                      }))
                    }
                    placeholder="casual, summer, black"
                  />
                </label>

                <label className="fitpic-favorite-field">
                  <input
                    type="checkbox"
                    checked={fitpicDraft.favorite}
                    onChange={(event) =>
                      setFitpicDraft((current) => ({
                        ...current,
                        favorite: event.target.checked
                      }))
                    }
                  />
                  <span>Favorite</span>
                </label>

                {fitpicImportError ? <p className="fitpic-import-error">{fitpicImportError}</p> : null}

                <div className="fitpic-metadata-panel">
                  <p className="eyebrow">Import metadata</p>
                  <div className="fitpic-metadata-grid">
                    <span>Imported</span>
                    <strong>{formatFitpicDate(editingFitpic.importedAt) || "Unknown"}</strong>
                    <span>Filename</span>
                    <strong title={editingFitpic.sourceOriginalFilename || editingFitpic.name}>
                      {editingFitpic.sourceOriginalFilename || "Unknown"}
                    </strong>
                    <span>Type</span>
                    <strong>{editingFitpic.sourceMimeType || "Unknown"}</strong>
                    <span>Extension</span>
                    <strong>{editingFitpic.sourceFileExtension || "Unknown"}</strong>
                    <span>Size</span>
                    <strong>{formatFitpicFileSize(editingFitpic.sourceFileSize) || "Unknown"}</strong>
                    <span>Dimensions</span>
                    <strong>{formatFitpicDimensions(editingFitpic) || "Unknown"}</strong>
                    <span>Aspect / orientation</span>
                    <strong>
                      {editingFitpic.sourceAspectRatio ? editingFitpic.sourceAspectRatio.toString() : "Unknown"}
                      {editingFitpic.sourceOrientation ? ` • ${editingFitpic.sourceOrientation}` : ""}
                    </strong>
                    <span>Captured</span>
                    <strong>{formatFitpicDate(editingFitpic.sourceCapturedAt || editingFitpic.sourceOriginalCreatedAt) || "Unknown"}</strong>
                    <span>Camera</span>
                    <strong>{[editingFitpic.sourceCameraMake, editingFitpic.sourceCameraModel].filter(Boolean).join(" ") || "Unknown"}</strong>
                    <span>Lens</span>
                    <strong>{editingFitpic.sourceLensModel || "Unknown"}</strong>
                  </div>
                </div>
              </div>
            </form>
          ) : null}
        </PreviewOverlay>
      </section>
    </main>
  );
}
