import {
  defaultGenerationLists,
  getOutfitKey,
  normalizeGenerationMode,
  normalizeLikedOutfitKeys,
  normalizeOutfitAffinity,
  normalizeOutfitFilters,
  normalizeRecentOutfits
} from "./generation.js";
import { normalizeWardrobeSort } from "./itemModel.js";

export function normalizeGenerationLists(generationLists) {
  return {
    ...defaultGenerationLists,
    ...(generationLists ?? {})
  };
}

export function normalizeSavedOutfit(savedOutfit) {
  return {
    id: savedOutfit.id,
    name: savedOutfit.name ?? "Saved outfit",
    description: savedOutfit.description ?? "",
    outfit: savedOutfit.outfit ?? {},
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

export function normalizeHydratedAppState(appStateLike, { fallbackOutfit, normalizeWeatherSettings }) {
  return {
    layering: Boolean(appStateLike?.layering),
    accessoriesEnabled: appStateLike?.accessoriesEnabled ?? true,
    locked: appStateLike?.locked ?? {},
    excluded: appStateLike?.excluded ?? {},
    outfit: appStateLike?.outfit ?? fallbackOutfit,
    guidedDebugPayload: [],
    ignoredImportImages: appStateLike?.ignoredImportImages ?? [],
    savedOutfits: normalizeSavedOutfits(appStateLike?.savedOutfits),
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
    wardrobeSort: normalizeWardrobeSort(appStateLike?.wardrobeSort)
  };
}
