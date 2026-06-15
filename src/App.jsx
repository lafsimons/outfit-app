import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationDialog from "./components/ConfirmationDialog";
import DismissibleBackdrop from "./components/DismissibleBackdrop";
import FitpicExportDialog from "./components/FitpicExportDialog";
import OaAiExportDialog from "./components/OaAiExportDialog";
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
  isActiveStatus,
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
  getManualSelectorSlotPool,
  getOutfitDominantStyle,
  getOutfitKey,
  getGuidedBreakdownDisplayEntries,
  isEligibleForGeneration,
  isNonStackableTopType,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits,
  pickNextItemForGeneration,
  pickRandom,
  rememberRecentOutfit,
  summarizeGuidedExplanation,
  summarizeGuidedDebugPayload,
  visibleSlots
} from "./lib/generation";
import {
  buildDisplayName,
  getActiveWardrobeItemImageAsset,
  createItemUuid,
  createFallbackItemTimestamp,
  createUniqueItemId,
  formatCurrency,
  garmentTypes,
  getActiveWardrobeItemImage,
  getWardrobeItemImages,
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
  mirrorActiveWardrobeImageAssetToLegacyAliases,
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
  createFitpicImageUuid,
  createImportedGroupedFitpicFromFiles,
  createImportedFitpicFromFile,
  getFitpicImages,
  getPrimaryFitpicImage,
  normalizeFitpic,
  normalizeFitpicImage
} from "./lib/fitpics";
import {
  addFitpicImagesToDraft,
  addFitpicTagsToDraft,
  addLinkedItemToFitpicDraft,
  applyFitpicDateInput,
  getFitpicDateInputValue,
  moveFitpicImageInDraft,
  removeFitpicTagFromDraft,
  removeFitpicImageFromDraft,
  removeLinkedItemFromFitpicDraft,
  resolveFitpicLinkedItems,
  setPrimaryFitpicImageInDraft,
  syncFitpicLinkedItemSidecars
} from "./lib/fitpicEditorModel";
import {
  addWardrobeItemImagesToDraft,
  createImportedWardrobeItemImage,
  moveWardrobeItemImageInDraft,
  removeWardrobeItemImageFromDraft,
  replaceActiveWardrobeItemImageAssetInDraft,
  setActiveWardrobeItemImageInDraft
} from "./lib/wardrobeItemImageEditorModel";
import {
  emptyFitpicFilters,
  filterAndSortFitpics,
  fitpicExcludedMultiValueFilterKeys,
  fitpicMultiValueFilterKeys,
  getFitpicFilterOptions,
  getFitpicTagFilterGroups,
  getFitpicPreviewDirectionForKey,
  getFitpicPreviewNavigation
} from "./lib/fitpicLibrary";
import {
  FITPIC_SPREAD_DETAIL_GAP,
  FITPIC_SPREAD_PRIMARY_HEIGHT,
  createFitpicSpreadExportOptions,
  getFitpicSpreadExportDetailLayout,
  getFitpicSpreadExportDetailTiles,
  getFitpicSpreadExportOrderedFitpics,
  getFitpicSpreadExportPackedRenderConfig,
  getFitpicSpreadExportPrimaryImage,
  getFitpicSpreadExportScopedFitpics,
  normalizeFitpicSpreadExportOptions
} from "./lib/fitpicSpreadExport";
import {
  filterAndSortSavedOutfits,
  getSavedOutfitTagFilterOptions
} from "./lib/savedOutfitLibrary";
import {
  applySavedWardrobeView,
  applySavedWardrobeViewToOutfitFilters,
  createSavedWardrobeViewSnapshot,
  deleteSavedWardrobeView,
  matchesCurrentOutfitFiltersSavedWardrobeView,
  matchesCurrentWardrobeView,
  normalizeSavedWardrobeViews,
  renameSavedWardrobeView,
  togglePinnedSavedWardrobeView,
  upsertSavedWardrobeView
} from "./lib/savedWardrobeViews";
import {
  createEmptySelectorFilters,
  DEFAULT_SELECTOR_SORT,
  filterAndSortSelectorItems,
  getSelectorSearchText,
  getSelectorFilterOptions,
  hasActiveSelectorControls
} from "./lib/outfitItemSelectorLibrary";
import { prepareBackupImport } from "./lib/backupImport";
import {
  DEFAULT_WARDROBE_SORT,
  emptyWardrobeFilters,
  getVisibleWardrobeItems,
  getExcludedFilterKey,
  getWardrobeFilterOptions,
  getWardrobeSearchText,
  matchesWardrobeFilters,
  normalizeWardrobeFilters,
  normalizeWardrobeSort,
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
import {
  addItemEditorDraftCollection,
  patchOpenItemEditorDraft,
  removeItemEditorDraftCollection,
  toggleItemEditorDraftTag
} from "./lib/itemEditorDraft";
import { getNextSelectionState, pruneSelectedIds } from "./lib/selectionModel";
import {
  buildManagedImageMetricsCacheKey,
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
  downloadExportFile,
  getExportFilename,
  serializeFitpicsCsv,
  serializeFitpicsJson,
  serializeSavedOutfitsCsv,
  serializeSavedOutfitsJson
} from "./lib/metadataExport";
import { buildBackupPackageZip } from "./lib/backupPackageV2.js";
import {
  buildOaAiExportBundle,
  createDefaultOaAiExportOptions
} from "./lib/oaAiExport.js";
import {
  getWardrobePreviewDirectionForKey,
  getWardrobePreviewImageNavigation,
  getWardrobePreviewNavigation
} from "./lib/wardrobePreviewNavigation";
import { downloadFitpicImageExport, renderFitpicImageExport } from "./lib/fitpicImageExport.js";
import { downloadWardrobeImageExport, renderWardrobeImageExport } from "./lib/wardrobeImageExport.js";

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
const imageMetricsCacheByUrl = new Map();
const pendingImageMetricsLoads = new Map();
const pendingImageMetricsLoadsByUrl = new Map();

function getOaPerfNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getOaGenerationPerfState() {
  if (typeof window === "undefined") {
    return null;
  }

  const perfEnabled = Boolean(window.__OA_GENERATION_PERF__)
    || window.location?.search?.includes("oaPerf=1")
    || window.localStorage?.getItem?.("oaGenerationPerf") === "true";

  if (!perfEnabled) {
    return null;
  }

  if (!window.__OA_GENERATION_PERF_STATE__) {
    window.__OA_GENERATION_PERF_STATE__ = {
      nextInteractionId: 0,
      activeBySlot: {},
      interactions: {},
      recentEntries: [],
      counters: {
        resolveImageUrlCalls: 0,
        resolveImageUrlBySource: {},
        loadImageMetricsCalls: 0,
        imageMetricsCacheHits: 0,
        imageMetricsCacheMisses: 0,
        imageMetricsDecodeMs: 0,
        imageMetricsDecodeCount: 0,
        saveQueuedCount: 0,
        saveWriteCount: 0,
        saveWriteMs: 0
      }
    };
  }

  return window.__OA_GENERATION_PERF_STATE__;
}

function noteOaPerfCounter(name, delta = 1) {
  const perfState = getOaGenerationPerfState();
  if (!perfState) {
    return;
  }

  perfState.counters[name] = (perfState.counters[name] ?? 0) + delta;
}

function noteOaPerfResolve(context = null) {
  const perfState = getOaGenerationPerfState();
  if (!perfState) {
    return;
  }

  perfState.counters.resolveImageUrlCalls += 1;

  const source = typeof context?.source === "string" && context.source.trim()
    ? context.source.trim()
    : "unknown";
  perfState.counters.resolveImageUrlBySource[source] = (perfState.counters.resolveImageUrlBySource[source] ?? 0) + 1;

  const interactionId = typeof context?.interactionId === "string"
    ? context.interactionId
    : typeof context?.slot === "string"
      ? perfState.activeBySlot[context.slot] ?? null
      : null;
  const interaction = interactionId ? perfState.interactions[interactionId] : null;

  if (!interaction) {
    return;
  }

  interaction.resolveCalls = (interaction.resolveCalls ?? 0) + 1;
  interaction.resolveSources[source] = (interaction.resolveSources[source] ?? 0) + 1;
}

function startOaPerfInteraction(kind, slot, metadata = {}) {
  const perfState = getOaGenerationPerfState();
  if (!perfState) {
    return null;
  }

  perfState.nextInteractionId += 1;
  const interactionId = `oa-perf-${perfState.nextInteractionId}`;
  perfState.interactions[interactionId] = {
    id: interactionId,
    kind,
    slot,
    startedAt: getOaPerfNow(),
    clickCount: 1,
    metadata: { ...metadata },
    poolMs: 0,
    scoreMs: 0,
    poolCalls: 0,
    poolSizes: [],
    poolSourceItems: 0,
    resolveCalls: 0,
    resolveSources: {},
    cacheHits: 0,
    cacheMisses: 0,
    decodeMs: 0,
    saveQueued: false,
    saveWritesDelta: 0,
    saveWriteMsDelta: 0,
    renderCountStart: 0,
    renderCountAtStateCommit: 0,
    renderCountAtPaint: 0,
    renderDelta: 0
  };
  perfState.activeBySlot[slot] = interactionId;

  return interactionId;
}

function getOaPerfInteraction(interactionId) {
  const perfState = getOaGenerationPerfState();
  if (!perfState || !interactionId) {
    return null;
  }

  return perfState.interactions[interactionId] ?? null;
}

function updateOaPerfInteraction(interactionId, updater) {
  const perfState = getOaGenerationPerfState();
  if (!perfState || !interactionId) {
    return;
  }

  const interaction = perfState.interactions[interactionId];
  if (!interaction) {
    return;
  }

  updater(interaction, perfState);
}

function completeOaPerfInteraction(interactionId, summary = {}) {
  const perfState = getOaGenerationPerfState();
  if (!perfState || !interactionId) {
    return;
  }

  const interaction = perfState.interactions[interactionId];
  if (!interaction || interaction.completedAt) {
    return;
  }

  interaction.completedAt = getOaPerfNow();
  Object.assign(interaction, summary);

  const totalMs = interaction.completedAt - interaction.startedAt;
  const stateMs = interaction.stateCommittedAt ? interaction.stateCommittedAt - interaction.startedAt : 0;
  const imageReadyAnchorAt = interaction.imageReadyAt || interaction.stateCommittedAt || 0;
  const imageReadyMs = interaction.imageReadyAt && interaction.stateCommittedAt
    ? interaction.imageReadyAt - interaction.stateCommittedAt
    : 0;
  const paintMs = interaction.paintAt && imageReadyAnchorAt
    ? interaction.paintAt - imageReadyAnchorAt
    : 0;
  const saveQueuedLabel = interaction.saveQueued ? "yes" : "no";
  const poolSizeLabel = interaction.poolSizes.length ? interaction.poolSizes[interaction.poolSizes.length - 1] : 0;
  const clickCountLabel = interaction.clickCount > 1 ? ` clicks=${interaction.clickCount}` : "";

  const line = `[OA perf] ${interaction.kind} ${interaction.slot} total=${totalMs.toFixed(1)}ms pool=${interaction.poolMs.toFixed(1)}ms score=${interaction.scoreMs.toFixed(1)}ms state=${stateMs.toFixed(1)}ms decode=${interaction.decodeMs.toFixed(1)}ms imageReady=${imageReadyMs.toFixed(1)}ms paint=${paintMs.toFixed(1)}ms resolve=${interaction.resolveCalls} poolSize=${poolSizeLabel} items=${interaction.poolSourceItems} saves=${saveQueuedLabel}/${interaction.saveWritesDelta} renders=${interaction.renderDelta}${clickCountLabel}`;

  perfState.recentEntries.push({
    ...interaction,
    totalMs,
    line
  });
  perfState.recentEntries = perfState.recentEntries.slice(-200);

  if (perfState.activeBySlot[interaction.slot] === interactionId) {
    delete perfState.activeBySlot[interaction.slot];
  }

  console.log(line);
}

function noteOaPerfStorageEvent(type, payload = {}) {
  const perfState = getOaGenerationPerfState();
  if (!perfState) {
    return;
  }

  if (type === "saveQueued") {
    perfState.counters.saveQueuedCount += 1;
  } else if (type === "saveWriteComplete") {
    perfState.counters.saveWriteCount += 1;
    perfState.counters.saveWriteMs += Number(payload.durationMs) || 0;
  }

  const activeInteractions = Object.values(perfState.activeBySlot);
  activeInteractions.forEach((interactionId) => {
    updateOaPerfInteraction(interactionId, (interaction) => {
      if (type === "saveQueued") {
        interaction.saveQueued = true;
      } else if (type === "saveWriteComplete") {
        interaction.saveWritesDelta += 1;
        interaction.saveWriteMsDelta += Number(payload.durationMs) || 0;
      }
    });
  });
}

function resolveImageUrl(imageUrl, context = null) {
  noteOaPerfResolve(context);

  if (!imageUrl || imageUrl.startsWith("data:") || /^https?:\/\//.test(imageUrl)) {
    return imageUrl;
  }

  if (!imageUrl.startsWith("/images/") && !imageUrl.startsWith("/assets/")) {
    return imageUrl;
  }

  const filename = getImageFilename(imageUrl);
  return imageUrlByFilename[filename] ?? imageUrlByFilename[stripViteHash(filename)] ?? imageUrl;
}

function getManagedImageMetricsCacheKey(item, resolvedImageUrl) {
  const activeItemImage = getActiveWardrobeItemImage(item);
  const activeAsset = getActiveWardrobeItemImageAsset(item);

  return buildManagedImageMetricsCacheKey({
    resolvedImageUrl,
    assetUuid: activeAsset?.assetUuid ?? "",
    itemImageUuid: activeItemImage?.itemImageUuid ?? "",
    itemUuid: item?.itemUuid ?? "",
    itemId: item?.id ?? ""
  });
}

function getCachedImageMetrics(cacheKey, resolvedImageUrl) {
  if (cacheKey && imageMetricsCache.has(cacheKey)) {
    return imageMetricsCache.get(cacheKey);
  }

  if (resolvedImageUrl && imageMetricsCacheByUrl.has(resolvedImageUrl)) {
    return imageMetricsCacheByUrl.get(resolvedImageUrl);
  }

  return null;
}

function cacheImageMetrics(cacheKey, resolvedImageUrl, metrics) {
  if (cacheKey) {
    imageMetricsCache.set(cacheKey, metrics);
  }

  if (resolvedImageUrl) {
    imageMetricsCacheByUrl.set(resolvedImageUrl, metrics);
  }
}

function loadImageMetrics(resolvedImageUrl, context = null) {
  noteOaPerfCounter("loadImageMetricsCalls");
  const cacheKey = typeof context?.cacheKey === "string" ? context.cacheKey : "";

  if (!resolvedImageUrl) {
    return Promise.resolve({ naturalWidth: 1, naturalHeight: 1 });
  }

  const cachedMetrics = getCachedImageMetrics(cacheKey, resolvedImageUrl);
  if (cachedMetrics) {
    noteOaPerfCounter("imageMetricsCacheHits");
    if (context?.interactionId) {
      updateOaPerfInteraction(context.interactionId, (interaction) => {
        interaction.cacheHits += 1;
      });
    }
    return Promise.resolve(cachedMetrics);
  }

  const pendingLoad = (cacheKey && pendingImageMetricsLoads.get(cacheKey)) || pendingImageMetricsLoadsByUrl.get(resolvedImageUrl);
  if (pendingLoad) {
    return pendingLoad;
  }

  noteOaPerfCounter("imageMetricsCacheMisses");
  if (context?.interactionId) {
    updateOaPerfInteraction(context.interactionId, (interaction) => {
      interaction.cacheMisses += 1;
    });
  }

  const metricsPromise = new Promise((resolve) => {
    const image = new Image();
    const startedAt = getOaPerfNow();

    const finalize = (metrics) => {
      const durationMs = getOaPerfNow() - startedAt;
      cacheImageMetrics(cacheKey, resolvedImageUrl, metrics);
      if (cacheKey) {
        pendingImageMetricsLoads.delete(cacheKey);
      }
      pendingImageMetricsLoadsByUrl.delete(resolvedImageUrl);
      noteOaPerfCounter("imageMetricsDecodeMs", durationMs);
      noteOaPerfCounter("imageMetricsDecodeCount");
      if (context?.interactionId) {
        updateOaPerfInteraction(context.interactionId, (interaction) => {
          interaction.decodeMs += durationMs;
        });
      }
      resolve(metrics);
    };

    image.onload = () => {
      const nextMetrics = {
        naturalWidth: Math.max(image.naturalWidth || 1, 1),
        naturalHeight: Math.max(image.naturalHeight || 1, 1)
      };

      if (typeof image.decode === "function") {
        image.decode().catch(() => undefined).finally(() => finalize(nextMetrics));
        return;
      }

      finalize(nextMetrics);
    };

    image.onerror = () => {
      finalize({ naturalWidth: 1, naturalHeight: 1 });
    };

    image.decoding = "async";
    image.src = resolvedImageUrl;
  });

  if (cacheKey) {
    pendingImageMetricsLoads.set(cacheKey, metricsPromise);
  }
  pendingImageMetricsLoadsByUrl.set(resolvedImageUrl, metricsPromise);
  return metricsPromise;
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

function scheduleIdleWork(callback, timeout = 150) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return {
      kind: "idle",
      id: window.requestIdleCallback(callback, { timeout })
    };
  }

  return {
    kind: "timeout",
    id: window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), timeout)
  };
}

