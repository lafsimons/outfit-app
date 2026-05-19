import {
  defaultGenerationLists,
  getOutfitKey,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits
} from "./generation.js";
import { normalizeWardrobeFilters, normalizeWardrobeSort } from "./itemModel.js";

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

export function normalizeSavedOutfit(savedOutfit) {
  return {
    id: savedOutfit.id,
    name: savedOutfit.name ?? "Saved outfit",
    description: savedOutfit.description ?? "",
    outfit: savedOutfit.outfit ?? {},
    outfitItemUuids: normalizeOutfitItemUuids(savedOutfit.outfitItemUuids),
    layering: Boolean(savedOutfit.layering)
  };
}

export function normalizeSavedOutfits(savedOutfits) {
  if (!Array.isArray(savedOutfits)) {
    return [];
  }

  const seenOutfitKeys = new Set();

  return savedOutfits.reduce((normalized, savedOutfit) => {
    const nextSavedOutfit = normalizeSavedOutfit(savedOutfit);
    const outfitKey = getOutfitKey(nextSavedOutfit.outfit, nextSavedOutfit.layering);

    if (seenOutfitKeys.has(outfitKey)) {
      return normalized;
    }

    seenOutfitKeys.add(outfitKey);
    normalized.push(nextSavedOutfit);
    return normalized;
  }, []);
}

export function normalizeHydratedAppState(appStateLike, { fallbackOutfit, normalizeWeatherSettings, itemsById = {} }) {
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
    savedOutfits: normalizeSavedOutfits(appStateLike?.savedOutfits).map((savedOutfit) => ({
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
    fitpics: appStateLike?.fitpics ?? [],
    wardrobeFilters: normalizeWardrobeFilters(appStateLike?.wardrobeFilters),
    wardrobeSort: normalizeWardrobeSort(appStateLike?.wardrobeSort)
  };
}
