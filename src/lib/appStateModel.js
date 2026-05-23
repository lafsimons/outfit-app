import {
  defaultGenerationLists,
  getOutfitKey,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits
} from "./generation.js";
import { normalizeFitpics } from "./fitpics.js";
import { normalizeWardrobeFilters, normalizeWardrobeSort } from "./wardrobeLibrary.js";

const MIN_EDITOR_WIDTH = 344;
const MAX_EDITOR_WIDTH = 520;
const DEFAULT_EDITOR_WIDTH = 396;

export function normalizeEditorWindowState(windowStateLike, fallbackWidth = DEFAULT_EDITOR_WIDTH) {
  const numericWidth = Number(windowStateLike?.width);
  const normalizedFallbackWidth = Number.isFinite(fallbackWidth) ? fallbackWidth : DEFAULT_EDITOR_WIDTH;
  const width = Number.isFinite(numericWidth)
    ? Math.max(MIN_EDITOR_WIDTH, Math.min(MAX_EDITOR_WIDTH, Math.round(numericWidth)))
    : normalizedFallbackWidth;

  return { width };
}

export function normalizeWindowState(windowStateLike) {
  return {
    outfitEditor: normalizeEditorWindowState(windowStateLike?.outfitEditor),
    wardrobeEditor: normalizeEditorWindowState(windowStateLike?.wardrobeEditor),
    addImagesWindow: normalizeEditorWindowState(windowStateLike?.addImagesWindow)
  };
}

export function createOutfitUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `outfit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeOutfitUuid(value, createUuid = createOutfitUuid) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return createUuid();
}

export function normalizeGenerationLists(generationLists) {
  return {
    ...defaultGenerationLists,
    ...(generationLists ?? {})
  };
}

export function normalizeOutfitItemUuids(outfitItemUuids) {
  if (!outfitItemUuids || typeof outfitItemUuids !== "object" || Array.isArray(outfitItemUuids)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(outfitItemUuids).map(([slot, itemUuid]) => [
      slot,
      typeof itemUuid === "string" && itemUuid.trim() ? itemUuid : null
    ])
  );
}

export function backfillOutfitItemUuids(outfit, outfitItemUuids, itemsById) {
  const normalizedSidecar = normalizeOutfitItemUuids(outfitItemUuids);

  return Object.fromEntries(
    Object.entries(outfit ?? {}).map(([slot, itemId]) => {
      if (!itemId) {
        return [slot, null];
      }

      const resolvedItemUuid = itemId ? itemsById?.[itemId]?.itemUuid : null;
      return [slot, resolvedItemUuid ?? normalizedSidecar[slot] ?? null];
    })
  );
}

export function normalizeSavedOutfit(savedOutfit, { createOutfitUuid: createUuid = createOutfitUuid } = {}) {
  return {
    id: savedOutfit.id,
    outfitUuid: normalizeOutfitUuid(savedOutfit.outfitUuid, createUuid),
    name: savedOutfit.name ?? "Saved outfit",
    description: savedOutfit.description ?? "",
    outfit: savedOutfit.outfit ?? {},
    outfitItemUuids: normalizeOutfitItemUuids(savedOutfit.outfitItemUuids),
    layering: Boolean(savedOutfit.layering)
  };
}

export function normalizeSavedOutfits(savedOutfits, { createOutfitUuid: createUuid = createOutfitUuid } = {}) {
  if (!Array.isArray(savedOutfits)) {
    return [];
  }

  const seenOutfitKeys = new Set();

  return savedOutfits.reduce((normalized, savedOutfit) => {
    const nextSavedOutfit = normalizeSavedOutfit(savedOutfit, { createOutfitUuid: createUuid });
    const outfitKey = getOutfitKey(nextSavedOutfit.outfit, nextSavedOutfit.layering);

    if (seenOutfitKeys.has(outfitKey)) {
      return normalized;
    }

    seenOutfitKeys.add(outfitKey);
    normalized.push(nextSavedOutfit);
    return normalized;
  }, []);
}

export function normalizeHydratedAppState(
  appStateLike,
  { fallbackOutfit, normalizeWeatherSettings, itemsById = {}, createOutfitUuid: createUuid = createOutfitUuid }
) {
  const outfit = appStateLike?.outfit ?? fallbackOutfit;

  return {
    layering: Boolean(appStateLike?.layering),
    accessoriesEnabled: appStateLike?.accessoriesEnabled ?? true,
    locked: appStateLike?.locked ?? {},
    excluded: appStateLike?.excluded ?? {},
    outfit,
    outfitItemUuids: backfillOutfitItemUuids(outfit, appStateLike?.outfitItemUuids, itemsById),
    guidedDebugPayload: [],
    ignoredImportImages: appStateLike?.ignoredImportImages ?? [],
    savedOutfits: normalizeSavedOutfits(appStateLike?.savedOutfits, { createOutfitUuid: createUuid }).map((savedOutfit) => ({
      ...savedOutfit,
      outfitItemUuids: backfillOutfitItemUuids(savedOutfit.outfit, savedOutfit.outfitItemUuids, itemsById)
    })),
    likedOutfitKeys: normalizeLikedOutfitKeys(appStateLike?.likedOutfitKeys),
    outfitAffinity: normalizeOutfitAffinity(appStateLike?.outfitAffinity),
    recentOutfits: normalizeRecentOutfits(appStateLike?.recentOutfits),
    generateCount: Math.max(0, Math.round(Number(appStateLike?.generateCount) || 0)),
    generationLists: normalizeGenerationLists(appStateLike?.generationLists),
    generationMode: normalizeGenerationMode(appStateLike?.generationMode),
    outfitFilters: normalizeOutfitFilters(appStateLike?.outfitFilters),
    weatherSettings: normalizeWeatherSettings(appStateLike?.weatherSettings),
    weatherLocationDraft: appStateLike?.weatherSettings?.locationName ?? "",
    weatherData: appStateLike?.weatherData ?? null,
    fitpics: normalizeFitpics(appStateLike?.fitpics),
    wardrobeFilters: normalizeWardrobeFilters(appStateLike?.wardrobeFilters),
    wardrobeSort: normalizeWardrobeSort(appStateLike?.wardrobeSort),
    windowState: normalizeWindowState(appStateLike?.windowState)
  };
}