function cancelScheduledIdleWork(handle) {
  if (!handle) {
    return;
  }

  if (handle.kind === "idle" && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle.id);
    return;
  }

  window.clearTimeout(handle.id);
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
const defaultFitpicFilterSectionsOpen = {
  tags: false,
  linkedItem: false,
  brand: false,
  garmentType: false,
  type: false,
  status: false,
  collections: false,
  favorite: false
};
const defaultOutfitFilterSectionsOpen = {
  climate: false,
  style: false,
  collections: false,
  status: false
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

function useImageMetrics(imageUrl, metricsCacheKey = "", perfContext = null) {
  const resolvedImageUrl = resolveImageUrl(
    imageUrl?.trim?.() ?? imageUrl ?? "",
    perfContext ? { ...perfContext, source: `${perfContext.source || "useImageMetrics"}:resolve` } : null
  );
  const cacheIdentity = `${metricsCacheKey}::${resolvedImageUrl}`;
  const cachedMetrics = getCachedImageMetrics(metricsCacheKey, resolvedImageUrl);
  const [metricsState, setMetricsState] = useState(() => ({
    identity: cacheIdentity,
    metrics: cachedMetrics ?? null
  }));

  useEffect(() => {
    if (!resolvedImageUrl) {
      setMetricsState((current) => (
        current.identity === cacheIdentity && current.metrics === null
          ? current
          : { identity: cacheIdentity, metrics: null }
      ));
      return undefined;
    }

    if (cachedMetrics) {
      return undefined;
    }

    setMetricsState((current) => (
      current.identity === cacheIdentity && current.metrics === null
        ? current
        : { identity: cacheIdentity, metrics: null }
    ));

    let cancelled = false;
    loadImageMetrics(resolvedImageUrl, {
      ...perfContext,
      cacheKey: metricsCacheKey
    }).then((nextMetrics) => {
      if (!cancelled) {
        setMetricsState((current) => {
          if (
            current.identity === cacheIdentity &&
            current.metrics?.naturalWidth === nextMetrics.naturalWidth &&
            current.metrics?.naturalHeight === nextMetrics.naturalHeight
          ) {
            return current;
          }

          return {
            identity: cacheIdentity,
            metrics: nextMetrics
          };
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheIdentity, cachedMetrics, metricsCacheKey, resolvedImageUrl]);

  return cachedMetrics ?? (
    metricsState.identity === cacheIdentity
      ? metricsState.metrics
      : null
  ) ?? { naturalWidth: 1, naturalHeight: 1 };
}

function getManagedImagePlaceholderAspect(perfSlot, item) {
  if (perfSlot === "Headwear" || item?.garmentType === "Headwear") {
    return 1.4;
  }

  if (perfSlot === "Bottom" || item?.garmentType === "Bottom") {
    return 0.72;
  }

  if (perfSlot === "Footwear" || item?.garmentType === "Footwear") {
    return 1.45;
  }

  return 0.82;
}

const ManagedItemImage = memo(function ManagedItemImage({ item, alt = "", className = "", frameRef = null, imageRef = null, dataItemId = "", useFrameScale = false, normalizeToFrameScale = false, useCrop = false, usePresentation = false, perfSlot = null }) {
  const perfInteractionId = perfSlot ? getOaGenerationPerfState()?.activeBySlot?.[perfSlot] ?? null : null;
  const perfContext = perfSlot
    ? {
        slot: perfSlot,
        interactionId: perfInteractionId,
        source: "ManagedItemImage"
      }
    : null;
  const targetImageUrl = resolveImageUrl(item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "", perfContext ? { ...perfContext, source: "ManagedItemImage:target" } : null);
  const targetMetricsCacheKey = getManagedImageMetricsCacheKey(item, targetImageUrl);
  const targetReadyKey = `${targetMetricsCacheKey}::${targetImageUrl}`;
  const renderIdentityKey = targetReadyKey || item?.id || dataItemId || perfSlot || "managed-image";
  const hasTargetMetrics = Boolean(getCachedImageMetrics(targetMetricsCacheKey, targetImageUrl));
  const usesGenerationPlaceholder = Boolean(perfSlot);
  const [displayedImageUrl, setDisplayedImageUrl] = useState(() => (hasTargetMetrics ? targetImageUrl : ""));
  const [displayedMetricsCacheKey, setDisplayedMetricsCacheKey] = useState(() => (hasTargetMetrics ? targetMetricsCacheKey : ""));
  const [readyTargetKey, setReadyTargetKey] = useState(() => (hasTargetMetrics ? targetReadyKey : ""));
  const isTargetReady = hasTargetMetrics || readyTargetKey === targetReadyKey;
  const activeImageUrl = usesGenerationPlaceholder
    ? (isTargetReady ? targetImageUrl : "")
    : (hasTargetMetrics ? targetImageUrl : displayedImageUrl);
  const activeMetricsCacheKey = usesGenerationPlaceholder
    ? (isTargetReady ? targetMetricsCacheKey : "")
    : (hasTargetMetrics ? targetMetricsCacheKey : displayedMetricsCacheKey);
  const metrics = useImageMetrics(activeImageUrl, activeMetricsCacheKey, perfContext);

  useEffect(() => {
    if (!targetImageUrl) {
      setDisplayedImageUrl("");
      setDisplayedMetricsCacheKey("");
      setReadyTargetKey("");
      return undefined;
    }

    if (hasTargetMetrics) {
      setReadyTargetKey(targetReadyKey);
      return undefined;
    }

    let cancelled = false;

    loadImageMetrics(targetImageUrl, {
      ...perfContext,
      cacheKey: targetMetricsCacheKey
    }).then(() => {
      if (!cancelled) {
        setReadyTargetKey(targetReadyKey);
        if (!usesGenerationPlaceholder) {
          setDisplayedImageUrl(targetImageUrl);
          setDisplayedMetricsCacheKey(targetMetricsCacheKey);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasTargetMetrics, targetImageUrl, targetMetricsCacheKey, targetReadyKey, usesGenerationPlaceholder]);

  useEffect(() => {
    if (!perfSlot || !targetImageUrl || activeImageUrl !== targetImageUrl) {
      return undefined;
    }

    const activeInteractionId = getOaGenerationPerfState()?.activeBySlot?.[perfSlot] ?? perfInteractionId;
    if (!activeInteractionId) {
      return undefined;
    }

    updateOaPerfInteraction(activeInteractionId, (interaction) => {
      interaction.imageReadyAt = getOaPerfNow();
    });

    const frameId = window.requestAnimationFrame(() => {
      updateOaPerfInteraction(activeInteractionId, (interaction) => {
        interaction.paintAt = getOaPerfNow();
      });
      completeOaPerfInteraction(activeInteractionId);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeImageUrl, perfInteractionId, perfSlot, targetImageUrl]);

  if (!usePresentation && !activeImageUrl) {
    return null;
  }

  if (!usePresentation) {
    return (
      <img
        ref={imageRef}
        src={activeImageUrl}
        alt={alt}
        decoding="async"
        className={`managed-image managed-image-plain ${className}`.trim()}
        data-item-id={dataItemId || item?.id || ""}
      />
    );
  }

  if (!activeImageUrl) {
    return (
      <span
        key={`empty:${renderIdentityKey}`}
        ref={frameRef}
        aria-hidden="true"
        className={`managed-image managed-image-empty ${className}`.trim()}
        style={{
          ...getItemImageStyle(item, { useFrameScale, normalizeToFrameScale, usePresentation }),
          aspectRatio: `${getManagedImagePlaceholderAspect(perfSlot, item)}`
        }}
        data-item-id={dataItemId || item?.id || ""}
      />
    );
  }

  return (
      <span
        key={`image:${renderIdentityKey}`}
        ref={frameRef}
        className={`managed-image ${className}`.trim()}
        style={getManagedImageFrameStyle(item, metrics, { useFrameScale, normalizeToFrameScale, useCrop, usePresentation })}
        data-item-id={dataItemId || item?.id || ""}
      >
        <img
          ref={imageRef}
          src={activeImageUrl}
          alt={alt}
          decoding="async"
          className="managed-image-content"
        />
      </span>
  );
}, (previousProps, nextProps) => (
  previousProps.item === nextProps.item
  && previousProps.alt === nextProps.alt
  && previousProps.className === nextProps.className
  && previousProps.frameRef === nextProps.frameRef
  && previousProps.imageRef === nextProps.imageRef
  && previousProps.dataItemId === nextProps.dataItemId
  && previousProps.useFrameScale === nextProps.useFrameScale
  && previousProps.normalizeToFrameScale === nextProps.normalizeToFrameScale
  && previousProps.useCrop === nextProps.useCrop
  && previousProps.usePresentation === nextProps.usePresentation
  && previousProps.perfSlot === nextProps.perfSlot
));

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
  return [...new Set(value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase()))].map((normalizedTag) =>
      value
        .split(",")
        .map((tag) => tag.trim())
        .find((tag) => tag && tag.toLowerCase() === normalizedTag)
    ).filter(Boolean);
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
  function SlotActionIcon({ kind, locked: isLocked = false }) {
    if (kind === "lock") {
      return isLocked ? (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M5.25 6V4.85a2.75 2.75 0 1 1 5.5 0V6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3.5" y="6" width="9" height="6.75" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M10.8 6V4.9a2.75 2.75 0 1 0-5.5 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.8 6H6.4a1.7 1.7 0 0 0-1.7 1.7v3.35a1.7 1.7 0 0 0 1.7 1.7h5.15a1.7 1.7 0 0 0 1.7-1.7V7.7A1.7 1.7 0 0 0 11.55 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (kind === "reroll") {
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M12.5 5.75V2.9H9.65" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.25 3.2A5.25 5.25 0 1 0 13 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (kind === "previous") {
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M9.75 3.75 5.25 8l4.5 4.25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (kind === "next") {
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="m6.25 3.75 4.5 4.25-4.5 4.25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (kind === "remove") {
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M5 4.5h6.05M6.15 4.5l.45-1.2h2.8l.45 1.2M5.55 6.1v5.35M8 6.1v5.35M10.45 6.1v5.35M4.6 4.5h6.8v7a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4v-7Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="m4.25 4.25 7.5 7.5M11.75 4.25l-7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  const outfitSectionTabs = [
    ["saved", "Saved"],
    ["fitpics", "Fitpics"]
  ];
  const editorRef = useRef(null);
  const importBackupRef = useRef(null);
  const fitpicUploadInputRef = useRef(null);
  const fitpicGroupedUploadInputRef = useRef(null);
  const fitpicReplaceInputRef = useRef(null);
  const fitpicAddImagesInputRef = useRef(null);
  const outfitStageRef = useRef(null);
  const pickerOverlayRef = useRef(null);
  const slotActionsPopoverRef = useRef(null);
  const inlineEditorResizeRef = useRef(null);
  const outfitDebugRef = useRef(null);
  const workspaceTabsRef = useRef(null);
  const editorImageFrameRef = useRef(null);
  const editorImageRef = useRef(null);
  const paletteCacheRef = useRef(new Map());
  const generatePointerHandledAtRef = useRef(-1);
  const generateInFlightRef = useRef(false);
  const generateAwaitingPaintRef = useRef(false);
  const pendingGenerateRef = useRef(false);
  const pendingGenerateFrameRef = useRef(null);
  const generateReleaseFrameRef = useRef(null);
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
  const [selectedSavedOutfitIds, setSelectedSavedOutfitIds] = useState([]);
  const [savedOutfitSelectionAnchorId, setSavedOutfitSelectionAnchorId] = useState(null);
  const [editingSavedOutfitId, setEditingSavedOutfitId] = useState(null);
  const [savedOutfitDraft, setSavedOutfitDraft] = useState({
    name: "",
    description: "",
    tagsText: "",
    favorite: false
  });
  const [savedOutfitSearch, setSavedOutfitSearch] = useState("");
  const [savedOutfitSort, setSavedOutfitSort] = useState("updatedNewest");
  const [savedOutfitFavoritesOnly, setSavedOutfitFavoritesOnly] = useState(false);
  const [savedOutfitTagFilter, setSavedOutfitTagFilter] = useState("");
  const [activeAccessorySlot, setActiveAccessorySlot] = useState(null);
  const [activeOutfitSlot, setActiveOutfitSlot] = useState(null);
  const [activeSlotActionsSlot, setActiveSlotActionsSlot] = useState(null);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [selectorSort, setSelectorSort] = useState(DEFAULT_SELECTOR_SORT);
  const [selectorFilters, setSelectorFilters] = useState(createEmptySelectorFilters);
  const [selectorFiltersOpen, setSelectorFiltersOpen] = useState(false);
  const [selectedAccessorySlot, setSelectedAccessorySlot] = useState(null);
  const [selectedOutfitSlot, setSelectedOutfitSlot] = useState(null);
  const [pickerAnchorSlot, setPickerAnchorSlot] = useState(null);
  const [fitpicPreview, setFitpicPreview] = useState(null);
  const [fitpicPreviewImageIndex, setFitpicPreviewImageIndex] = useState(0);
  const [editingFitpicId, setEditingFitpicId] = useState(null);
  const [fitpicDraft, setFitpicDraft] = useState({
    name: "",
    description: "",
    tags: [],
    tagInput: "",
    favorite: false,
    fitDate: "",
    fitpicImages: [],
    primaryImageUuid: null,
    linkedItemUuids: [],
    linkedItemIds: [],
    linkedItemSearch: ""
  });
  const [fitpicImportError, setFitpicImportError] = useState("");
  const [fitpicImporting, setFitpicImporting] = useState(false);
  const [fitpicDropActive, setFitpicDropActive] = useState(false);
  const [fitpicSearch, setFitpicSearch] = useState("");
  const [fitpicSort, setFitpicSort] = useState("fitDateNewest");
  const [fitpicFiltersOpen, setFitpicFiltersOpen] = useState(false);
  const [fitpicFilterSearch, setFitpicFilterSearch] = useState("");
  const [fitpicFilterSectionsOpen, setFitpicFilterSectionsOpen] = useState(defaultFitpicFilterSectionsOpen);
  const [fitpicFilters, setFitpicFilters] = useState(emptyFitpicFilters);
  const [selectedFitpicIds, setSelectedFitpicIds] = useState([]);
  const [fitpicSelectionAnchorId, setFitpicSelectionAnchorId] = useState(null);
  const [wardrobePreviewItemId, setWardrobePreviewItemId] = useState(null);
  const [wardrobePreviewItemImageUuid, setWardrobePreviewItemImageUuid] = useState(null);
  const [wardrobePreviewReturnFitpicPreview, setWardrobePreviewReturnFitpicPreview] = useState(null);
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
  const [fitpicExportOptions, setFitpicExportOptions] = useState(null);
  const [oaAiExportOptions, setOaAiExportOptions] = useState(null);
  const [oaAiExporting, setOaAiExporting] = useState(false);
  const [wardrobeSearch, setWardrobeSearch] = useState("");
  const [wardrobeFilterSearch, setWardrobeFilterSearch] = useState("");
  const [wardrobeFilterSectionsOpen, setWardrobeFilterSectionsOpen] = useState(defaultWardrobeFilterSectionsOpen);
  const [wardrobeFilters, setWardrobeFilters] = useState(emptyWardrobeFilters);
  const [wardrobeSort, setWardrobeSort] = useState(DEFAULT_WARDROBE_SORT);
  const [savedWardrobeViews, setSavedWardrobeViews] = useState([]);
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
  const [outfitFiltersAdvancedOpen, setOutfitFiltersAdvancedOpen] = useState(false);
  const [outfitFilterSectionsOpen, setOutfitFilterSectionsOpen] = useState(defaultOutfitFilterSectionsOpen);
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
  const savedOutfitSelectClickTimeoutRef = useRef(null);
  const savedOutfitPendingSelectionRef = useRef(null);
  const fitpicSelectClickTimeoutRef = useRef(null);
  const fitpicPendingSelectionRef = useRef(null);
  const outfitItemPreviewClickTimeoutRef = useRef(null);
  const pendingOutfitItemPreviewRef = useRef(null);
  const fitpicDropDepthRef = useRef(0);
  const appRenderCountRef = useRef(0);
  const previousOutfitRef = useRef(outfit);
  const pendingSlotActionQueueRef = useRef(new Map());
  const pendingSlotActionFrameRef = useRef(null);
  const imageMetricsPrewarmHandleRef = useRef(null);
  const outfitPaletteUpdateHandleRef = useRef(null);
  appRenderCountRef.current += 1;

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  );
  const fitpicsById = useMemo(
    () => Object.fromEntries(fitpics.map((fitpic) => [fitpic.id, fitpic])),
    [fitpics]
  );
  const savedOutfitsById = useMemo(
    () => Object.fromEntries(savedOutfits.map((savedOutfit) => [savedOutfit.id, savedOutfit])),
    [savedOutfits]
  );
  const wardrobePreviewItem = wardrobePreviewItemId ? itemsById[wardrobePreviewItemId] ?? null : null;
  const wardrobePreviewImages = useMemo(
    () => (wardrobePreviewItem ? getWardrobeItemImages(wardrobePreviewItem) : []),
    [wardrobePreviewItem]
  );
  const wardrobePreviewActiveImage = useMemo(
    () => (wardrobePreviewItem ? getActiveWardrobeItemImage(wardrobePreviewItem) : null),
    [wardrobePreviewItem]
  );
  const wardrobePreviewImageNavigation = useMemo(
    () => getWardrobePreviewImageNavigation(wardrobePreviewImages, wardrobePreviewItemImageUuid),
    [wardrobePreviewImages, wardrobePreviewItemImageUuid]
  );
  const activeWardrobePreviewItemImage = wardrobePreviewImageNavigation.currentItemImage;
  const wardrobePreviewDisplayItem = useMemo(() => {
    if (!wardrobePreviewItem || !activeWardrobePreviewItemImage) {
      return null;
    }

    return mirrorActiveWardrobeImageAssetToLegacyAliases({
      ...wardrobePreviewItem,
      itemImages: wardrobePreviewImages,
      activeItemImageUuid: activeWardrobePreviewItemImage.itemImageUuid
    });
  }, [activeWardrobePreviewItemImage, wardrobePreviewImages, wardrobePreviewItem]);
  const wardrobePreviewDisplayAsset = useMemo(() => {
    if (!wardrobePreviewItem || !activeWardrobePreviewItemImage) {
      return null;
    }

    return getActiveWardrobeItemImageAsset({
      ...wardrobePreviewItem,
      itemImages: wardrobePreviewImages,
      activeItemImageUuid: activeWardrobePreviewItemImage.itemImageUuid
    });
  }, [activeWardrobePreviewItemImage, wardrobePreviewImages, wardrobePreviewItem]);
  const isWardrobePreviewItemEquipped = wardrobePreviewItem
    ? Object.values(outfit).includes(wardrobePreviewItem.id)
    : false;
  const editingFitpic = editingFitpicId ? fitpics.find((fitpic) => fitpic.id === editingFitpicId) ?? null : null;
  const editingFitpicLinkedItems = useMemo(
    () => resolveFitpicLinkedItems(fitpicDraft.linkedItemUuids, fitpicDraft.linkedItemIds, items),
    [fitpicDraft.linkedItemIds, fitpicDraft.linkedItemUuids, items]
  );
  const fitpicPreviewLinkedItems = useMemo(
    () => fitpicPreview
      ? resolveFitpicLinkedItems(fitpicPreview.linkedItemUuids, fitpicPreview.linkedItemIds, items)
      : [],
    [fitpicPreview, items]
  );
  const editingFitpicImages = useMemo(
    () => Array.isArray(fitpicDraft.fitpicImages) ? fitpicDraft.fitpicImages : [],
    [fitpicDraft.fitpicImages]
  );
  const editingFitpicPrimaryImage = useMemo(
    () => editingFitpicImages.find((fitpicImage) => fitpicImage.fitpicImageUuid === fitpicDraft.primaryImageUuid)
      ?? editingFitpicImages[0]
      ?? null,
    [editingFitpicImages, fitpicDraft.primaryImageUuid]
  );
  const fitpicPreviewImages = useMemo(
    () => (fitpicPreview ? getFitpicImages(fitpicPreview) : []),
    [fitpicPreview]
  );
  const fitpicPreviewPrimaryImage = useMemo(
    () => (fitpicPreview ? getPrimaryFitpicImage(fitpicPreview) : null),
    [fitpicPreview]
  );
  const activePreviewFitpicImage = fitpicPreviewImages[fitpicPreviewImageIndex]
    ?? fitpicPreviewPrimaryImage
    ?? fitpicPreviewImages[0]
    ?? null;
  const fitpicLinkedItemSearch = fitpicDraft.linkedItemSearch.trim().toLowerCase();
  const fitpicLinkedItemSuggestions = useMemo(() => {
    if (!editingFitpic) {
      return [];
    }

    return items
      .filter((item) => {
        const alreadyLinkedByUuid = item.itemUuid && fitpicDraft.linkedItemUuids.includes(item.itemUuid);
        const alreadyLinkedById = fitpicDraft.linkedItemIds.includes(item.id);

        if (alreadyLinkedByUuid || alreadyLinkedById) {
          return false;
        }

        if (!fitpicLinkedItemSearch) {
          return false;
        }

        const searchText = `${buildDisplayName(item)} ${item.id} ${getWardrobeSearchText(item)}`.toLowerCase();
        return searchText.includes(fitpicLinkedItemSearch);
      })
      .slice(0, 8);
  }, [editingFitpic, fitpicDraft.linkedItemIds, fitpicDraft.linkedItemUuids, fitpicLinkedItemSearch, items]);
  const activeFitpicFilterCount = Object.entries(fitpicFilters).reduce(
    (count, [key, value]) =>
      count + (
        fitpicMultiValueFilterKeys.includes(key) || fitpicExcludedMultiValueFilterKeys.includes(key)
          ? value.length
          : value
            ? 1
            : 0
      ),
    0
  );
  const hasActiveFitpicFilters = activeFitpicFilterCount > 0;
  const fitpicFilterOptions = useMemo(
    () => getFitpicFilterOptions(fitpics, items, fitpicFilters),
    [fitpicFilters, fitpics, items]
  );
  const fitpicFilterPanelSections = useMemo(
    () => [
      { label: "Tags", key: "tags", options: fitpicFilterOptions.tags, includeNone: true, kind: "multi" },
      { label: "Linked item", key: "linkedItem", options: fitpicFilterOptions.linkedItem, includeNone: false, kind: "multi" },
      { label: "Brand", key: "brand", options: fitpicFilterOptions.brand, includeNone: true, kind: "multi" },
      { label: "Garment", key: "garmentType", options: fitpicFilterOptions.garmentType, includeNone: true, kind: "multi" },
      { label: "Type", key: "type", options: fitpicFilterOptions.type, includeNone: true, kind: "multi" },
      { label: "Status", key: "status", options: fitpicFilterOptions.status, includeNone: false, kind: "multi" },
      { label: "Collections", key: "collections", options: fitpicFilterOptions.collections, includeNone: false, kind: "multi" },
      {
        label: "Favorite",
        key: "favorite",
        options: [
          { label: "Favorites", value: "yes" },
          { label: "Not favorites", value: "no" }
        ],
        includeNone: false,
        kind: "single"
      }
    ],
    [fitpicFilterOptions]
  );
  const fitpicTagFilterGroups = useMemo(
    () => getFitpicTagFilterGroups(fitpicFilterOptions.tags),
    [fitpicFilterOptions.tags]
  );
  const normalizedFitpicFilterSearch = fitpicFilterSearch.trim().toLowerCase();
  const visibleFitpics = useMemo(
    () =>
      filterAndSortFitpics(
        fitpics,
        {
          search: fitpicSearch,
          sort: fitpicSort,
          filters: fitpicFilters
        },
        items
      ),
    [fitpicFilters, fitpicSearch, fitpicSort, fitpics, items]
  );
  const visibleFitpicIds = useMemo(
    () => visibleFitpics.map((fitpic) => fitpic.id),
    [visibleFitpics]
  );
  const fitpicPreviewNavigation = useMemo(
    () => getFitpicPreviewNavigation(visibleFitpicIds, fitpicPreview?.id ?? null),
    [fitpicPreview?.id, visibleFitpicIds]
  );
  const hasActiveFitpicControls = Boolean(
    fitpicSearch.trim() || hasActiveFitpicFilters || fitpicSort !== "fitDateNewest"
  );
  const selectedFitpics = useMemo(
    () => selectedFitpicIds.map((fitpicId) => fitpicsById[fitpicId]).filter(Boolean),
    [fitpicsById, selectedFitpicIds]
  );
  const selectedFitpicCount = selectedFitpicIds.length;
  const hasFitpicSelection = selectedFitpicCount > 0;
  const isSingleFitpicSelected = selectedFitpicCount === 1;
  const areAllSelectedFitpicsFavorite = useMemo(
    () => selectedFitpics.length > 0 && selectedFitpics.every((fitpic) => Boolean(fitpic.favorite)),
    [selectedFitpics]
  );
  const fitpicFavoriteActionLabel = areAllSelectedFitpicsFavorite ? "Unfavorite" : "Favorite";
  const savedOutfitTagFilterOptions = useMemo(
    () => getSavedOutfitTagFilterOptions(savedOutfits),
    [savedOutfits]
  );
  const selectedSavedOutfitTagFilterLabel = useMemo(
    () => savedOutfitTagFilterOptions.find((option) => option.value === savedOutfitTagFilter)?.label ?? "",
    [savedOutfitTagFilter, savedOutfitTagFilterOptions]
  );
  const selectedSavedOutfitSortLabel = useMemo(() => {
    switch (savedOutfitSort) {
      case "createdNewest":
        return "Created newest";
      case "titleAz":
        return "Title A-Z";
      case "updatedNewest":
      default:
        return "Updated newest";
    }
  }, [savedOutfitSort]);
  const visibleSavedOutfits = useMemo(
    () =>
      filterAndSortSavedOutfits(savedOutfits, {
        search: savedOutfitSearch,
        sort: savedOutfitSort,
        favoritesOnly: savedOutfitFavoritesOnly,
        tagFilter: savedOutfitTagFilter
      }),
    [savedOutfitFavoritesOnly, savedOutfitSearch, savedOutfitSort, savedOutfitTagFilter, savedOutfits]
  );
  const hasActiveSavedOutfitControls = Boolean(
    savedOutfitSearch.trim()
    || savedOutfitFavoritesOnly
    || savedOutfitTagFilter
    || savedOutfitSort !== "updatedNewest"
  );
  const activeEditorWindowStateKey = getEditorWindowStateKey(editingId, editorReturnTarget);
  const activeEditorWidth = windowState[activeEditorWindowStateKey]?.width
    ?? defaultWindowState[activeEditorWindowStateKey].width;

  useEffect(() => {
    if (!wardrobePreviewItem) {
      setWardrobePreviewItemImageUuid(null);
      return;
    }

    setWardrobePreviewItemImageUuid(wardrobePreviewActiveImage?.itemImageUuid ?? null);
  }, [wardrobePreviewActiveImage?.itemImageUuid, wardrobePreviewItem?.id]);

  useEffect(() => {
    if (!fitpicPreview) {
      return;
    }

    const nextPreview = fitpics.find((fitpic) => fitpic.id === fitpicPreview.id) ?? null;
    setFitpicPreview(nextPreview);
  }, [fitpicPreview, fitpics]);

  useEffect(() => {
    if (!fitpicPreview) {
      setFitpicPreviewImageIndex(0);
      return;
    }

    const primaryImageUuid = fitpicPreviewPrimaryImage?.fitpicImageUuid ?? "";
    const primaryImageIndex = primaryImageUuid
      ? fitpicPreviewImages.findIndex((fitpicImage) => fitpicImage.fitpicImageUuid === primaryImageUuid)
      : -1;

    setFitpicPreviewImageIndex(primaryImageIndex >= 0 ? primaryImageIndex : 0);
  }, [fitpicPreview?.id]);

  useEffect(() => {
    if (!fitpicPreviewImages.length) {
      if (fitpicPreviewImageIndex !== 0) {
        setFitpicPreviewImageIndex(0);
      }
      return;
    }

    if (fitpicPreviewImageIndex < fitpicPreviewImages.length) {
      return;
    }

    setFitpicPreviewImageIndex(fitpicPreviewImages.length - 1);
  }, [fitpicPreviewImageIndex, fitpicPreviewImages]);

  useEffect(() => {
    setSelectorSearch("");
    setSelectorSort(DEFAULT_SELECTOR_SORT);
    setSelectorFilters(createEmptySelectorFilters());
    setSelectorFiltersOpen(false);
  }, [activeOutfitSlot]);

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
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__OA_GENERATION_PERF_EMIT__ = noteOaPerfStorageEvent;
    window.__OA_GENERATION_PERF_GET_STATE__ = () => getOaGenerationPerfState();
    window.__OA_GENERATION_PERF_RESET__ = () => {
      if (window.__OA_GENERATION_PERF_STATE__) {
        window.__OA_GENERATION_PERF_STATE__ = {
          ...window.__OA_GENERATION_PERF_STATE__,
          activeBySlot: {},
          interactions: {},
          recentEntries: [],
          counters: {
            resolveImageUrlCalls: 0,
            resolveImageUrlBySource: {},
            loadImageMetricsCalls: 0,
            imageMetricsCacheHits: 0,
            imageMetricsCacheMisses: 0,
            imageMetricsDecodeMs: 0,
            imageMetricsDecodeCount: 0,
            saveQueuedCount: 0,
            saveWriteCount: 0,
            saveWriteMs: 0
          }
        };
      }

      return window.__OA_GENERATION_PERF_STATE__ ?? null;
    };
    window.__OA_GENERATION_PERF_SUMMARY__ = () => {
      const perfState = getOaGenerationPerfState();
      if (!perfState) {
        return null;
      }

      return {
        dataset: perfState.dataset ?? null,
        lastGenerationSourceItems: perfState.lastGenerationSourceItems ?? null,
        counters: perfState.counters,
        recentEntries: perfState.recentEntries.slice(-20)
      };
    };

    return () => {
      if (window.__OA_GENERATION_PERF_EMIT__ === noteOaPerfStorageEvent) {
        delete window.__OA_GENERATION_PERF_EMIT__;
      }
      delete window.__OA_GENERATION_PERF_GET_STATE__;
      delete window.__OA_GENERATION_PERF_RESET__;
      delete window.__OA_GENERATION_PERF_SUMMARY__;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (wardrobeSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      }
      wardrobePendingSelectionRef.current = null;

      if (savedOutfitSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      }
      savedOutfitPendingSelectionRef.current = null;

      if (fitpicSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      }
      fitpicPendingSelectionRef.current = null;

      if (outfitItemPreviewClickTimeoutRef.current !== null) {
        window.clearTimeout(outfitItemPreviewClickTimeoutRef.current);
      }
      pendingOutfitItemPreviewRef.current = null;

      if (pendingSlotActionFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingSlotActionFrameRef.current);
      }
      pendingSlotActionQueueRef.current.clear();

      if (pendingGenerateFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingGenerateFrameRef.current);
      }
      pendingGenerateFrameRef.current = null;

      if (generateReleaseFrameRef.current !== null) {
        window.cancelAnimationFrame(generateReleaseFrameRef.current);
      }
      generateReleaseFrameRef.current = null;

      cancelScheduledIdleWork(imageMetricsPrewarmHandleRef.current);
      imageMetricsPrewarmHandleRef.current = null;
      cancelScheduledIdleWork(outfitPaletteUpdateHandleRef.current);
      outfitPaletteUpdateHandleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const perfState = getOaGenerationPerfState();
    const previousOutfit = previousOutfitRef.current;

    if (perfState && previousOutfit !== outfit) {
      Object.entries(perfState.activeBySlot).forEach(([slot, interactionId]) => {
        if (slot === "outfit") {
          updateOaPerfInteraction(interactionId, (interaction) => {
            if (!interaction.stateCommittedAt) {
              interaction.stateCommittedAt = getOaPerfNow();
              interaction.renderCountAtStateCommit = appRenderCountRef.current;
              interaction.renderDelta = Math.max(
                interaction.renderDelta,
                appRenderCountRef.current - (interaction.renderCountStart || 0)
              );
            }
          });
          window.requestAnimationFrame(() => {
            updateOaPerfInteraction(interactionId, (interaction) => {
              interaction.paintAt = getOaPerfNow();
              interaction.renderCountAtPaint = appRenderCountRef.current;
              interaction.renderDelta = Math.max(
                interaction.renderDelta,
                appRenderCountRef.current - (interaction.renderCountStart || 0)
              );
            });
            completeOaPerfInteraction(interactionId);
          });
          return;
        }

        if (previousOutfit?.[slot] === outfit?.[slot]) {
          return;
        }

        updateOaPerfInteraction(interactionId, (interaction) => {
          if (!interaction.stateCommittedAt) {
            interaction.stateCommittedAt = getOaPerfNow();
            interaction.renderCountAtStateCommit = appRenderCountRef.current;
            interaction.renderDelta = Math.max(
              interaction.renderDelta,
              appRenderCountRef.current - (interaction.renderCountStart || 0)
            );
          }
        });

        if (!outfit?.[slot]) {
          window.requestAnimationFrame(() => {
            updateOaPerfInteraction(interactionId, (interaction) => {
              interaction.paintAt = getOaPerfNow();
              interaction.renderCountAtPaint = appRenderCountRef.current;
            });
            completeOaPerfInteraction(interactionId);
          });
        }
      });
    }

    previousOutfitRef.current = outfit;
  }, [outfit]);

  useEffect(() => {
    if (!generateAwaitingPaintRef.current) {
      return undefined;
    }

    generateAwaitingPaintRef.current = false;

    if (generateReleaseFrameRef.current !== null) {
      window.cancelAnimationFrame(generateReleaseFrameRef.current);
    }

    generateReleaseFrameRef.current = window.requestAnimationFrame(() => {
      generateReleaseFrameRef.current = window.requestAnimationFrame(() => {
        generateReleaseFrameRef.current = null;
        generateInFlightRef.current = false;

        if (pendingGenerateRef.current) {
          if (pendingGenerateFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingGenerateFrameRef.current);
          }

          pendingGenerateFrameRef.current = window.requestAnimationFrame(() => {
            pendingGenerateFrameRef.current = null;

            if (generateInFlightRef.current || !pendingGenerateRef.current) {
              return;
            }

            pendingGenerateRef.current = false;
            handleGenerate();
          });
        }
      });
    });

    return () => {
      if (generateReleaseFrameRef.current !== null) {
        window.cancelAnimationFrame(generateReleaseFrameRef.current);
        generateReleaseFrameRef.current = null;
      }
    };
  }, [outfit]);

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
    () => {
      const startedAt = getOaPerfNow();
      const nextItems = items.filter((item) => {
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
      });

      const perfState = getOaGenerationPerfState();
      if (perfState) {
        perfState.lastGenerationSourceItems = {
          computedAt: getOaPerfNow(),
          durationMs: getOaPerfNow() - startedAt,
          itemCount: nextItems.length,
          sourceCount: items.length
        };
      }

      return nextItems;
    },
    [items, outfitFilters.collections, outfitFilters.collectionsExcluded]
  );

  useEffect(() => {
    const perfState = getOaGenerationPerfState();
    if (!perfState) {
      return;
    }

    const imageUrls = items
      .map((item) => item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "")
      .filter(Boolean);
    const dataUrls = imageUrls.filter((value) => value.startsWith("data:image/"));
    const resolvedAssetUrls = imageUrls.filter((value) => value.startsWith("/images/") || value.startsWith("/assets/"));

    perfState.dataset = {
      itemCount: items.length,
      generationSourceItemCount: generationSourceItems.length,
      dataUrlCount: dataUrls.length,
      resolvedAssetUrlCount: resolvedAssetUrls.length,
      averageDataUrlLength: dataUrls.length
        ? Math.round(dataUrls.reduce((sum, value) => sum + value.length, 0) / dataUrls.length)
        : 0,
      maxDataUrlLength: dataUrls.length
        ? Math.max(...dataUrls.map((value) => value.length))
        : 0
    };
  }, [generationSourceItems.length, items]);

  useEffect(() => {
    const prewarmCandidatesById = new Map();

    const addCandidate = (item) => {
      if (!item?.id || prewarmCandidatesById.has(item.id)) {
        return;
      }

      const imageUrl = item?.imageUrl?.trim?.() ?? item?.imageUrl ?? "";
      if (!imageUrl) {
        return;
      }

      prewarmCandidatesById.set(item.id, item);
    };

    currentOutfitItems.forEach(addCandidate);

    visibleSlots.forEach((slot) => {
      const options = getEligibleSlotPool(
        generationSourceItems,
        slot,
        excluded,
        generationLists,
        layering,
        outfitFilters,
        weatherData,
        outfit,
        itemsById
      );

      if (!options.length) {
        return;
      }

      const currentIndex = options.findIndex((item) => item.id === outfit[slot]);
      const candidateIndices = currentIndex === -1
        ? [0, 1, 2, 3]
        : [currentIndex, currentIndex + 1, currentIndex - 1, currentIndex + 2, currentIndex - 2];

      candidateIndices.forEach((index) => {
        if (index < 0 || index >= options.length) {
          return;
        }

        addCandidate(options[index]);
      });
    });

    const prewarmQueue = Array.from(prewarmCandidatesById.values()).filter((item) => {
      const resolvedImageUrl = resolveImageUrl(item.imageUrl, { source: "prewarm:resolve" });
      const cacheKey = getManagedImageMetricsCacheKey(item, resolvedImageUrl);
      return !getCachedImageMetrics(cacheKey, resolvedImageUrl);
    });

    cancelScheduledIdleWork(imageMetricsPrewarmHandleRef.current);
    imageMetricsPrewarmHandleRef.current = null;

    if (!prewarmQueue.length) {
      return undefined;
    }

    let cancelled = false;
    let nextIndex = 0;
    let inFlight = false;

    const scheduleNext = () => {
      if (cancelled || nextIndex >= prewarmQueue.length || inFlight) {
        return;
      }

      imageMetricsPrewarmHandleRef.current = scheduleIdleWork(async (deadline) => {
        imageMetricsPrewarmHandleRef.current = null;

        if (cancelled || inFlight) {
          return;
        }

        if (!deadline.didTimeout && typeof deadline.timeRemaining === "function" && deadline.timeRemaining() < 6) {
          scheduleNext();
          return;
        }

        const item = prewarmQueue[nextIndex];
        nextIndex += 1;
        const resolvedImageUrl = resolveImageUrl(item.imageUrl, { source: "prewarm:resolve" });
        const cacheKey = getManagedImageMetricsCacheKey(item, resolvedImageUrl);
        inFlight = true;

        try {
          await loadImageMetrics(resolvedImageUrl, {
            cacheKey,
            source: "prewarm"
          });
        } finally {
          inFlight = false;
          scheduleNext();
        }
      }, 180);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      cancelScheduledIdleWork(imageMetricsPrewarmHandleRef.current);
      imageMetricsPrewarmHandleRef.current = null;
    };
  }, [
    currentOutfitItems,
    excluded,
    generationLists,
    generationSourceItems,
    itemsById,
    layering,
    outfit,
    outfitFilters,
    weatherData
  ]);
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
  const selectorSearchTextById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, getSelectorSearchText(item)])),
    [items]
  );
  const activeSelectorPool = useMemo(
    () => (
      activeOutfitSlot
        ? getManualSelectorSlotPool(items, activeOutfitSlot, layering, outfit, itemsById, generationLists)
        : []
    ),
    [
      activeOutfitSlot,
      generationLists,
      items,
      itemsById,
      layering,
      outfit
    ]
  );
  const activeSelectorStatusOptions = useMemo(
    () => getItemStatusOptions(activeSelectorPool.map((item) => item.status ?? item.list)),
    [activeSelectorPool]
  );
  const selectorFilterOptions = useMemo(
    () => getSelectorFilterOptions(activeSelectorPool, selectorFilters, {
      itemStatusOptions: activeSelectorStatusOptions
    }),
    [activeSelectorPool, activeSelectorStatusOptions, selectorFilters]
  );
  const visibleSelectorItems = useMemo(
    () =>
      filterAndSortSelectorItems(activeSelectorPool, {
        search: selectorSearch,
        filters: selectorFilters,
        sort: selectorSort,
        searchTextById: selectorSearchTextById
      }),
    [activeSelectorPool, selectorFilters, selectorSearch, selectorSort, selectorSearchTextById]
  );
  const hasActiveSelectorLocalControls = useMemo(
    () => hasActiveSelectorControls({ search: selectorSearch, filters: selectorFilters, sort: selectorSort }),
    [selectorFilters, selectorSearch, selectorSort]
  );
  const hasActiveSelectorLocalFilters = useMemo(
    () => Boolean(
      (selectorFilters.type ?? []).length
      || (selectorFilters.status ?? []).length
      || (selectorFilters.collections ?? []).length
      || selectorFilters.favorite
    ),
    [selectorFilters]
  );
  const wardrobeFilterOptions = useMemo(
    () =>
      getWardrobeFilterOptions(items, wardrobeFilters, {
        itemStatusOptions: itemListOptions,
        styleTagOptions,
        climateFilterOptions: climateTagOptions,
        includeAllStatusOptions: true
      }),
    [itemListOptions, items, wardrobeFilters]
  );
  const dashboardFilterOptions = useMemo(
    () =>
      getWardrobeFilterOptions(items, dashboardFilters, {
        itemStatusOptions: dashboardItemListOptions,
        styleTagOptions,
        climateFilterOptions: climateTagOptions,
        includeAllStatusOptions: true
      }),
    [dashboardItemListOptions, items, dashboardFilters]
  );
  const draftWardrobeItemImages = getWardrobeItemImages(draft);
  const activeDraftWardrobeItemImage = getActiveWardrobeItemImage(draft);
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
  const currentSavedWardrobeViewSnapshot = useMemo(
    () => createSavedWardrobeViewSnapshot({
      wardrobeSearch,
      wardrobeFilters,
      wardrobeSort
    }),
    [wardrobeFilters, wardrobeSearch, wardrobeSort]
  );
  const matchingSavedWardrobeViewId = useMemo(
    () =>
      normalizeSavedWardrobeViews(savedWardrobeViews).find((view) =>
        matchesCurrentWardrobeView(view, {
          wardrobeSearch: currentSavedWardrobeViewSnapshot.searchQuery,
          wardrobeFilters: currentSavedWardrobeViewSnapshot.filters,
          wardrobeSort: currentSavedWardrobeViewSnapshot.sort
        })
      )?.id ?? "",
    [currentSavedWardrobeViewSnapshot, savedWardrobeViews]
  );
  const matchingOutfitFiltersSavedWardrobeViewId = useMemo(
    () =>
      normalizeSavedWardrobeViews(savedWardrobeViews).find((view) =>
        matchesCurrentOutfitFiltersSavedWardrobeView(view, outfitFilters)
      )?.id ?? "",
    [outfitFilters, savedWardrobeViews]
  );
  const matchingOutfitFiltersSavedWardrobeView = useMemo(
    () => savedWardrobeViews.find((view) => view.id === matchingOutfitFiltersSavedWardrobeViewId) ?? null,
    [matchingOutfitFiltersSavedWardrobeViewId, savedWardrobeViews]
  );
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
  const excludedGenerationLists = useMemo(
    () => itemListOptions.filter((list) => isGenerationListExcluded(list)),
    [itemListOptions, generationLists]
  );
  const outfitFiltersControlSummary = useMemo(() => {
    if (matchingOutfitFiltersSavedWardrobeView?.name) {
      return matchingOutfitFiltersSavedWardrobeView.name;
    }

    const hasDefaultStatusSelection = includedGenerationLists.length === 1
      && includedGenerationLists[0] === defaultItemList
      && !excludedGenerationLists.length;

    if (activeOutfitFilterCount > 0 || !hasDefaultStatusSelection) {
      return "Custom";
    }

    return "None";
  }, [
    activeOutfitFilterCount,
    excludedGenerationLists.length,
    includedGenerationLists,
    matchingOutfitFiltersSavedWardrobeView?.name
  ]);
  const outfitFilterSections = useMemo(
    () => [
      {
        key: "climate",
        label: "Climate",
        options: climateTagOptions,
        summary: getSelectedFilterValueCount(outfitFilters, "climate")
          ? `${getSelectedFilterValueCount(outfitFilters, "climate")} selected`
          : "None"
      },
      {
        key: "style",
        label: "Style",
        options: styleTagOptions,
        summary: getSelectedFilterValueCount(outfitFilters, "style")
          ? `${getSelectedFilterValueCount(outfitFilters, "style")} selected`
          : "None"
      },
      {
        key: "collections",
        label: "Collections",
        options: collectionOptions,
        summary: getSelectedFilterValueCount(outfitFilters, "collections")
          ? `${getSelectedFilterValueCount(outfitFilters, "collections")} selected`
          : "None"
      },
      {
        key: "status",
        label: "Status",
        options: itemListOptions,
        summary: includedGenerationLists.length && excludedGenerationLists.length
          ? `${includedGenerationLists.length} included, ${excludedGenerationLists.length} excluded`
          : includedGenerationLists.length
            ? `${includedGenerationLists.length} included`
            : excludedGenerationLists.length
              ? `${excludedGenerationLists.length} excluded`
              : "None"
      }
    ],
    [collectionOptions, excludedGenerationLists.length, includedGenerationLists.length, itemListOptions, outfitFilters]
  );
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
  const activeFitpicFilterChips = [
    ...[
      ["Tags", "tags"],
      ["Linked item", "linkedItem"],
      ["Brand", "brand"],
      ["Garment", "garmentType"],
      ["Type", "type"],
      ["Status", "status"],
      ["Collections", "collections"]
    ].flatMap(([label, key]) => [
      ...getIncludedFilterValues(fitpicFilters, key).map((value) => ({ label, key, value, excluded: false })),
      ...getExcludedFilterValues(fitpicFilters, key).map((value) => ({ label, key, value, excluded: true }))
    ]),
    ...(fitpicFilters.favorite ? [{ label: "Favorite", key: "favorite", value: fitpicFilters.favorite, excluded: false }] : [])
  ].map((filter) => ({
    ...filter,
    rawValue: filter.value,
    value:
      filter.label === "Favorite"
        ? filter.value === "yes"
          ? "Favorites"
          : "Not favorites"
        : filter.value === "__none__"
          ? filter.excluded
            ? `Has ${filter.label.toLowerCase()}`
            : `No ${filter.label.toLowerCase()}`
          : filter.excluded
            ? `Not ${filter.value}`
            : filter.value
  }));
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
    return getVisibleWardrobeItems(items, wardrobeFilters, excluded, wardrobeSearch, wardrobeSearchTextById, wardrobeSort);
  }, [excluded, items, wardrobeFilters, wardrobeSearch, wardrobeSearchTextById, wardrobeSort]);
  const visibleDashboardItems = useMemo(() => {
    return getVisibleWardrobeItems(items, dashboardFilters, excluded, "", wardrobeSearchTextById, dashboardSort);
  }, [dashboardFilters, dashboardSort, excluded, items, wardrobeSearchTextById]);
  const activeItemCount = useMemo(
    () => items.reduce((count, item) => count + (isActiveStatus(item.status ?? item.list) ? 1 : 0), 0),
    [items]
  );
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
  const visibleSavedOutfitIds = useMemo(
    () => visibleSavedOutfits.map((savedOutfit) => savedOutfit.id),
    [visibleSavedOutfits]
  );
  const selectedSavedOutfits = useMemo(
    () => selectedSavedOutfitIds.map((savedOutfitId) => savedOutfitsById[savedOutfitId]).filter(Boolean),
    [savedOutfitsById, selectedSavedOutfitIds]
  );
  const selectedSavedOutfitCount = selectedSavedOutfitIds.length;
  const hasSavedOutfitSelection = selectedSavedOutfitCount > 0;
  const isSingleSavedOutfitSelected = selectedSavedOutfitCount === 1;
  const areAllSelectedSavedOutfitsFavorite = useMemo(
    () => selectedSavedOutfits.length > 0 && selectedSavedOutfits.every((savedOutfit) => Boolean(savedOutfit.favorite)),
    [selectedSavedOutfits]
  );
  const savedOutfitFavoriteActionLabel = areAllSelectedSavedOutfitsFavorite ? "Unfavorite" : "Favorite";
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
      closeWardrobePreview();
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

    cancelScheduledIdleWork(outfitPaletteUpdateHandleRef.current);
    outfitPaletteUpdateHandleRef.current = null;

    if (!paletteOpen && outfitPalette.length) {
      return () => {
        cancelled = true;
      };
    }

    outfitPaletteUpdateHandleRef.current = scheduleIdleWork(() => {
      outfitPaletteUpdateHandleRef.current = null;
      updateOutfitPalette();
    }, paletteOpen ? 120 : 300);

    return () => {
      cancelled = true;
      cancelScheduledIdleWork(outfitPaletteUpdateHandleRef.current);
      outfitPaletteUpdateHandleRef.current = null;
    };
  }, [currentOutfitItems, outfitPalette.length, paletteOpen]);

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
      setSavedWardrobeViews(hydratedAppState.savedWardrobeViews);
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
      savedWardrobeViews,
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
    savedWardrobeViews,
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
    setFitpics((current) => {
      const next = current.map((fitpic) => syncFitpicLinkedItemSidecars(fitpic, items));
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [items, itemsById, outfit, loading]);

  useEffect(() => {
    const validIds = items.map((item) => item.id);

    setSelectedWardrobeItemIds((current) => pruneSelectedIds(current, validIds));
    setWardrobeSelectionAnchorId((current) => (current && validIds.includes(current) ? current : null));
  }, [items]);

  useEffect(() => {
    const validIds = fitpics.map((fitpic) => fitpic.id);

    setSelectedFitpicIds((current) => pruneSelectedIds(current, validIds));
    setFitpicSelectionAnchorId((current) => (current && validIds.includes(current) ? current : null));
  }, [fitpics]);

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

    closeWardrobePreview();
  }, [itemsById, wardrobePreviewItemId]);

  useEffect(() => {
    const validIds = savedOutfits.map((savedOutfit) => savedOutfit.id);

    setSelectedSavedOutfitIds((current) => pruneSelectedIds(current, validIds));
    setSavedOutfitSelectionAnchorId((current) => (current && validIds.includes(current) ? current : null));
  }, [savedOutfits]);

  useEffect(() => {
    if (activeOutfitsTab === "saved") {
      return;
    }

    setSelectedSavedOutfitIds([]);
    setSavedOutfitSelectionAnchorId(null);
  }, [activeOutfitsTab]);

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
    if (!activeSlotActionsSlot) {
      return;
    }

    if (!outfit[activeSlotActionsSlot]) {
      setActiveSlotActionsSlot(null);
    }
  }, [activeSlotActionsSlot, outfit]);

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

      if (fitpicPreview) {
        const navigationDirection = getFitpicPreviewDirectionForKey(event);

        if (navigationDirection && !isEditableKeyboardTarget(event.target)) {
          const nextFitpicId = navigationDirection === "previous"
            ? fitpicPreviewNavigation.previousFitpicId
            : fitpicPreviewNavigation.nextFitpicId;
          const nextFitpic = nextFitpicId
            ? fitpics.find((fitpic) => fitpic.id === nextFitpicId) ?? null
            : null;

          if (nextFitpic) {
            event.preventDefault();
            blurRetainedPointerFocus();
            setFitpicPreview(nextFitpic);
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
        closeWardrobePreview();
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

      if (activeSlotActionsSlot) {
        event.preventDefault();
        blurRetainedPointerFocus();
        setActiveSlotActionsSlot(null);
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

      if (selectedSavedOutfitCount) {
        event.preventDefault();
        blurRetainedPointerFocus();
        clearSavedOutfitSelection();
        return;
      }

      if (selectedFitpicCount) {
        event.preventDefault();
        blurRetainedPointerFocus();
        clearFitpicSelection();
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
    selectedFitpicCount,
    selectedSavedOutfitCount,
    fitpicPreviewNavigation.nextFitpicId,
    fitpicPreviewNavigation.previousFitpicId,
    wardrobePreviewNavigation.nextItemId,
    wardrobePreviewNavigation.previousItemId,
    wardrobePreviewItemId,
    selectedWardrobeItemCount,
    wardrobeFiltersOpen,
    wardrobeManageOpen,
    activeSlotActionsSlot,
    selectedAccessorySlot,
    selectedOutfitSlot
  ]);

  function handleGenerate() {
    if (generateInFlightRef.current) {
      pendingGenerateRef.current = true;
      return;
    }

    generateInFlightRef.current = true;
    generateAwaitingPaintRef.current = true;
    pendingGenerateRef.current = false;

    const perfInteractionId = startOaPerfInteraction("generate", "outfit", {
      generationMode,
      sourceItems: generationSourceItems.length
    });
    if (perfInteractionId) {
      updateOaPerfInteraction(perfInteractionId, (interaction) => {
        interaction.renderCountStart = appRenderCountRef.current;
      });
    }

    const scoringStartedAt = getOaPerfNow();
    const result = buildNextOutfitWithDebug(
      generationSourceItems,
      outfit,
      locked,
      layering,
      excluded,
      generationLists,
      outfitFilters,
      weatherData,
      generationMode,
      outfitAffinity,
      recentOutfits
    );
    const scoringDurationMs = getOaPerfNow() - scoringStartedAt;
    if (perfInteractionId) {
      updateOaPerfInteraction(perfInteractionId, (interaction) => {
        interaction.scoreMs += scoringDurationMs;
        interaction.poolSourceItems = generationSourceItems.length;
      });
    }

    const nextOutfit = result.outfit;
    const nextGuidedDebugPayload = generationMode === "guided" ? result.guidedDebugPayload : [];
    const nextOutfitItemUuids = syncOutfitItemUuids(nextOutfit, outfitItemUuids, itemsById);

    setActivePanel(null);
    setActiveOutfitSlot(null);
    setActiveAccessorySlot(null);
    setActiveSlotActionsSlot(null);
    clearSelectedOutfitItem();
    setPickerAnchorSlot(null);
    setWardrobeFiltersOpen(false);
    setWardrobeManageOpen(false);
    setFitpicPreview(null);
    setEditingId(null);
    setEditorReturnTarget(null);
    setGuidedDebugPayload(nextGuidedDebugPayload);
    setOutfitItemUuids((current) => (
      JSON.stringify(current) === JSON.stringify(nextOutfitItemUuids)
        ? current
        : nextOutfitItemUuids
    ));
    setOutfit(nextOutfit);
    if (generationMode === "guided") {
      setRecentOutfits((currentRecentOutfits) =>
        rememberRecentOutfit(currentRecentOutfits, nextOutfit, layering, { preserveLiked: true })
      );
    }
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

    queueSlotAction(slot, "reroll");
  }

  function getSlotOptions(slot) {
    return getEligibleSlotPool(generationSourceItems, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById);
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
    if (!direction) {
      return;
    }

    queueSlotAction(slot, "cycle", direction);
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

  function queueSlotAction(slot, kind, direction = 0) {
    const queue = pendingSlotActionQueueRef.current;
    const existingEntry = queue.get(slot) ?? { cycleDelta: 0, rerollCount: 0, interactionId: null };
    const interactionId = existingEntry.interactionId ?? startOaPerfInteraction(kind, slot, {
      direction,
      sourceItems: generationSourceItems.length
    });

    if (interactionId) {
      updateOaPerfInteraction(interactionId, (interaction) => {
        interaction.clickCount = (interaction.clickCount ?? 0) + (existingEntry.interactionId ? 1 : 0);
        interaction.metadata.direction = direction;
        interaction.renderCountStart = interaction.renderCountStart || appRenderCountRef.current;
      });
    }
    existingEntry.interactionId = interactionId;

    if (kind === "reroll") {
      existingEntry.rerollCount += 1;
    } else if (kind === "cycle") {
      existingEntry.cycleDelta += direction > 0 ? 1 : -1;
    }

    queue.set(slot, existingEntry);

    if (pendingSlotActionFrameRef.current !== null) {
      return;
    }

    pendingSlotActionFrameRef.current = window.requestAnimationFrame(() => {
      pendingSlotActionFrameRef.current = null;
      flushQueuedSlotActions();
    });
  }

  function flushQueuedSlotActions() {
    const queuedEntries = Array.from(pendingSlotActionQueueRef.current.entries());
    if (!queuedEntries.length) {
      return;
    }

    pendingSlotActionQueueRef.current.clear();

    setOutfit((current) => {
      let nextOutfit = current;

      queuedEntries.forEach(([slot, entry]) => {
        if (locked[slot]) {
          return;
        }

        const interactionId = entry.interactionId;
        const rerollCount = Math.max(0, Math.trunc(entry.rerollCount || 0));
        const cycleDelta = Math.trunc(entry.cycleDelta || 0);
        const cycleDirection = cycleDelta === 0 ? 0 : cycleDelta > 0 ? 1 : -1;
        const cycleSteps = Math.abs(cycleDelta);

        if (interactionId) {
          updateOaPerfInteraction(interactionId, (interaction) => {
            interaction.poolSourceItems = generationSourceItems.length;
          });
        }

        for (let index = 0; index < rerollCount; index += 1) {
          const poolStartedAt = getOaPerfNow();
          const pool = getEligibleSlotPool(
            generationSourceItems,
            slot,
            excluded,
            generationLists,
            layering,
            outfitFilters,
            weatherData,
            nextOutfit,
            itemsById
          ).filter((item) => item.id !== nextOutfit[slot]);
          const poolDurationMs = getOaPerfNow() - poolStartedAt;
          if (interactionId) {
            updateOaPerfInteraction(interactionId, (interaction) => {
              interaction.poolMs += poolDurationMs;
              interaction.poolCalls += 1;
              interaction.poolSizes.push(pool.length);
            });
          }

          const scoreStartedAt = getOaPerfNow();
          const nextItem = pickNextItemForGeneration(
            pool,
            slot,
            nextOutfit,
            itemsById,
            outfitFilters,
            weatherData,
            generationMode,
            outfitAffinity,
            recentOutfits,
            layering
          );
          const scoreDurationMs = getOaPerfNow() - scoreStartedAt;
          if (interactionId) {
            updateOaPerfInteraction(interactionId, (interaction) => {
              interaction.scoreMs += scoreDurationMs;
            });
          }

          nextOutfit = {
            ...nextOutfit,
            [slot]: nextItem?.id ?? null
          };
        }

        for (let index = 0; index < cycleSteps; index += 1) {
          const poolStartedAt = getOaPerfNow();
          const options = getEligibleSlotPool(
            generationSourceItems,
            slot,
            excluded,
            generationLists,
            layering,
            outfitFilters,
            weatherData,
            nextOutfit,
            itemsById
          );
          const poolDurationMs = getOaPerfNow() - poolStartedAt;
          if (interactionId) {
            updateOaPerfInteraction(interactionId, (interaction) => {
              interaction.poolMs += poolDurationMs;
              interaction.poolCalls += 1;
              interaction.poolSizes.push(options.length);
            });
          }

          if (!options.length) {
            nextOutfit = {
              ...nextOutfit,
              [slot]: null
            };
            break;
          }

          const currentIndex = options.findIndex((item) => item.id === nextOutfit[slot]);
          const fallbackIndex = cycleDirection > 0 ? -1 : 0;
          const nextIndex = (
            currentIndex === -1
              ? fallbackIndex + cycleDirection + options.length
              : currentIndex + cycleDirection + options.length
          ) % options.length;

          nextOutfit = {
            ...nextOutfit,
            [slot]: options[nextIndex].id
          };
        }
      });

      return nextOutfit;
    });
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

  async function handleExportBackupV2() {
    const backupPackage = await buildBackupPackageZip({
      items,
      appState: {
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
      },
      resolveAssetUrl: resolveImageUrl
    });

    downloadExportFile(await backupPackage.blob.arrayBuffer(), {
      filename: backupPackage.fileName,
      mimeType: "application/zip"
    });

    if (backupPackage.warningCount > 0) {
      window.alert(
        `Backup package exported with ${backupPackage.warningCount} warning${backupPackage.warningCount === 1 ? "" : "s"}. See ${backupPackage.warningReportFileName} inside the ZIP.`
      );
    }
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

  function handleExportSavedOutfitsCsv() {
    downloadExportFile(
      serializeSavedOutfitsCsv(savedOutfits, items),
      {
        filename: getExportFilename("saved-outfits", "csv"),
        mimeType: "text/csv;charset=utf-8"
      }
    );
  }

  function handleExportSavedOutfitsJson() {
    downloadExportFile(
      serializeSavedOutfitsJson(savedOutfits, items),
      {
        filename: getExportFilename("saved-outfits", "json"),
        mimeType: "application/json"
      }
    );
  }

  function handleExportFitpicsCsv() {
    downloadExportFile(
      serializeFitpicsCsv(fitpics, items),
      {
        filename: getExportFilename("fitpics", "csv"),
        mimeType: "text/csv;charset=utf-8"
      }
    );
  }

  function handleExportFitpicsJson() {
    downloadExportFile(
      serializeFitpicsJson(fitpics, items),
      {
        filename: getExportFilename("fitpics", "json"),
        mimeType: "application/json"
      }
    );
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

  function openWardrobeExportDialog() {
    setWardrobeExportOptions(createWardrobeSpreadExportOptions("compact"));
  }

  function openFitpicExportDialog() {
    setFitpicExportOptions(createFitpicSpreadExportOptions("reference"));
  }

  function openOaAiExportDialog() {
    setOaAiExportOptions(createDefaultOaAiExportOptions(collectionOptions));
  }

  async function handleExportWardrobeImage(options = createWardrobeSpreadExportOptions("compact")) {
    if (!visibleWardrobeItems.length) {
      window.alert("There are no filtered wardrobe pieces to export.");
      return;
    }

    try {
      await downloadWardrobeImageExport({
        items: visibleWardrobeItems,
        options,
        resolveAssetUrl: resolveImageUrl,
        fileName: `wardrobe-wishlist-${new Date().toISOString().slice(0, 10)}.png`
      });
    } catch {
      window.alert("The wardrobe image could not be exported.");
    }
  }

  async function handleExportFitpicImage(options = createFitpicSpreadExportOptions("reference")) {
    const normalizedOptions = normalizeFitpicSpreadExportOptions(options);
    const sortedAllFitpics = filterAndSortFitpics(
      fitpics,
      {
        search: "",
        filters: emptyFitpicFilters,
        sort: fitpicSort
      },
      items
    );
    const scopedFitpics = getFitpicSpreadExportScopedFitpics({
      allFitpics: fitpics,
      visibleFitpics,
      sortedFitpics: sortedAllFitpics,
      options: normalizedOptions
    });

    if (!scopedFitpics.length) {
      window.alert(
        normalizedOptions.scope === "all"
          ? "There are no fitpics to export."
          : "There are no filtered fitpics to export."
      );
      return;
    }

    try {
      await downloadFitpicImageExport({
        fitpics: scopedFitpics,
        options: normalizedOptions,
        resolveAssetUrl: resolveImageUrl,
        fileName: `oa-fitpics-spread-${new Date().toISOString().slice(0, 10)}.png`
      });
    } catch {
      window.alert("The fitpics image could not be exported.");
    }
  }

  async function handleConfirmOaAiExport() {
    const nextOptions = oaAiExportOptions
      ? { ...oaAiExportOptions }
      : createDefaultOaAiExportOptions(collectionOptions);

    setOaAiExporting(true);

    try {
      const bundle = await buildOaAiExportBundle({
        items,
        savedOutfits,
        fitpics,
        options: nextOptions,
        resolveAssetUrl: resolveImageUrl,
        renderWardrobePng: renderWardrobeImageExport,
        renderFitpicPng: renderFitpicImageExport
      });

      downloadExportFile(await bundle.blob.arrayBuffer(), {
        filename: bundle.fileName,
        mimeType: "application/zip"
      });

      setOaAiExportOptions(null);
    } catch {
      window.alert("The OA AI export could not be generated.");
    } finally {
      setOaAiExporting(false);
    }
  }

  async function handleConfirmWardrobeExport() {
    const nextOptions = wardrobeExportOptions ? { ...wardrobeExportOptions } : createWardrobeSpreadExportOptions("compact");
    setWardrobeExportOptions(null);
    await handleExportWardrobeImage(nextOptions);
  }

  async function handleConfirmFitpicExport() {
    const nextOptions = fitpicExportOptions ? { ...fitpicExportOptions } : createFitpicSpreadExportOptions("reference");
    setFitpicExportOptions(null);
    await handleExportFitpicImage(nextOptions);
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
    if (!itemId) {
      return;
    }

    closeUtilityWindows();
    setWardrobePreviewReturnFitpicPreview(null);
    setFitpicPreview(null);
    setWardrobePreviewItemId(itemId);
  }

  function openWardrobePreviewFromFitpicPreview(itemId) {
    if (!itemId) {
      return;
    }

    closeUtilityWindows();
    setWardrobePreviewReturnFitpicPreview(fitpicPreview);
    setFitpicPreview(null);
    setWardrobePreviewItemId(itemId);
  }

  function closeWardrobePreview({ restoreFitpicPreview = true } = {}) {
    const returnFitpicPreview = wardrobePreviewReturnFitpicPreview;
    setWardrobePreviewItemId(null);
    setWardrobePreviewItemImageUuid(null);

    if (restoreFitpicPreview && returnFitpicPreview) {
      setFitpicPreview(returnFitpicPreview);
    }

    setWardrobePreviewReturnFitpicPreview(null);
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

  function showPreviousWardrobePreviewImage() {
    if (wardrobePreviewImageNavigation.previousItemImageUuid) {
      setWardrobePreviewItemImageUuid(wardrobePreviewImageNavigation.previousItemImageUuid);
    }
  }

  function showNextWardrobePreviewImage() {
    if (wardrobePreviewImageNavigation.nextItemImageUuid) {
      setWardrobePreviewItemImageUuid(wardrobePreviewImageNavigation.nextItemImageUuid);
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

  function handleFitpicCardClick(fitpic, event) {
    registerPointerActivatedControl(event);
    const shiftKey = event.shiftKey;
    const toggleKey = event.metaKey || event.ctrlKey;
    const pendingSelection = fitpicPendingSelectionRef.current;

    if (pendingSelection && pendingSelection.fitpic.id !== fitpic.id) {
      flushPendingFitpicSelection();
    }

    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
    }

    fitpicPendingSelectionRef.current = {
      fitpic,
      shiftKey,
      toggleKey
    };

    fitpicSelectClickTimeoutRef.current = window.setTimeout(() => {
      flushPendingFitpicSelection();
    }, WARDROBE_PREVIEW_DOUBLE_CLICK_MS);

    blurPointerActivatedControl(event);
  }

  function handleFitpicSelection(fitpic, shiftKey, toggleKey) {
    const nextSelectionState = getNextSelectionState({
      selectedIds: selectedFitpicIds,
      orderedIds: visibleFitpicIds,
      clickedId: fitpic.id,
      anchorId: fitpicSelectionAnchorId,
      shiftKey,
      toggleKey
    });

    setSelectedFitpicIds(nextSelectionState.selectedIds);
    setFitpicSelectionAnchorId(nextSelectionState.anchorId);
  }

  function flushPendingFitpicSelection() {
    const pendingSelection = fitpicPendingSelectionRef.current;

    if (!pendingSelection) {
      return;
    }

    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      fitpicSelectClickTimeoutRef.current = null;
    }

    fitpicPendingSelectionRef.current = null;
    handleFitpicSelection(pendingSelection.fitpic, pendingSelection.shiftKey, pendingSelection.toggleKey);
  }

  function handleFitpicCardDoubleClick(fitpic, event) {
    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      fitpicSelectClickTimeoutRef.current = null;
    }
    fitpicPendingSelectionRef.current = null;

    event.currentTarget.blur();
    openFitpicPreview(fitpic);
  }

  function handleFitpicCardKeyDown(fitpic, event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      fitpicSelectClickTimeoutRef.current = null;
    }

    fitpicPendingSelectionRef.current = null;
    openFitpicPreview(fitpic);
  }

  function editWardrobePreviewItem() {
    if (!wardrobePreviewItem) {
      return;
    }

    const previewedItem = wardrobePreviewItem;
    closeWardrobePreview({ restoreFitpicPreview: false });
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
      setDraft((current) =>
        patchOpenItemEditorDraft(current, nextItem.id, {
          favorite: nextItem.favorite,
          updatedAt: nextItem.updatedAt
        })
      );
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

  function promptForSavedWardrobeViewName(currentName = "") {
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      return currentName.trim();
    }

    const nextName = window.prompt("Save wardrobe view as:", currentName);
    return typeof nextName === "string" ? nextName.trim() : "";
  }

  function confirmSavedWardrobeViewReplacement(name) {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return true;
    }

    return window.confirm(`Replace the existing saved view "${name}"?`);
  }

  function confirmSavedWardrobeViewDelete(name) {
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return true;
    }

    return window.confirm(`Delete the saved view "${name}"?`);
  }

  function applyWardrobeSavedView(savedView, event = null) {
    const nextViewState = applySavedWardrobeView(savedView);
    setWardrobeSearch(nextViewState.searchQuery);
    setWardrobeFilters(nextViewState.filters);
    setWardrobeSort(nextViewState.sort);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function applyOutfitFiltersSavedWardrobeView(savedView, event = null) {
    setOutfitFilters(applySavedWardrobeViewToOutfitFilters(savedView));

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function handleSaveCurrentWardrobeView(event = null) {
    const activeView = savedWardrobeViews.find((view) => view.id === matchingSavedWardrobeViewId) ?? null;
    const nextName = promptForSavedWardrobeViewName(activeView?.name ?? "");

    if (!nextName) {
      return;
    }

    let saveResult = upsertSavedWardrobeView(
      savedWardrobeViews,
      nextName,
      {
        wardrobeSearch: currentSavedWardrobeViewSnapshot.searchQuery,
        wardrobeFilters: currentSavedWardrobeViewSnapshot.filters,
        wardrobeSort: currentSavedWardrobeViewSnapshot.sort
      },
      activeView ? { targetId: activeView.id } : {}
    );

    if (saveResult.conflictingView) {
      const shouldReplace = confirmSavedWardrobeViewReplacement(saveResult.conflictingView.name);

      if (!shouldReplace) {
        return;
      }

      saveResult = upsertSavedWardrobeView(
        savedWardrobeViews,
        nextName,
        {
          wardrobeSearch: currentSavedWardrobeViewSnapshot.searchQuery,
          wardrobeFilters: currentSavedWardrobeViewSnapshot.filters,
          wardrobeSort: currentSavedWardrobeViewSnapshot.sort
        },
        {
          targetId: activeView?.id ?? "",
          allowReplace: true
        }
      );
    }

    setSavedWardrobeViews(saveResult.savedViews);

    if (event) {
      blurPointerActivatedControl(event);
    }
  }

  function handleRenameSavedWardrobeView(view) {
    const nextName = promptForSavedWardrobeViewName(view?.name ?? "");

    if (!nextName || !view?.id) {
      return;
    }

    let renameResult = renameSavedWardrobeView(savedWardrobeViews, view.id, nextName);

    if (renameResult.conflictingView) {
      const shouldReplace = confirmSavedWardrobeViewReplacement(renameResult.conflictingView.name);

      if (!shouldReplace) {
        return;
      }

      renameResult = renameSavedWardrobeView(savedWardrobeViews, view.id, nextName, { allowReplace: true });
    }

    setSavedWardrobeViews(renameResult.savedViews);
  }

  function handleDeleteSavedWardrobeView(view) {
    if (!view?.id || !confirmSavedWardrobeViewDelete(view.name)) {
      return;
    }

    setSavedWardrobeViews((current) => deleteSavedWardrobeView(current, view.id));
  }

  function handleTogglePinnedSavedWardrobeView(view) {
    if (!view?.id) {
      return;
    }

    setSavedWardrobeViews((current) => togglePinnedSavedWardrobeView(current, view.id));
  }

  function clearFitpicFilters() {
    setFitpicFilters(emptyFitpicFilters);
    setFitpicFilterSearch("");
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

  function toggleFitpicFilterSection(key) {
    setFitpicFilterSectionsOpen((current) => ({
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

  function toggleFitpicFilterValueWithMode(key, value, shouldExclude = false) {
    setFitpicFilters((current) => toggleMultiFilterValueState(current, key, value, shouldExclude));
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

  function setFitpicToggleFilter(key, value) {
    setFitpicFilters((current) => ({
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

  function toggleOutfitFilterSection(key) {
    setOutfitFilterSectionsOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
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
    setDraft((current) => toggleItemEditorDraftTag(current, field, value, options));
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

    setDraft((current) => addItemEditorDraftCollection(current, normalizedCollection));
    setDraftCollectionInput("");
  }

  function removeDraftCollection(collectionToRemove) {
    setDraft((current) => removeItemEditorDraftCollection(current, collectionToRemove));
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

  function renderAdvancedLabel(label, field, inputId = null) {
    return (
      <span className="editor-label-row">
        {inputId ? <label htmlFor={inputId}>{label}</label> : <span>{label}</span>}
        {advancedOverrideSet.has(field) ? (
          <span className="editor-label-actions">
            <span className="field-status-text">Custom</span>
            <button
              type="button"
              className="editor-inline-reset"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                resetAdvancedField(field);
              }}
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

  function getWardrobeItemImageDisplayAsset(itemImage) {
    if (!itemImage?.itemImageUuid) {
      return null;
    }

    return getActiveWardrobeItemImageAsset({
      itemImages: [itemImage],
      activeItemImageUuid: itemImage.itemImageUuid
    });
  }

  function ensureDraftItemUuid(currentDraft) {
    const nextItemUuid = normalizeItemUuid(currentDraft?.itemUuid, createItemUuid);

    if (nextItemUuid === currentDraft?.itemUuid) {
      return currentDraft;
    }

    return {
      ...currentDraft,
      itemUuid: nextItemUuid
    };
  }

  async function ingestItemImageFiles(files = []) {
    const selectedFiles = Array.isArray(files) ? files.filter(Boolean) : [];

    if (!selectedFiles.length) {
      return;
    }

    const imageFiles = selectedFiles.filter((file) => file.type?.startsWith("image/"));

    if (!imageFiles.length) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    try {
      setImageProcessing(true);
      setImageUploadError("");
      const nextDraftImages = await Promise.all(
        imageFiles.map(async (file) => {
          const importMetadata = await readImageFileMetadata(file, {
            readFileAsDataUrl,
            loadImage
          });
          const imageUrl = await compressImageSource(file);

          return {
            imageUrl,
            images: {
              preview: { src: imageUrl },
              thumbnail: { src: imageUrl }
            },
            importMetadata
          };
        })
      );
      setDraft((current) => {
        const draftWithItemUuid = ensureDraftItemUuid(current);
        const currentImageCount = getWardrobeItemImages(draftWithItemUuid).length;
        const importedImages = nextDraftImages.map((entry, index) =>
          createImportedWardrobeItemImage({
            parentItemUuid: draftWithItemUuid.itemUuid,
            order: currentImageCount + index,
            imageUrl: entry.imageUrl,
            images: entry.images,
            importMetadata: entry.importMetadata
          })
        );
        const nextDraft = addWardrobeItemImagesToDraft(draftWithItemUuid, importedImages);

        if (currentImageCount > 0) {
          return nextDraft;
        }

        return {
          ...nextDraft,
          imageFrameScale: 100,
          imageScale: 100,
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageCropX: 0,
          imageCropY: 0,
          imageCropWidth: 100,
          imageCropHeight: 100
        };
      });
    } catch (error) {
      setImageUploadError(error?.message || "This image could not be processed.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleItemImageUpload(event) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    try {
      await ingestItemImageFiles(files);
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

    const imageFiles = droppedFiles.filter((file) => file.type?.startsWith("image/"));

    if (!imageFiles.length) {
      setImageUploadError("Selected file is not an image.");
      return;
    }

    await ingestItemImageFiles(imageFiles);
  }

  function setDraftActiveItemImage(itemImageUuid) {
    setDraft((current) => setActiveWardrobeItemImageInDraft(current, itemImageUuid));
    setImageUploadError("");
  }

  function moveDraftItemImage(itemImageUuid, direction) {
    setDraft((current) => moveWardrobeItemImageInDraft(current, itemImageUuid, direction));
    setImageUploadError("");
  }

  function removeDraftItemImage(itemImageUuid) {
    setDraft((current) => {
      const currentImages = getWardrobeItemImages(current);

      if (currentImages.length <= 1) {
        return current;
      }

      return removeWardrobeItemImageFromDraft(current, itemImageUuid);
    });
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
        ...replaceActiveWardrobeItemImageAssetInDraft(current, {
          imageUrl: compressedImageUrl,
          images: {
            preview: { src: compressedImageUrl },
            thumbnail: { src: compressedImageUrl }
          }
        }),
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
    setActiveSlotActionsSlot(null);
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
    setActiveSlotActionsSlot(null);
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

  function toggleSlotActionsPopover(slot) {
    setActiveSlotActionsSlot((current) => current === slot ? null : slot);
  }

  function setSelectorFilterValue(key, value) {
    setSelectorFilters((current) => ({
      ...current,
      [key]: value ? [value] : [],
      [getExcludedFilterKey(key)]: []
    }));
  }

  function clearSelectorControls() {
    setSelectorSearch("");
    setSelectorSort(DEFAULT_SELECTOR_SORT);
    setSelectorFilters(createEmptySelectorFilters());
    setSelectorFiltersOpen(false);
  }

  function closeUtilityWindows() {
    setWeatherOpen(false);
    setOutfitFiltersOpen(false);
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
      setActiveSlotActionsSlot(null);
      clearSelectedOutfitItem();
      setPickerAnchorSlot(null);
      setWardrobeFiltersOpen(false);
      setFitpicFiltersOpen(false);
      setDashboardFiltersOpen(false);
      setWardrobeManageOpen(false);
      closeWardrobePreview({ restoreFitpicPreview: false });
      setFitpicPreview(null);
      cancelEditFitpic();
      if (wardrobeSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
        wardrobeSelectClickTimeoutRef.current = null;
      }
      wardrobePendingSelectionRef.current = null;
      if (savedOutfitSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
        savedOutfitSelectClickTimeoutRef.current = null;
      }
      savedOutfitPendingSelectionRef.current = null;
      if (fitpicSelectClickTimeoutRef.current !== null) {
        window.clearTimeout(fitpicSelectClickTimeoutRef.current);
        fitpicSelectClickTimeoutRef.current = null;
      }
      fitpicPendingSelectionRef.current = null;
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
    setActiveSlotActionsSlot(null);
    clearSelectedOutfitItem();
    if (!controlsOpen) {
      setDockExpanded(isMobileViewport ? false : true);
    }
    setWardrobeFiltersOpen(false);
    setDashboardFiltersOpen(false);
    setWardrobeManageOpen(false);
    closeWardrobePreview({ restoreFitpicPreview: false });
    setFitpicPreview(null);
    cancelEditFitpic();
    setOutfitFiltersOpen(false);
    if (wardrobeSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(wardrobeSelectClickTimeoutRef.current);
      wardrobeSelectClickTimeoutRef.current = null;
    }
    wardrobePendingSelectionRef.current = null;
    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      savedOutfitSelectClickTimeoutRef.current = null;
    }
    savedOutfitPendingSelectionRef.current = null;
    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      fitpicSelectClickTimeoutRef.current = null;
    }
    fitpicPendingSelectionRef.current = null;
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
    setActiveSlotActionsSlot(null);
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
    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      savedOutfitSelectClickTimeoutRef.current = null;
    }
    savedOutfitPendingSelectionRef.current = null;
    if (fitpicSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(fitpicSelectClickTimeoutRef.current);
      fitpicSelectClickTimeoutRef.current = null;
    }
    fitpicPendingSelectionRef.current = null;
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

  function dismissFitpicFilters() {
    setFitpicFiltersOpen(false);
    setFitpicFilterSearch("");
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

  function openFitpicFilters(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    closeUtilityWindows();
    setFitpicFiltersOpen((current) => {
      const nextOpen = !current;

      if (!nextOpen) {
        setFitpicFilterSearch("");
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

  function closeFitpicFilters(event) {
    if (event) {
      blurPointerActivatedControl(event);
    }

    dismissFitpicFilters();
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
    setSelectedSavedOutfitIds([]);
    setSavedOutfitSelectionAnchorId(null);
    cancelEditSavedOutfit();
    setActivePanel(null);
  }

  function handleSavedOutfitClick(savedOutfit, event) {
    registerPointerActivatedControl(event);
    const shiftKey = event.shiftKey;
    const toggleKey = event.metaKey || event.ctrlKey;
    const pendingSelection = savedOutfitPendingSelectionRef.current;

    if (pendingSelection && pendingSelection.savedOutfit.id !== savedOutfit.id) {
      flushPendingSavedOutfitSelection();
    }

    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
    }

    savedOutfitPendingSelectionRef.current = {
      savedOutfit,
      shiftKey,
      toggleKey
    };

    savedOutfitSelectClickTimeoutRef.current = window.setTimeout(() => {
      flushPendingSavedOutfitSelection();
    }, WARDROBE_PREVIEW_DOUBLE_CLICK_MS);

    blurPointerActivatedControl(event);
  }

  function handleSavedOutfitDoubleClick(savedOutfit, event) {
    if (event) {
      event.preventDefault();
    }

    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      savedOutfitSelectClickTimeoutRef.current = null;
    }
    savedOutfitPendingSelectionRef.current = null;
    loadAndCloseSavedOutfit(savedOutfit);
  }

  function handleSavedOutfitSelection(savedOutfit, shiftKey, toggleKey) {
    const nextSelectionState = getNextSelectionState({
      selectedIds: selectedSavedOutfitIds,
      orderedIds: visibleSavedOutfitIds,
      clickedId: savedOutfit.id,
      anchorId: savedOutfitSelectionAnchorId,
      shiftKey,
      toggleKey
    });

    setSelectedSavedOutfitIds(nextSelectionState.selectedIds);
    setSavedOutfitSelectionAnchorId(nextSelectionState.anchorId);
  }

  function flushPendingSavedOutfitSelection() {
    const pendingSelection = savedOutfitPendingSelectionRef.current;

    if (!pendingSelection) {
      return;
    }

    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      savedOutfitSelectClickTimeoutRef.current = null;
    }

    savedOutfitPendingSelectionRef.current = null;
    handleSavedOutfitSelection(
      pendingSelection.savedOutfit,
      pendingSelection.shiftKey,
      pendingSelection.toggleKey
    );
  }

  function handleSavedOutfitKeyDown(savedOutfit, event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (savedOutfitSelectClickTimeoutRef.current !== null) {
      window.clearTimeout(savedOutfitSelectClickTimeoutRef.current);
      savedOutfitSelectClickTimeoutRef.current = null;
    }

    savedOutfitPendingSelectionRef.current = null;
    loadAndCloseSavedOutfit(savedOutfit);
  }

  function renderOutfitSlotPicker() {
    if (!activeOutfitSlot) {
      return null;
    }

    const totalItemCount = activeSelectorPool.length;
    const visibleItemCount = visibleSelectorItems.length;

    return (
      <div className="slot-picker">
        <div className="slot-picker-toolbar">
          <div className="slot-picker-toolbar-row slot-picker-toolbar-row-main">
            <strong className="slot-picker-title">{getSlotLabel(activeOutfitSlot)}</strong>
            <div className="wardrobe-search-field slot-picker-search-field">
              <input
                type="search"
                value={selectorSearch}
                onChange={(event) => setSelectorSearch(event.target.value)}
                placeholder="Search slot items"
              />
            </div>
            <div className="wardrobe-sort-field slot-picker-sort-field">
              <select value={selectorSort} onChange={(event) => setSelectorSort(event.target.value)}>
                <option value="nameAz">A-Z</option>
                <option value="nameZa">Z-A</option>
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
              </select>
            </div>
            <span className="wardrobe-results-count">
              {visibleItemCount} item{visibleItemCount === 1 ? "" : "s"}{hasActiveSelectorLocalControls ? ` of ${totalItemCount}` : ""}
            </span>
            <button
              type="button"
              className={`ghost-button slot-picker-filters-toggle ${selectorFiltersOpen ? "is-active" : ""} ${hasActiveSelectorLocalFilters ? "has-active-filters" : ""}`}
              onClick={() => setSelectorFiltersOpen((current) => !current)}
              aria-expanded={selectorFiltersOpen}
            >
              {hasActiveSelectorLocalFilters ? "Filters active" : "Filters"}
            </button>
            <button type="button" className="ghost-button" onClick={closePickerOverlay}>
              Close
            </button>
          </div>

          {selectorFiltersOpen ? (
            <div className="slot-picker-filter-panel">
              <div className="slot-picker-filter-grid">
                <select
                  value={selectorFilters.type[0] ?? ""}
                  onChange={(event) => setSelectorFilterValue("type", event.target.value)}
                  aria-label="Filter slot items by type"
                >
                  <option value="">All types</option>
                  {selectorFilterOptions.type.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={selectorFilters.status[0] ?? ""}
                  onChange={(event) => setSelectorFilterValue("status", event.target.value)}
                  aria-label="Filter slot items by status"
                >
                  <option value="">All statuses</option>
                  {selectorFilterOptions.status.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={selectorFilters.collections[0] ?? ""}
                  onChange={(event) => setSelectorFilterValue("collections", event.target.value)}
                  aria-label="Filter slot items by collection"
                >
                  <option value="">All collections</option>
                  {selectorFilterOptions.collections.map((collection) => (
                    <option key={collection} value={collection}>{collection}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`ghost-button slot-picker-favorite-toggle ${selectorFilters.favorite === "yes" ? "is-active" : ""}`}
                  onClick={() =>
                    setSelectorFilters((current) => ({
                      ...current,
                      favorite: current.favorite === "yes" ? "" : "yes"
                    }))
                  }
                  aria-pressed={selectorFilters.favorite === "yes"}
                >
                  Favorites only
                </button>
              </div>
              <div className="slot-picker-filter-panel-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={clearSelectorControls}
                  disabled={!hasActiveSelectorLocalControls}
                >
                  Clear selector controls
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {visibleSelectorItems.length ? (
          <div className="slot-picker-list">
            {visibleSelectorItems.map((item) => {
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
            <p>{totalItemCount ? "No slot items match the current local controls." : "No compatible items available for this slot."}</p>
            {hasActiveSelectorLocalControls ? <p>Clear the selector controls or try a different search.</p> : null}
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
          <>
            <div className="saved-outfit-controls" aria-label="Saved outfit controls">
              <div className="saved-outfit-controls-header">
                <p className="saved-outfit-controls-count">
                  {visibleSavedOutfits.length} of {savedOutfits.length} saved outfits
                </p>
                <div className="wardrobe-toolbar-context-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleExportSavedOutfitsCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleExportSavedOutfitsJson}
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetSavedOutfitControls}
                    disabled={!hasActiveSavedOutfitControls}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
              <label>
                Search
                <input
                  type="search"
                  value={savedOutfitSearch}
                  onChange={(event) => setSavedOutfitSearch(event.target.value)}
                  placeholder="Search saved outfits"
                />
              </label>
              <label>
                Sort
                <select value={savedOutfitSort} onChange={(event) => setSavedOutfitSort(event.target.value)}>
                  <option value="updatedNewest">Updated newest</option>
                  <option value="createdNewest">Created newest</option>
                  <option value="titleAz">Title A-Z</option>
                </select>
              </label>
              <label>
                Tag
                <select value={savedOutfitTagFilter} onChange={(event) => setSavedOutfitTagFilter(event.target.value)}>
                  <option value="">All tags</option>
                  {savedOutfitTagFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="saved-outfit-controls-toggle">
                <input
                  type="checkbox"
                  checked={savedOutfitFavoritesOnly}
                  onChange={(event) => setSavedOutfitFavoritesOnly(event.target.checked)}
                />
                <span>Favorites only</span>
              </label>
            </div>
            {hasSavedOutfitSelection ? (
              <div className="wardrobe-toolbar saved-outfit-toolbar" aria-label="Saved outfit library actions">
                <div className="wardrobe-toolbar-leading fitpic-toolbar-leading">
                  <span className="wardrobe-results-count">
                    {visibleSavedOutfits.length} saved outfit{visibleSavedOutfits.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="wardrobe-toolbar-context">
                  <div className="wardrobe-selection-summary fitpic-selection-summary">
                    <div className="wardrobe-selection-count wardrobe-selection-chip">
                      <span>{selectedSavedOutfitCount} selected</span>
                      <button
                        type="button"
                        className="wardrobe-selection-clear wardrobe-selection-chip-clear"
                        onMouseDown={preventMouseButtonFocus}
                        onClick={clearSavedOutfitSelection}
                        aria-label="Clear saved outfit selection"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="wardrobe-toolbar-context-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={editSelectedSavedOutfit}
                      disabled={!isSingleSavedOutfitSelected}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`ghost-button ${areAllSelectedSavedOutfitsFavorite ? "is-active" : ""}`}
                      onClick={toggleSelectedSavedOutfitFavorites}
                    >
                      {savedOutfitFavoriteActionLabel}
                    </button>
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={deleteSelectedSavedOutfits}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {hasActiveSavedOutfitControls ? (
              <div className="active-filter-summary saved-outfit-controls-summary" aria-label="Active saved outfit controls">
                <span>Local controls:</span>
                <div className="active-filter-list">
                  {savedOutfitSearch.trim() ? (
                    <span className="active-filter-pill">
                      Search:
                      {" "}
                      {savedOutfitSearch.trim()}
                    </span>
                  ) : null}
                  {savedOutfitFavoritesOnly ? (
                    <span className="active-filter-pill">Favorites only</span>
                  ) : null}
                  {savedOutfitTagFilter ? (
                    <span className="active-filter-pill">
                      Tag:
                      {" "}
                      {selectedSavedOutfitTagFilterLabel || savedOutfitTagFilter}
                    </span>
                  ) : null}
                  {savedOutfitSort !== "updatedNewest" ? (
                    <span className="active-filter-pill">
                      Sort:
                      {" "}
                      {selectedSavedOutfitSortLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!visibleSavedOutfits.length ? (
              <div className="editor-placeholder saved-outfits-empty">
                <p>No saved outfits match the current local search and filters.</p>
                <p>Clear the controls or save more outfits.</p>
                <button type="button" className="ghost-button" onClick={resetSavedOutfitControls}>
                  Clear filters
                </button>
              </div>
            ) : (
            <div className="saved-outfits-list">
              {visibleSavedOutfits.map((savedOutfit) => {
              const savedOutfitKey = getOutfitKey(savedOutfit.outfit, savedOutfit.layering);
              const isSavedOutfitLiked = Boolean(likedOutfitKeys[savedOutfitKey]);
              const isSelected = selectedSavedOutfitIds.includes(savedOutfit.id);

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
                      <label>
                        Tags
                        <input
                          value={savedOutfitDraft.tagsText}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              tagsText: event.target.value
                            }))
                          }
                          placeholder="casual, summer, black"
                        />
                      </label>
                      <label className="saved-outfit-favorite-field">
                        <input
                          type="checkbox"
                          checked={savedOutfitDraft.favorite}
                          onChange={(event) =>
                            setSavedOutfitDraft((current) => ({
                              ...current,
                              favorite: event.target.checked
                            }))
                          }
                        />
                        <span>Favorite</span>
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
                        onKeyDown={(event) => handleSavedOutfitKeyDown(savedOutfit, event)}
                        aria-pressed={isSelected}
                        aria-label={`Select ${savedOutfit.name}. Double-click or press Enter to load.`}
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
                      </div>
                    </>
                  )}
                </article>
              );
              })}
            </div>
            )}
          </>
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
            {fitpicImportError ? <p className="fitpic-import-error">{fitpicImportError}</p> : null}
          </div>
          <div className="fitpic-dropzone-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => fitpicUploadInputRef.current?.click()}
              disabled={fitpicImporting}
            >
              {fitpicImporting ? "Importing…" : "Choose images"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => fitpicGroupedUploadInputRef.current?.click()}
              disabled={fitpicImporting}
            >
              {fitpicImporting ? "Importing…" : "Import grouped Fitpic"}
            </button>
          </div>
          <input
            ref={fitpicUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="fitpic-file-input"
            onChange={handleFitpicUpload}
          />
          <input
            ref={fitpicGroupedUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="fitpic-file-input"
            onChange={handleGroupedFitpicUpload}
          />
        </div>

        {!fitpics.length ? (
          <div className="editor-placeholder fitpics-empty-state">
            <p>No fitpics yet.</p>
            <p>Import outfit photos here to build an editable visual archive.</p>
          </div>
        ) : (
          <>
            <div className="wardrobe-toolbar fitpic-toolbar" aria-label="Fitpic library actions">
              <div className="wardrobe-toolbar-leading fitpic-toolbar-leading">
                <div className="wardrobe-search-field">
                  <input
                    type="search"
                    value={fitpicSearch}
                    onPointerDown={() => {
                      if (fitpicFiltersOpen) {
                        dismissFitpicFilters();
                      }
                    }}
                    onFocus={() => {
                      if (fitpicFiltersOpen) {
                        dismissFitpicFilters();
                      }
                    }}
                    onChange={(event) => setFitpicSearch(event.target.value)}
                    placeholder="Search fitpics"
                  />
                </div>
                <div className={`wardrobe-filter-anchor ${fitpicFiltersOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className={`secondary-button filter-button ${fitpicFiltersOpen || hasActiveFitpicFilters ? "is-active" : ""}`}
                    onClick={openFitpicFilters}
                    aria-pressed={fitpicFiltersOpen}
                    aria-expanded={fitpicFiltersOpen}
                    title={
                      hasActiveFitpicFilters
                        ? `${activeFitpicFilterCount} active filter${activeFitpicFilterCount === 1 ? "" : "s"}`
                        : "No active filters"
                    }
                  >
                    {hasActiveFitpicFilters ? `Filters (${activeFitpicFilterCount})` : "Filter"}
                  </button>
                  <div className={`wardrobe-controls ${fitpicFiltersOpen ? "is-open" : ""}`} aria-label="Fitpic filters">
                    <div className="wardrobe-controls-body">
                      <div className="wardrobe-filter-search">
                        <input
                          type="search"
                          value={fitpicFilterSearch}
                          onChange={(event) => setFitpicFilterSearch(event.target.value)}
                          placeholder="Search filter options"
                        />
                      </div>
                      {fitpicFilterPanelSections.map((section) => {
                        const selectedCount = section.kind === "multi"
                          ? getSelectedFilterValueCount(fitpicFilters, section.key)
                          : fitpicFilters[section.key]
                            ? 1
                            : 0;
                        const groupMatchesSearch = !normalizedFitpicFilterSearch
                          || section.label.toLowerCase().includes(normalizedFitpicFilterSearch);
                        const resolvedOptions = section.options.map((option) => (
                          typeof option === "string"
                            ? { label: option, value: option }
                            : option
                        ));
                        const filteredOptions = normalizedFitpicFilterSearch && !groupMatchesSearch
                          ? resolvedOptions.filter((option) => option.label.toLowerCase().includes(normalizedFitpicFilterSearch))
                          : resolvedOptions;
                        const noneLabel = `No ${section.label.toLowerCase()}`;
                        const showNoneOption = section.includeNone && (
                          !normalizedFitpicFilterSearch
                          || groupMatchesSearch
                          || noneLabel.includes(normalizedFitpicFilterSearch)
                        );
                        const isOpen = normalizedFitpicFilterSearch ? true : Boolean(fitpicFilterSectionsOpen[section.key]);
                        const groupedTagMatches = section.key === "tags"
                          ? fitpicTagFilterGroups
                            .map((group) => {
                              const groupMatches = group.options.filter((option) => (
                                !normalizedFitpicFilterSearch
                                || group.label.toLowerCase().includes(normalizedFitpicFilterSearch)
                                || option.label.toLowerCase().includes(normalizedFitpicFilterSearch)
                                || option.fullLabel.toLowerCase().includes(normalizedFitpicFilterSearch)
                              ));

                              if (!groupMatches.length) {
                                return null;
                              }

                              return { ...group, options: groupMatches };
                            })
                            .filter(Boolean)
                          : [];

                        if (!groupMatchesSearch && !filteredOptions.length && !groupedTagMatches.length && !showNoneOption) {
                          return null;
                        }

                        return (
                          <section key={section.key} className={`wardrobe-filter-group ${isOpen ? "is-open" : ""}`}>
                            <button
                              type="button"
                              className="wardrobe-filter-group-toggle"
                              onClick={() => toggleFitpicFilterSection(section.key)}
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
                                      getIncludedFilterValues(fitpicFilters, section.key).includes("__none__")
                                        ? "is-active"
                                        : getExcludedFilterValues(fitpicFilters, section.key).includes("__none__")
                                          ? "is-active is-muted is-excluded"
                                          : ""
                                    }`}
                                    onClick={(event) => toggleFitpicFilterValueWithMode(section.key, "__none__", event.shiftKey)}
                                    aria-pressed={
                                      getIncludedFilterValues(fitpicFilters, section.key).includes("__none__")
                                      || getExcludedFilterValues(fitpicFilters, section.key).includes("__none__")
                                    }
                                  >
                                    {noneLabel}
                                  </button>
                                ) : null}
                                {section.key === "tags" ? groupedTagMatches.length ? groupedTagMatches.map((group) => (
                                      <div key={group.family} className="fitpic-tag-filter-family">
                                        <div className="fitpic-tag-filter-family-header">
                                          <strong>{group.label}</strong>
                                          <span>{group.options.length}</span>
                                        </div>
                                        <div className="fitpic-tag-filter-family-options">
                                          {group.options.map((option) => {
                                            const isIncluded = getIncludedFilterValues(fitpicFilters, section.key).includes(option.value);
                                            const isExcluded = getExcludedFilterValues(fitpicFilters, section.key).includes(option.value);

                                            return (
                                              <button
                                                key={option.value}
                                                type="button"
                                                className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-muted is-excluded" : ""}`}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={(event) => toggleFitpicFilterValueWithMode(section.key, option.value, event.shiftKey)}
                                                aria-pressed={isIncluded || isExcluded}
                                                title={option.fullLabel}
                                              >
                                                {option.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))
                                  : <p className="wardrobe-filter-empty">No matching options.</p>
                                : filteredOptions.length ? filteredOptions.map((option) => {
                                  const isIncluded = section.kind === "multi"
                                    ? getIncludedFilterValues(fitpicFilters, section.key).includes(option.value)
                                    : false;
                                  const isExcluded = section.kind === "multi"
                                    ? getExcludedFilterValues(fitpicFilters, section.key).includes(option.value)
                                    : false;
                                  const isSelected = section.kind === "multi"
                                    ? isIncluded || isExcluded
                                    : fitpicFilters[section.key] === option.value;

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
                                          toggleFitpicFilterValueWithMode(section.key, option.value, event.shiftKey);
                                          return;
                                        }

                                        setFitpicToggleFilter(
                                          section.key,
                                          fitpicFilters[section.key] === option.value ? "" : option.value
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
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={clearFitpicFilters}
                        disabled={!hasActiveFitpicFilters}
                      >
                        Clear filters
                      </button>
                    </div>
                  </div>
                </div>
                <div className="wardrobe-sort-field">
                  <select
                    value={fitpicSort}
                    onPointerDown={() => {
                      if (fitpicFiltersOpen) {
                        dismissFitpicFilters();
                      }
                    }}
                    onFocus={() => {
                      if (fitpicFiltersOpen) {
                        dismissFitpicFilters();
                      }
                    }}
                    onChange={(event) => setFitpicSort(event.target.value)}
                  >
                    <option value="fitDateNewest">Fit date newest</option>
                    <option value="fitDateOldest">Fit date oldest</option>
                    <option value="createdNewest">Created newest</option>
                    <option value="importedNewest">Imported newest</option>
                    <option value="titleAz">Title A-Z</option>
                  </select>
                </div>
              </div>
                <span className="wardrobe-results-count">
                  {visibleFitpics.length} of {fitpics.length} fitpics
                </span>
              <div className="wardrobe-toolbar-context">
                <div className="wardrobe-toolbar-context-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={openFitpicExportDialog}
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleExportFitpicsCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleExportFitpicsJson}
                  >
                    Export JSON
                  </button>
                </div>
                {hasFitpicSelection ? (
                  <>
                    <div className="wardrobe-selection-summary fitpic-selection-summary">
                      <div className="wardrobe-selection-count wardrobe-selection-chip">
                        <span>{selectedFitpicCount} selected</span>
                        <button
                          type="button"
                          className="wardrobe-selection-clear wardrobe-selection-chip-clear"
                          onMouseDown={preventMouseButtonFocus}
                          onClick={clearFitpicSelection}
                          aria-label="Clear fitpic selection"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="wardrobe-toolbar-context-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={editSelectedFitpic}
                        disabled={!isSingleFitpicSelected}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`ghost-button ${areAllSelectedFitpicsFavorite ? "is-active" : ""}`}
                        onClick={toggleSelectedFitpicFavorites}
                      >
                        {fitpicFavoriteActionLabel}
                      </button>
                      <button
                        type="button"
                        className="ghost-button danger"
                        onClick={deleteSelectedFitpics}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            {fitpicFiltersOpen ? (
              <DismissibleBackdrop className="floating-backdrop filter-backdrop" onDismiss={closeFitpicFilters} />
            ) : null}
            {hasActiveFitpicFilters ? (
              <div className="active-filter-summary fitpic-controls-summary" aria-label="Active fitpic filters">
                <div className="active-filter-chips">
                  {activeFitpicFilterChips.map((filter) => (
                    <span
                      key={`${filter.key}-${filter.value}-${filter.excluded ? "excluded" : "included"}`}
                      className={`active-filter-chip ${filter.excluded ? "is-excluded" : ""}`}
                    >
                      <span>{filter.label}</span>
                      {filter.value}
                      <button
                        type="button"
                        className="active-filter-chip-clear"
                        onClick={() => clearSingleFitpicFilterValue(filter.key, filter.rawValue, filter.excluded)}
                        aria-label={`Remove ${filter.label} filter ${filter.value}`}
                        title={`Remove ${filter.label} filter ${filter.value}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={clearFitpicFilters}
                  disabled={!hasActiveFitpicFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            {!visibleFitpics.length ? (
              <div className="editor-placeholder fitpics-empty-state">
                <p>No fitpics match the current local search and filters.</p>
                <p>Clear the controls or import more fitpics.</p>
                <button type="button" className="ghost-button" onClick={resetFitpicControls}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="fitpic-list">
                {visibleFitpics.map((fitpic) => {
                  const isSelected = selectedFitpicIds.includes(fitpic.id);
                  const fitpicCardDateLabel = formatFitpicDate(fitpic.fitDate || fitpic.createdAt);
                  const fitpicCardAccessibleLabel = [
                    `Select ${fitpic.name}.`,
                    fitpicCardDateLabel ? `${fitpicCardDateLabel}.` : "",
                    "Double-click or press Enter to preview."
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                  <article
                    key={fitpic.id}
                    className={`fitpic-card ${isSelected ? "is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="fitpic-image-button"
                      onClick={(event) => handleFitpicCardClick(fitpic, event)}
                      onDoubleClick={(event) => handleFitpicCardDoubleClick(fitpic, event)}
                      onKeyDown={(event) => handleFitpicCardKeyDown(fitpic, event)}
                      aria-pressed={isSelected}
                      aria-label={fitpicCardAccessibleLabel}
                    >
                      <div className="fitpic-card-image-frame">
                        <img src={fitpic.imageData} alt="" />
                      </div>
                      <div className="fitpic-card-copy">
                        <strong title={fitpic.name}>{fitpic.name}</strong>
                        {fitpic.tags?.length ? (
                          <div className="fitpic-card-tags" aria-hidden="true">
                            {fitpic.tags.map((tag) => (
                              <span key={`${fitpic.id}-${tag}`} className="fitpic-card-tag">{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </article>
                  );
                })}
              </div>
            )}
          </>
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
            <strong>{activeItemCount}</strong>
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
    setSelectedSavedOutfitIds([savedOutfit.id]);
    setSavedOutfitSelectionAnchorId(savedOutfit.id);
    setEditingSavedOutfitId(savedOutfit.id);
    setSavedOutfitDraft({
      name: savedOutfit.name ?? "",
      description: savedOutfit.description ?? "",
      tagsText: Array.isArray(savedOutfit.tags) ? savedOutfit.tags.join(", ") : "",
      favorite: Boolean(savedOutfit.favorite)
    });
  }

  function cancelEditSavedOutfit() {
    setEditingSavedOutfitId(null);
    setSavedOutfitDraft({
      name: "",
      description: "",
      tagsText: "",
      favorite: false
    });
  }

  function submitSavedOutfit(event, savedOutfitId) {
    event.preventDefault();

    const trimmedName = savedOutfitDraft.name.trim();
    const trimmedDescription = savedOutfitDraft.description.trim();
    const nextTags = parseFitpicTagsInput(savedOutfitDraft.tagsText);
    const updatedAt = new Date().toISOString();

    setSavedOutfits((current) =>
      current.map((savedOutfit) =>
        savedOutfit.id === savedOutfitId
          ? {
              ...savedOutfit,
              name: trimmedName || savedOutfit.name,
              description: trimmedDescription,
              tags: nextTags,
              favorite: savedOutfitDraft.favorite,
              updatedAt
            }
          : savedOutfit
      )
    );

    cancelEditSavedOutfit();
  }

  function clearSavedOutfitSelection() {
    setSelectedSavedOutfitIds([]);
    setSavedOutfitSelectionAnchorId(null);
  }

  function resetSavedOutfitControls() {
    setSavedOutfitSearch("");
    setSavedOutfitSort("updatedNewest");
    setSavedOutfitFavoritesOnly(false);
    setSavedOutfitTagFilter("");
  }

  function editSelectedSavedOutfit() {
    if (selectedSavedOutfits.length !== 1) {
      return;
    }

    startEditSavedOutfit(selectedSavedOutfits[0]);
  }

  function toggleSelectedSavedOutfitFavorites() {
    if (!selectedSavedOutfitIds.length) {
      return;
    }

    const selectedIdSet = new Set(selectedSavedOutfitIds);
    const shouldFavorite = !areAllSelectedSavedOutfitsFavorite;
    const updatedAt = new Date().toISOString();

    setSavedOutfits((current) =>
      current.map((savedOutfit) =>
        selectedIdSet.has(savedOutfit.id)
          ? {
              ...savedOutfit,
              favorite: shouldFavorite,
              updatedAt
            }
          : savedOutfit
      )
    );
  }

  async function deleteSavedOutfitsById(savedOutfitIds) {
    const uniqueSavedOutfitIds = [...new Set((savedOutfitIds ?? []).filter(Boolean))];

    if (!uniqueSavedOutfitIds.length) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: uniqueSavedOutfitIds.length === 1 ? "Delete outfit?" : "Delete outfits?",
      message: uniqueSavedOutfitIds.length === 1
        ? "This saved outfit will be removed from this browser."
        : `${uniqueSavedOutfitIds.length} saved outfits will be removed from this browser.`,
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    const deletedIdSet = new Set(uniqueSavedOutfitIds);

    setSavedOutfits((current) => current.filter((savedOutfit) => !deletedIdSet.has(savedOutfit.id)));
    setSelectedSavedOutfitIds((current) => current.filter((savedOutfitId) => !deletedIdSet.has(savedOutfitId)));

    if (editingSavedOutfitId && deletedIdSet.has(editingSavedOutfitId)) {
      cancelEditSavedOutfit();
    }
  }

  async function deleteSelectedSavedOutfits() {
    await deleteSavedOutfitsById(selectedSavedOutfitIds);
  }

  async function deleteSavedOutfit(savedOutfitId) {
    await deleteSavedOutfitsById([savedOutfitId]);
  }

  function openFitpicPreview(fitpic) {
    closeUtilityWindows();
    setEditingFitpicId(null);
    setFitpicPreviewImageIndex(0);
    setFitpicPreview(fitpic);
  }

  function stepFitpicPreview(direction) {
    const nextFitpicId = direction === "previous"
      ? fitpicPreviewNavigation.previousFitpicId
      : fitpicPreviewNavigation.nextFitpicId;

    if (!nextFitpicId) {
      return;
    }

    const nextFitpic = fitpics.find((fitpic) => fitpic.id === nextFitpicId) ?? null;

    if (!nextFitpic) {
      return;
    }

    setFitpicPreviewImageIndex(0);
    setFitpicPreview(nextFitpic);
  }

  function stepFitpicPreviewImage(direction) {
    if (fitpicPreviewImages.length <= 1) {
      return;
    }

    setFitpicPreviewImageIndex((current) => {
      if (direction === "previous") {
        return current === 0 ? fitpicPreviewImages.length - 1 : current - 1;
      }

      return current === fitpicPreviewImages.length - 1 ? 0 : current + 1;
    });
  }

  function startEditFitpic(fitpic) {
    closeUtilityWindows();
    setFitpicPreview(null);
    setFitpicImportError("");
    setEditingFitpicId(fitpic.id);
    setFitpicDraft({
      name: fitpic.name ?? "",
      description: fitpic.description ?? "",
      tags: Array.isArray(fitpic.tags) ? fitpic.tags : [],
      tagInput: "",
      favorite: Boolean(fitpic.favorite),
      fitDate: getFitpicDateInputValue(fitpic.fitDate),
      fitpicImages: getFitpicImages(fitpic),
      primaryImageUuid: getPrimaryFitpicImage(fitpic)?.fitpicImageUuid ?? null,
      linkedItemUuids: Array.isArray(fitpic.linkedItemUuids) ? fitpic.linkedItemUuids : [],
      linkedItemIds: Array.isArray(fitpic.linkedItemIds) ? fitpic.linkedItemIds : [],
      linkedItemSearch: ""
    });
  }

  function cancelEditFitpic() {
    setEditingFitpicId(null);
    setFitpicImportError("");
    setFitpicDraft({
      name: "",
      description: "",
      tags: [],
      tagInput: "",
      favorite: false,
      fitDate: "",
      fitpicImages: [],
      primaryImageUuid: null,
      linkedItemUuids: [],
      linkedItemIds: [],
      linkedItemSearch: ""
    });
  }

  function saveFitpicDraft(event) {
    event.preventDefault();

    if (!editingFitpic) {
      cancelEditFitpic();
      return;
    }

    const trimmedName = fitpicDraft.name.trim();
    const nextTags = Array.isArray(fitpicDraft.tags) ? fitpicDraft.tags : [];
    const updatedAt = new Date().toISOString();
    const nextFitpic = normalizeFitpic({
      ...editingFitpic,
      name: trimmedName || editingFitpic.name,
      description: fitpicDraft.description.trim(),
      tags: nextTags,
      favorite: fitpicDraft.favorite,
      fitDate: applyFitpicDateInput(editingFitpic.fitDate, fitpicDraft.fitDate),
      fitpicImages: fitpicDraft.fitpicImages,
      primaryImageUuid: fitpicDraft.primaryImageUuid,
      linkedItemUuids: fitpicDraft.linkedItemUuids,
      linkedItemIds: fitpicDraft.linkedItemIds,
      updatedAt
    });

    setFitpics((current) =>
      current.map((fitpic) => (fitpic.id === nextFitpic.id ? nextFitpic : fitpic))
    );
    cancelEditFitpic();
  }

  function commitFitpicTagInput() {
    const normalizedInput = typeof fitpicDraft.tagInput === "string" ? fitpicDraft.tagInput.trim() : "";

    if (!normalizedInput) {
      return;
    }

    setFitpicDraft((current) => addFitpicTagsToDraft(current, current.tagInput));
  }

  function removeTagFromEditingFitpic(tag) {
    setFitpicDraft((current) => removeFitpicTagFromDraft(current, tag));
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

  async function importGroupedFitpicFiles(fileList) {
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
      const nextFitpic = await createImportedGroupedFitpicFromFiles(imageFiles, {
        createId: createFitpicId,
        readFileAsDataUrl,
        loadImage,
        compressImageSource
      });

      setFitpics((current) => [nextFitpic, ...current]);

      if (imageFiles.length !== files.length) {
        setFitpicImportError("Created a grouped fitpic from the image files and ignored non-image files.");
      }
    } catch (error) {
      setFitpicImportError(error?.message || "These images could not be imported together.");
    } finally {
      setFitpicImporting(false);
    }
  }

  async function handleGroupedFitpicUpload(event) {
    try {
      await importGroupedFitpicFiles(event.target.files);
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
      const importMetadata = await readImageFileMetadata(file, {
        readFileAsDataUrl,
        loadImage
      });
      const imageData = await compressImageSource(file);

      setFitpicDraft((current) => {
        const currentImages = Array.isArray(current.fitpicImages) ? current.fitpicImages : [];
        const primaryImageUuid = current.primaryImageUuid || currentImages[0]?.fitpicImageUuid || null;

        return {
          ...current,
          fitpicImages: currentImages.map((fitpicImage, index) =>
            fitpicImage.fitpicImageUuid === primaryImageUuid
              ? normalizeFitpicImage(
                  {
                    ...fitpicImage,
                    imageData,
                    images: {
                      ...(fitpicImage.images ?? {}),
                      preview: imageData
                    },
                    ...importMetadata
                  },
                  {
                    createUuid: createFitpicImageUuid,
                    fallbackTimestamp: importMetadata.importedAt,
                    fallbackOrder: index,
                    parentFitpicUuid: editingFitpic.fitpicUuid
                  }
                )
              : fitpicImage
          )
        };
      });
    } catch (error) {
      setFitpicImportError(error?.message || "This image could not be used.");
    } finally {
      event.target.value = "";
    }
  }

  async function addImagesToEditingFitpic(event) {
    const files = [...(event.target.files ?? [])];

    if (!files.length || !editingFitpic) {
      return;
    }

    try {
      setFitpicImportError("");
      const imageFiles = files.filter((file) => file?.type?.startsWith("image/"));

      if (!imageFiles.length) {
        setFitpicImportError("No image files were found.");
        return;
      }

      const nextFitpicImages = await Promise.all(
        imageFiles.map(async (file, index) => {
          const importMetadata = await readImageFileMetadata(file, {
            readFileAsDataUrl,
            loadImage
          });
          const imageData = await compressImageSource(file);

          return normalizeFitpicImage(
            {
              fitpicImageUuid: createFitpicImageUuid(),
              parentFitpicUuid: editingFitpic.fitpicUuid,
              order: editingFitpicImages.length + index,
              imageData,
              images: {
                preview: imageData
              },
              ...importMetadata
            },
            {
              createUuid: createFitpicImageUuid,
              fallbackTimestamp: importMetadata.importedAt,
              fallbackOrder: editingFitpicImages.length + index,
              parentFitpicUuid: editingFitpic.fitpicUuid
            }
          );
        })
      );

      setFitpicDraft((current) => addFitpicImagesToDraft(current, nextFitpicImages));

      if (imageFiles.length !== files.length) {
        setFitpicImportError("Added the image files and ignored non-image files.");
      }
    } catch (error) {
      setFitpicImportError(error?.message || "These images could not be added.");
    } finally {
      event.target.value = "";
    }
  }

  function removeImageFromEditingFitpic(fitpicImageUuid) {
    setFitpicDraft((current) => removeFitpicImageFromDraft(current, fitpicImageUuid));
  }

  function setPrimaryImageForEditingFitpic(fitpicImageUuid) {
    setFitpicDraft((current) => setPrimaryFitpicImageInDraft(current, fitpicImageUuid));
  }

  function moveEditingFitpicImage(fitpicImageUuid, direction) {
    setFitpicDraft((current) => moveFitpicImageInDraft(current, fitpicImageUuid, direction));
  }

  function resetFitpicControls() {
    setFitpicSearch("");
    setFitpicSort("fitDateNewest");
    clearFitpicFilters();
  }

  function clearSingleFitpicFilterValue(key, value, excluded = false) {
    if (key === "favorite") {
      setFitpicToggleFilter("favorite", "");
      return;
    }

    setFitpicFilters((current) => {
      const excludedKey = getExcludedFilterKey(key);
      return {
        ...current,
        [key]: excluded ? current[key] : current[key].filter((currentValue) => currentValue !== value),
        [excludedKey]: excluded ? current[excludedKey].filter((currentValue) => currentValue !== value) : current[excludedKey]
      };
    });
  }

  function clearFitpicSelection() {
    setSelectedFitpicIds([]);
    setFitpicSelectionAnchorId(null);
  }

  function editSelectedFitpic() {
    if (selectedFitpics.length !== 1) {
      return;
    }

    startEditFitpic(selectedFitpics[0]);
  }

  function toggleSelectedFitpicFavorites() {
    if (!selectedFitpicIds.length) {
      return;
    }

    const selectedIdSet = new Set(selectedFitpicIds);
    const shouldFavorite = !areAllSelectedFitpicsFavorite;
    const updatedAt = new Date().toISOString();

    setFitpics((current) =>
      current.map((fitpic) =>
        selectedIdSet.has(fitpic.id)
          ? normalizeFitpic({
              ...fitpic,
              favorite: shouldFavorite,
              updatedAt
            })
          : fitpic
      )
    );
  }

  async function deleteFitpicsById(fitpicIds) {
    const uniqueFitpicIds = [...new Set((fitpicIds ?? []).filter(Boolean))];

    if (!uniqueFitpicIds.length) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: uniqueFitpicIds.length === 1 ? "Delete fitpic?" : "Delete fitpics?",
      message: uniqueFitpicIds.length === 1
        ? "This fitpic will be removed from this browser."
        : `${uniqueFitpicIds.length} fitpics will be removed from this browser.`,
      confirmLabel: "Delete"
    });

    if (!confirmed) {
      return;
    }

    const deletedIdSet = new Set(uniqueFitpicIds);

    setFitpics((current) => current.filter((fitpic) => !deletedIdSet.has(fitpic.id)));
    setSelectedFitpicIds((current) => current.filter((fitpicId) => !deletedIdSet.has(fitpicId)));

    if (fitpicPreview?.id && deletedIdSet.has(fitpicPreview.id)) {
      setFitpicPreview(null);
    }

    if (editingFitpicId && deletedIdSet.has(editingFitpicId)) {
      cancelEditFitpic();
    }
  }

  async function deleteSelectedFitpics() {
    await deleteFitpicsById(selectedFitpicIds);
  }

  function addWardrobeItemToEditingFitpic(item) {
    setFitpicDraft((current) => ({
      ...addLinkedItemToFitpicDraft(current, item),
      linkedItemSearch: ""
    }));
  }

  function removeWardrobeItemFromEditingFitpic(linkedEntry) {
    setFitpicDraft((current) => removeLinkedItemFromFitpicDraft(current, linkedEntry));
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
    await deleteFitpicsById([fitpicId]);
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
              {draft.imageUrl.trim() ? "Add image" : "Choose image"}
              <input type="file" accept="image/*" multiple onChange={handleItemImageUpload} disabled={imageProcessing} />
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

      {draftWardrobeItemImages.length ? (
        <section className="editor-image-manager">
          <div className="editor-image-manager-header">
            <span>Item images</span>
            <span className="editor-image-manager-count">{draftWardrobeItemImages.length}</span>
          </div>
          <div className="editor-image-manager-list">
            {draftWardrobeItemImages.map((itemImage, index) => {
              const displayAsset = getWardrobeItemImageDisplayAsset(itemImage);
              const previewSrc =
                displayAsset?.images?.thumbnail?.src
                || displayAsset?.images?.preview?.src
                || displayAsset?.imageUrl
                || "";
              const isActive = itemImage.itemImageUuid === activeDraftWardrobeItemImage?.itemImageUuid;

              return (
                <div
                  key={itemImage.itemImageUuid}
                  className={`editor-image-manager-row ${isActive ? "is-active" : ""}`}
                >
                  <div className="editor-image-manager-thumb">
                    {previewSrc ? <img src={previewSrc} alt="" /> : <span>Image unavailable</span>}
                  </div>
                  <div className="editor-image-manager-body">
                    <div className="editor-image-manager-meta">
                      <span>{`Image ${index + 1}`}</span>
                      {isActive ? <span className="editor-image-manager-badge">Active</span> : null}
                    </div>
                    <div className="editor-image-manager-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setDraftActiveItemImage(itemImage.itemImageUuid)}
                        disabled={isActive || imageProcessing}
                      >
                        Set active
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => moveDraftItemImage(itemImage.itemImageUuid, "up")}
                        disabled={index === 0 || imageProcessing}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => moveDraftItemImage(itemImage.itemImageUuid, "down")}
                        disabled={index === draftWardrobeItemImages.length - 1 || imageProcessing}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => removeDraftItemImage(itemImage.itemImageUuid)}
                        disabled={draftWardrobeItemImages.length <= 1 || imageProcessing}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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

        <div className="editor-field">
          {renderAdvancedLabel("Garment", "garmentType", "item-editor-garment-type")}
          <select
            id="item-editor-garment-type"
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
        </div>

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
          <div className="editor-field">
            {renderAdvancedLabel("Status", "status", "item-editor-status")}
            <select id="item-editor-status" value={draft.status} onChange={(event) => setAdvancedField("status", event.target.value)}>
              {itemListOptions.map((list) => (
                <option key={list} value={list}>
                  {list}
                </option>
              ))}
            </select>
          </div>

          <div className="editor-favorite-field" aria-label="Favorite">
            <div className="editor-favorite-actions">
              {advancedOverrideSet.has("favorite") ? (
                <button
                  type="button"
                  className="editor-inline-reset"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    resetAdvancedField("favorite");
                  }}
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

        <div className="editor-span-2 editor-field-group">
          <span className="editor-field-label">Collections</span>
          <div className="editor-advanced-panel editor-styling-panel">
            <div className="metadata-tag-options">
              {normalizeCollections(draft.collections).map((collection) => (
                <button
                  key={`collection:${collection}`}
                  type="button"
                  className="list-toggle is-active"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeDraftCollection(collection);
                  }}
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
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDraftCollection();
                  }
                }}
                placeholder="Add collection"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={(event) => {
                  event.stopPropagation();
                  addDraftCollection();
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        <datalist id="item-collection-suggestions">
          {collectionOptions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>

        <div className="editor-field">
          {renderAdvancedLabel("Brand", "brand", "item-editor-brand")}
          <input
            id="item-editor-brand"
            list="item-brand-suggestions"
            value={draft.brand}
            onChange={(event) => setAdvancedField("brand", event.target.value)}
            placeholder="Brand"
          />
        </div>
        <datalist id="item-brand-suggestions">
          {brandSuggestions.map((brand) => (
            <option key={brand} value={brand} />
          ))}
        </datalist>

        <div className="editor-field">
          {renderAdvancedLabel("Name", "name", "item-editor-name")}
          <input
            id="item-editor-name"
            list="item-name-suggestions"
            value={draft.name}
            onChange={(event) => setAdvancedField("name", event.target.value)}
            placeholder=""
          />
        </div>
        <datalist id="item-name-suggestions">
          {nameSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="editor-span-2 editor-field">
          {renderAdvancedLabel("Description", "description", "item-editor-description")}
          <textarea
            id="item-editor-description"
            value={draft.description}
            onChange={(event) => setAdvancedField("description", event.target.value)}
            rows={2}
            placeholder="Notes, context, fabric, fit, or styling details"
          />
        </div>
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
            <div className="editor-field">
              {renderAdvancedLabel("Layer type", "layerType", "item-editor-layer-type")}
              <select
                id="item-editor-layer-type"
                value={draft.layerType}
                onChange={(event) => setAdvancedField("layerType", event.target.value)}
              >
                {layerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {draft.garmentType === "Accessory" ? (
            <div className="editor-field">
              {renderAdvancedLabel("Accessory slot", "accessorySlot", "item-editor-accessory-slot")}
              <select
                id="item-editor-accessory-slot"
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
            </div>
          ) : null}

          <div className="editor-field">
            {renderAdvancedLabel("Size", "size", "item-editor-size")}
            <input id="item-editor-size" value={draft.size} onChange={(event) => setAdvancedField("size", event.target.value)} placeholder="M" />
          </div>

          <div className="editor-field">
            {renderAdvancedLabel("Weight", "weight", "item-editor-weight")}
            <select id="item-editor-weight" value={draft.weight} onChange={(event) => setAdvancedField("weight", event.target.value)}>
              <option value="">No weight</option>
              {weightOptions.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>

          <div className="editor-field">
            {renderAdvancedLabel("Quantity", "quantity", "item-editor-quantity")}
            <input
              id="item-editor-quantity"
              inputMode="numeric"
              min="1"
              value={draft.quantity}
              onChange={(event) => setAdvancedField("quantity", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="1"
            />
          </div>

          <div className="editor-field">
            {renderAdvancedLabel("Paid value", "value", "item-editor-paid-value")}
            <input
              id="item-editor-paid-value"
              inputMode="numeric"
              value={draft.value}
              onChange={(event) => setAdvancedField("value", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="120"
            />
          </div>

          <div className="editor-field">
            {renderAdvancedLabel("Retail value", "retailValue", "item-editor-retail-value")}
            <input
              id="item-editor-retail-value"
              inputMode="numeric"
              value={draft.retailValue}
              onChange={(event) => setAdvancedField("retailValue", event.target.value.replace(/[^\d]/g, ""))}
              placeholder="280"
            />
          </div>
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
                    key={`style-tag:${tag}`}
                    type="button"
                    className={`list-toggle ${isSelected ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDraftTag("styleTags", tag, styleTagOptions);
                    }}
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
                    key={`climate-tag:${tag}`}
                    type="button"
                    className={`list-toggle ${isSelected ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDraftTag("climateTags", tag, editableClimateTagOptions);
                    }}
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
    const isActionsOpen = activeSlotActionsSlot === slot;
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
            {item ? <ManagedItemImage item={item} alt={item.name} dataItemId={item.id} useFrameScale normalizeToFrameScale useCrop usePresentation perfSlot={slot} /> : <span aria-hidden="true" />}
          </button>
          {item ? (
            <div className="slot-actions-anchor">
              <div className="outfit-slot-hover-actions slot-action-chips">
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
                <button
                  type="button"
                  className={`outfit-slot-hover-button slot-actions-trigger ${isActionsOpen ? "is-active" : ""}`}
                  onMouseDown={preventMouseButtonFocus}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSlotActionsPopover(slot);
                  }}
                  aria-expanded={isActionsOpen}
                  aria-label={`${getSlotLabel(slot)} actions`}
                  title="Actions"
                >
                  Actions
                </button>
                {isActionsOpen ? (
                  <div
                    ref={slotActionsPopoverRef}
                    className="slot-actions-inline-tools"
                    role="group"
                    aria-label={`${getSlotLabel(slot)} actions`}
                  >
                    <button
                      type="button"
                      className={`ghost-button slot-action-icon-button ${locked[slot] ? "is-active" : ""}`}
                      onClick={() => toggleLock(slot)}
                      aria-label={locked[slot] ? `Unlock ${getSlotLabel(slot)}` : `Lock ${getSlotLabel(slot)}`}
                      title={locked[slot] ? "Unlock" : "Lock"}
                    >
                      <SlotActionIcon kind="lock" locked={locked[slot]} />
                    </button>
                    <button
                      type="button"
                      className="ghost-button slot-action-icon-button"
                      onClick={() => handleReroll(slot)}
                      aria-label={`Reroll ${getSlotLabel(slot)}`}
                      title="Reroll"
                      disabled={!item}
                    >
                      <SlotActionIcon kind="reroll" />
                    </button>
                    <button
                      type="button"
                      className="ghost-button slot-action-icon-button"
                      onClick={() => cycleOutfitSlot(slot, -1)}
                      aria-label={`Previous item for ${getSlotLabel(slot)}`}
                      title="Previous"
                      disabled={!item}
                    >
                      <SlotActionIcon kind="previous" />
                    </button>
                    <button
                      type="button"
                      className="ghost-button slot-action-icon-button"
                      onClick={() => cycleOutfitSlot(slot, 1)}
                      aria-label={`Next item for ${getSlotLabel(slot)}`}
                      title="Next"
                      disabled={!item}
                    >
                      <SlotActionIcon kind="next" />
                    </button>
                    <button
                      type="button"
                      className="ghost-button danger slot-action-icon-button"
                      onClick={() => removeOutfitSlot(slot)}
                      aria-label={`Remove item from ${getSlotLabel(slot)}`}
                      title="Remove"
                      disabled={!item}
                    >
                      <SlotActionIcon kind="remove" />
                    </button>
                  </div>
                ) : null}
              </div>
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
                  <span>{outfitFiltersControlSummary}</span>
                </button>

                {outfitFiltersOpen ? (
                  <div className="outfit-filters-panel">
                    <div className="outfit-filter-view-row">
                      <span className="eyebrow">view</span>
                      <select
                        aria-label="Saved wardrobe view for outfit filters"
                        value={matchingOutfitFiltersSavedWardrobeViewId || "__custom__"}
                        onChange={(event) => {
                          const nextViewId = event.target.value;

                          if (!nextViewId || nextViewId === "__custom__") {
                            return;
                          }

                          const nextView = savedWardrobeViews.find((view) => view.id === nextViewId);

                          if (nextView) {
                            applyOutfitFiltersSavedWardrobeView(nextView);
                          }
                        }}
                        disabled={!savedWardrobeViews.length}
                      >
                        <option value="__custom__">
                          {savedWardrobeViews.length
                            ? (matchingOutfitFiltersSavedWardrobeView?.name ?? "Custom")
                            : "No saved views"}
                        </option>
                        {savedWardrobeViews.map((view) => (
                          <option key={view.id} value={view.id}>
                            {view.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className={`ghost-button outfit-filters-advanced-toggle ${outfitFiltersAdvancedOpen ? "is-active" : ""}`}
                      onClick={() => setOutfitFiltersAdvancedOpen((current) => !current)}
                      aria-expanded={outfitFiltersAdvancedOpen}
                    >
                      {outfitFiltersAdvancedOpen ? "Hide Filters" : "More Filters"}
                    </button>

                    {outfitFiltersAdvancedOpen ? (
                      <div className="outfit-filter-groups">
                        {outfitFilterSections.map((section) => {
                          const isOpen = Boolean(outfitFilterSectionsOpen[section.key]);

                          return (
                            <section key={section.key} className={`outfit-filter-section ${isOpen ? "is-open" : ""}`}>
                              <button
                                type="button"
                                className="outfit-filter-section-toggle"
                                onClick={() => toggleOutfitFilterSection(section.key)}
                                aria-expanded={isOpen}
                              >
                                <span className="outfit-filter-section-copy">
                                  <strong>{section.label}</strong>
                                  <span className="outfit-filter-section-summary">{section.summary}</span>
                                </span>
                                <span className="outfit-filter-section-icon" aria-hidden="true">
                                  {isOpen ? "⌄" : "›"}
                                </span>
                              </button>

                              {isOpen ? (
                                <div className="outfit-filter-options">
                                  {section.key === "status"
                                    ? section.options.map((list) => {
                                      const isSelected = isGenerationListEnabled(list);
                                      const isExcluded = isGenerationListExcluded(list);

                                      return (
                                        <button
                                          key={list}
                                          type="button"
                                          className={`list-toggle ${isSelected ? "is-active" : isExcluded ? "is-active is-excluded" : ""}`}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={(event) => toggleGenerationListWithMode(list, event.shiftKey)}
                                          aria-pressed={isSelected || isExcluded}
                                        >
                                          {list}
                                        </button>
                                      );
                                    })
                                    : section.options.map((option) => {
                                      const isIncluded = getIncludedFilterValues(outfitFilters, section.key).includes(option);
                                      const isExcluded = getExcludedFilterValues(outfitFilters, section.key).includes(option);
                                      const isSelected = isIncluded || isExcluded;

                                      return (
                                        <button
                                          key={option}
                                          type="button"
                                          className={`list-toggle ${isIncluded ? "is-active" : isExcluded ? "is-active is-excluded" : ""}`}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={(event) => toggleOutfitFilter(section.key, option, event.shiftKey)}
                                          aria-pressed={isSelected}
                                        >
                                          {option}
                                        </button>
                                      );
                                    })}
                                </div>
                              ) : null}
                            </section>
                          );
                        })}

                        <button type="button" className="ghost-button outfit-filters-clear-button" onClick={clearOutfitFilters}>
                          Clear outfit filters
                        </button>
                      </div>
                    ) : null}
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
          <DismissibleBackdrop className="floating-backdrop active-panel-backdrop" onDismiss={closeWorkspacePanel}>
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
                        <section className="wardrobe-filter-group wardrobe-saved-views-group is-open">
                          <div className="wardrobe-filter-group-toggle wardrobe-filter-group-toggle-static">
                            <span className="wardrobe-filter-group-copy">
                              <strong>Views</strong>
                            </span>
                            <button
                              type="button"
                              className="ghost-button saved-wardrobe-view-save-button"
                              onClick={handleSaveCurrentWardrobeView}
                            >
                              + Save
                            </button>
                          </div>
                          <div className="wardrobe-filter-options wardrobe-saved-views-list">
                            {savedWardrobeViews.length ? savedWardrobeViews.map((view) => {
                              const isCurrentView = view.id === matchingSavedWardrobeViewId;

                              return (
                                <div key={view.id} className={`saved-wardrobe-view-row ${isCurrentView ? "is-current" : ""}`}>
                                  <button
                                    type="button"
                                    className="ghost-button saved-wardrobe-view-apply"
                                    onClick={(event) => applyWardrobeSavedView(view, event)}
                                  >
                                    <span className="saved-wardrobe-view-label">
                                      {view.pinned ? <span className="saved-wardrobe-view-pin" aria-hidden="true">📌</span> : null}
                                      <span>{view.name}</span>
                                    </span>
                                  </button>
                                  <div className="saved-wardrobe-view-actions">
                                    <button
                                      type="button"
                                      className="ghost-button saved-wardrobe-view-action"
                                      onClick={() => handleTogglePinnedSavedWardrobeView(view)}
                                      aria-label={view.pinned ? `Unpin ${view.name}` : `Pin ${view.name}`}
                                      title={view.pinned ? "Unpin" : "Pin"}
                                    >
                                      {view.pinned ? "📍" : "📌"}
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button saved-wardrobe-view-action"
                                      onClick={() => handleRenameSavedWardrobeView(view)}
                                      aria-label={`Rename ${view.name}`}
                                      title="Rename"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button saved-wardrobe-view-action danger"
                                      onClick={() => handleDeleteSavedWardrobeView(view)}
                                      aria-label={`Delete ${view.name}`}
                                      title="Delete"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            }) : (
                              <p className="wardrobe-filter-empty">No saved views yet.</p>
                            )}
                          </div>
                        </section>
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
                              <button type="button" className="ghost-button" onClick={openOaAiExportDialog}>
                                Export OA AI
                              </button>
                              <button type="button" className="ghost-button" onClick={handleExportLibraryCsv}>
                                Export Library CSV
                              </button>
                              <button type="button" className="ghost-button" onClick={handleExportBackup}>
                                Export Backup
                              </button>
                              <button type="button" className="ghost-button" onClick={handleExportBackupV2}>
                                Export Backup v2
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
              <DismissibleBackdrop className="floating-backdrop filter-backdrop" onDismiss={closeWardrobeFilters} />
            ) : null}

            {wardrobeManageOpen ? (
              <DismissibleBackdrop
                className="floating-backdrop filter-backdrop"
                onDismiss={() => setWardrobeManageOpen(false)}
              />
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
          </DismissibleBackdrop>
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

        <FitpicExportDialog
          open={Boolean(fitpicExportOptions)}
          options={fitpicExportOptions ?? createFitpicSpreadExportOptions("reference")}
          onChange={setFitpicExportOptions}
          onCancel={() => setFitpicExportOptions(null)}
          onConfirm={handleConfirmFitpicExport}
        />

        <OaAiExportDialog
          open={Boolean(oaAiExportOptions)}
          options={oaAiExportOptions ?? createDefaultOaAiExportOptions(collectionOptions)}
          collections={collectionOptions}
          exporting={oaAiExporting}
          onChange={setOaAiExportOptions}
          onCancel={() => {
            if (!oaAiExporting) {
              setOaAiExportOptions(null);
            }
          }}
          onConfirm={handleConfirmOaAiExport}
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
                  item={wardrobePreviewDisplayItem ?? wardrobePreviewItem}
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
                {wardrobePreviewDisplayAsset?.imageUrl?.trim() ? null : (
                  <div className="wardrobe-item-preview-image-empty">Image unavailable.</div>
                )}
              </div>
              {wardrobePreviewImageNavigation.showCarousel ? (
                <div className="wardrobe-item-preview-carousel" aria-label="Wardrobe item images">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={showPreviousWardrobePreviewImage}
                    aria-label="Previous image for this wardrobe item"
                    title="Previous image"
                  >
                    ◀
                  </button>
                  <div className="wardrobe-item-preview-image-indicator" aria-label="Current wardrobe item image">
                    {wardrobePreviewImageNavigation.currentIndex + 1} / {wardrobePreviewImageNavigation.totalCount}
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={showNextWardrobePreviewImage}
                    aria-label="Next image for this wardrobe item"
                    title="Next image"
                  >
                    ▶
                  </button>
                </div>
              ) : null}
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
          eyebrow=""
          title={fitpicPreview?.name ?? ""}
          meta={fitpicPreview ? formatFitpicDate(fitpicPreview.fitDate || fitpicPreview.createdAt) : null}
          onClose={() => {
            setFitpicPreviewImageIndex(0);
            setFitpicPreview(null);
          }}
          actions={fitpicPreview ? (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => stepFitpicPreview("previous")}
                disabled={!fitpicPreviewNavigation.previousFitpicId}
              >
                Previous
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => stepFitpicPreview("next")}
                disabled={!fitpicPreviewNavigation.nextFitpicId}
              >
                Next
              </button>
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
              <div className="fitpic-preview-image-frame">
                {fitpicPreviewImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="preview-overlay-nav preview-overlay-nav-left"
                      onClick={() => stepFitpicPreviewImage("previous")}
                      aria-label="Previous image in fitpic"
                      title="Previous image"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>
                    <button
                      type="button"
                      className="preview-overlay-nav preview-overlay-nav-right"
                      onClick={() => stepFitpicPreviewImage("next")}
                      aria-label="Next image in fitpic"
                      title="Next image"
                    >
                      <span aria-hidden="true">›</span>
                    </button>
                    <div className="fitpic-preview-image-indicator" aria-label="Current fitpic image">
                      {fitpicPreviewImageIndex + 1} / {fitpicPreviewImages.length}
                    </div>
                  </>
                ) : null}
                {activePreviewFitpicImage ? (
                  <img
                    className="preview-overlay-fitpic-image"
                    src={activePreviewFitpicImage.imageData}
                    alt={fitpicPreview.name}
                  />
                ) : (
                  <div className="fitpic-preview-image-empty">Image unavailable.</div>
                )}
              </div>
              {(fitpicPreview.description || fitpicPreview.tags.length || fitpicPreviewLinkedItems.length) ? (
                <div className="fitpic-preview-copy">
                  {fitpicPreview.description ? <p className="fitpic-preview-description">{fitpicPreview.description}</p> : null}
                  {fitpicPreview.tags.length ? <p className="fitpic-preview-tags">{fitpicPreview.tags.join(" · ")}</p> : null}
                  {fitpicPreviewLinkedItems.length ? (
                    <div className="fitpic-preview-linked-items">
                      <div className="fitpic-preview-linked-list">
                        {fitpicPreviewLinkedItems.map((linkedEntry) =>
                          linkedEntry.missing ? (
                            <span key={linkedEntry.key} className="fitpic-preview-linked-item is-missing">
                              Missing wardrobe item
                            </span>
                          ) : (
                            <button
                              key={linkedEntry.key}
                              type="button"
                              className="fitpic-preview-linked-item"
                              onClick={() => openWardrobePreviewFromFitpicPreview(linkedEntry.itemId)}
                            >
                              {linkedEntry.label}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}
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
                <img
                  className="fitpic-editor-image"
                  src={editingFitpicPrimaryImage?.imageData || editingFitpic.imageData}
                  alt={editingFitpic.name}
                />
                <div className="fitpic-editor-media-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => fitpicReplaceInputRef.current?.click()}
                  >
                    Replace image
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => fitpicAddImagesInputRef.current?.click()}
                  >
                    Add image
                  </button>
                  <input
                    ref={fitpicReplaceInputRef}
                    type="file"
                    accept="image/*"
                    className="fitpic-file-input"
                    onChange={replaceEditingFitpicImage}
                  />
                  <input
                    ref={fitpicAddImagesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="fitpic-file-input"
                    onChange={addImagesToEditingFitpic}
                  />
                </div>
                <div className="fitpic-editor-image-list" aria-label="Fitpic images">
                  {editingFitpicImages.map((fitpicImage, index) => {
                    const isPrimary = fitpicImage.fitpicImageUuid === fitpicDraft.primaryImageUuid;
                    const imageFilename = fitpicImage.sourceOriginalFilename || `Image ${fitpicImage.order + 1}`;
                    const canRemove = editingFitpicImages.length > 1;
                    const canMoveUp = index > 0;
                    const canMoveDown = index < editingFitpicImages.length - 1;

                    return (
                      <div
                        key={fitpicImage.fitpicImageUuid}
                        className={`fitpic-editor-image-row ${isPrimary ? "is-primary" : ""}`}
                      >
                        <img
                          className="fitpic-editor-image-thumb"
                          src={fitpicImage.images?.thumbnail || fitpicImage.images?.preview || fitpicImage.imageData}
                          alt={imageFilename}
                        />
                        <div className="fitpic-editor-image-copy">
                          <strong>{imageFilename}</strong>
                          <span>{isPrimary ? "Primary image" : `Image ${fitpicImage.order + 1}`}</span>
                        </div>
                        <div className="fitpic-editor-image-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => moveEditingFitpicImage(fitpicImage.fitpicImageUuid, "up")}
                            disabled={!canMoveUp}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => moveEditingFitpicImage(fitpicImage.fitpicImageUuid, "down")}
                            disabled={!canMoveDown}
                          >
                            Move down
                          </button>
                          {!isPrimary ? (
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => setPrimaryImageForEditingFitpic(fitpicImage.fitpicImageUuid)}
                            >
                              Set primary
                            </button>
                          ) : (
                            <span className="fitpic-editor-image-primary-indicator">Primary</span>
                          )}
                          <button
                            type="button"
                            className="ghost-button danger"
                            onClick={() => removeImageFromEditingFitpic(fitpicImage.fitpicImageUuid)}
                            disabled={!canRemove}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="fitpic-editor-fields">
                <label>
                  <span className="editor-label-row"><span>Name / title</span></span>
                  <input
                    className="fitpic-editor-title-input"
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
                    className="fitpic-editor-description-input"
                    rows="6"
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
                  <div className="fitpic-tag-editor">
                    {fitpicDraft.tags.length ? (
                      <div className="fitpic-tag-chip-list" aria-label="Fitpic tags">
                        {fitpicDraft.tags.map((tag) => (
                          <span key={tag} className="fitpic-tag-chip">
                            <span>{tag}</span>
                            <button
                              type="button"
                              className="fitpic-tag-chip-remove"
                              onClick={() => removeTagFromEditingFitpic(tag)}
                              aria-label={`Remove ${tag} tag`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <input
                      value={fitpicDraft.tagInput}
                      onChange={(event) => {
                        const nextValue = event.target.value;

                        if (nextValue.includes(",")) {
                          setFitpicDraft((current) => addFitpicTagsToDraft(current, nextValue));
                          return;
                        }

                        setFitpicDraft((current) => ({
                          ...current,
                          tagInput: nextValue
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitFitpicTagInput();
                        }
                      }}
                      onBlur={commitFitpicTagInput}
                      placeholder="Type a tag and press Enter"
                    />
                  </div>
                </label>

                <label>
                  <span className="editor-label-row"><span>Fit date</span></span>
                  <input
                    type="date"
                    value={fitpicDraft.fitDate}
                    onChange={(event) =>
                      setFitpicDraft((current) => ({
                        ...current,
                        fitDate: event.target.value
                      }))
                    }
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

                <div className="fitpic-linked-items">
                  <div className="editor-label-row">
                    <span>Linked wardrobe items</span>
                  </div>
                  {editingFitpicLinkedItems.length ? (
                    <div className="fitpic-linked-items-list">
                      {editingFitpicLinkedItems.map((linkedEntry) => (
                        <div key={linkedEntry.key} className={`fitpic-linked-item ${linkedEntry.missing ? "is-missing" : ""}`}>
                          <div className="fitpic-linked-item-copy">
                            <strong>{linkedEntry.label}</strong>
                            <span>{linkedEntry.missing ? "Missing wardrobe item" : "Linked wardrobe item"}</span>
                          </div>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => removeWardrobeItemFromEditingFitpic(linkedEntry)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="fitpic-linked-items-empty">No linked wardrobe items.</p>
                  )}

                  <label>
                    <span className="editor-label-row"><span>Add wardrobe items</span></span>
                    <input
                      value={fitpicDraft.linkedItemSearch}
                      onChange={(event) =>
                        setFitpicDraft((current) => ({
                          ...current,
                          linkedItemSearch: event.target.value
                        }))
                      }
                      placeholder="Search wardrobe items"
                    />
                  </label>

                  {fitpicLinkedItemSuggestions.length ? (
                    <div className="fitpic-linked-item-suggestions">
                      {fitpicLinkedItemSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="fitpic-linked-item-suggestion"
                          onClick={() => addWardrobeItemToEditingFitpic(item)}
                        >
                          <strong>{buildDisplayName(item)}</strong>
                          <span>{item.type || item.garmentType || "Wardrobe item"}</span>
                        </button>
                      ))}
                    </div>
                  ) : fitpicLinkedItemSearch ? (
                    <p className="fitpic-linked-items-empty">No matching wardrobe items.</p>
                  ) : null}
                </div>

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
