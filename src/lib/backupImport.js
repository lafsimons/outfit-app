import { resolveDuplicateItemUuids } from "./itemModel.js";

async function mapSequential(values, mapper) {
  const list = Array.isArray(values) ? values : [];
  const results = [];

  for (const [index, value] of list.entries()) {
    results.push(await mapper(value, index));
  }

  return results;
}

export async function prepareBackupImport(
  backup,
  {
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
    migrationVersions,
    migrateWardrobeItemThumbnailDerivatives = async (item) => item,
    migrateFitpicThumbnailDerivatives = async (fitpic) => fitpic
  }
) {
  const nextItems = Array.isArray(backup?.items) ? backup.items : [];
  const nextAppState = backup?.appState ?? {};
  const fallbackTimestampBaseMs = Date.now() - Math.max(nextItems.length - 1, 0) * 1000;
  const shouldApplyStyleWeightMigration =
    (nextAppState?.itemDefaultsMigrationVersion ?? 0) < migrationVersions.itemDefaults;
  const shouldApplyImagePresentationMigration =
    (nextAppState?.imagePresentationMigrationVersion ?? 0) < migrationVersions.imagePresentation;
  const shouldApplyThumbnailDerivativeMigration =
    (nextAppState?.thumbnailDerivativeMigrationVersion ?? 0) < migrationVersions.thumbnailDerivative;
  const fitpicMediaMigrationVersion = Number(migrationVersions?.fitpicMedia) || 0;

  const normalizedItems = nextItems
    .map((item, index) => normalizeStoredItem(item, createFallbackItemTimestamp(fallbackTimestampBaseMs, index)))
    .map((item) =>
      shouldApplyImagePresentationMigration
        ? restoreLegacyBakedImageScale(item)
        : item
    );

  const styleWeightedItems = shouldApplyStyleWeightMigration
    ? normalizedItems.map(applyMappedStyleWeightDefaults)
    : normalizedItems;
  const thumbnailMigratedItems = shouldApplyThumbnailDerivativeMigration
    ? await mapSequential(styleWeightedItems, (item) => migrateWardrobeItemThumbnailDerivatives(item))
    : styleWeightedItems;
  const effectiveImportAppState = shouldApplyThumbnailDerivativeMigration
    ? {
        ...nextAppState,
        fitpics: await mapSequential(nextAppState?.fitpics ?? [], (fitpic) => migrateFitpicThumbnailDerivatives(fitpic))
      }
    : nextAppState;

  const effectiveItems = shouldApplyImagePresentationMigration
    ? await Promise.all(thumbnailMigratedItems.map((item) => bakeItemImagePresentation(item)))
    : thumbnailMigratedItems;
  const deduplicatedItems = resolveDuplicateItemUuids(effectiveItems).items;

  const fallbackOutfit = effectiveImportAppState?.outfit ?? buildNextOutfit(
    deduplicatedItems,
    {},
    {},
    false,
    {},
    defaultGenerationLists,
    emptyOutfitFilters,
    null,
    defaultGenerationMode,
    normalizeOutfitAffinity(effectiveImportAppState?.outfitAffinity),
    normalizeRecentOutfits(effectiveImportAppState?.recentOutfits)
  );

  const hydratedAppState = normalizeHydratedAppState(effectiveImportAppState, {
    fallbackOutfit,
    normalizeWeatherSettings,
    itemsById: Object.fromEntries(deduplicatedItems.map((item) => [item.id, item]))
  });

  const loadedAppState = {
    ...hydratedAppState,
    recentOutfits: []
  };

  return {
    backup: {
      ...backup,
      items: deduplicatedItems,
      appState: {
        itemDefaultsMigrationVersion: migrationVersions.itemDefaults,
        imagePresentationMigrationVersion: migrationVersions.imagePresentation,
        thumbnailDerivativeMigrationVersion: migrationVersions.thumbnailDerivative,
        fitpicMediaMigrationVersion: Math.max(
          fitpicMediaMigrationVersion,
          Number(nextAppState?.fitpicMediaMigrationVersion) || 0
        ),
        layering: loadedAppState.layering,
        accessoriesEnabled: loadedAppState.accessoriesEnabled,
        locked: loadedAppState.locked,
        excluded: loadedAppState.excluded,
        outfit: loadedAppState.outfit,
        outfitItemUuids: loadedAppState.outfitItemUuids,
        ignoredImportImages: loadedAppState.ignoredImportImages,
        savedOutfits: loadedAppState.savedOutfits,
        likedOutfitKeys: loadedAppState.likedOutfitKeys,
        outfitAffinity: loadedAppState.outfitAffinity,
        recentOutfits: [],
        generateCount: loadedAppState.generateCount,
        generationLists: loadedAppState.generationLists,
        generationMode: loadedAppState.generationMode,
        outfitFilters: loadedAppState.outfitFilters,
        weatherSettings: loadedAppState.weatherSettings,
        weatherData: loadedAppState.weatherData,
        fitpics: loadedAppState.fitpics,
        wardrobeFilters: loadedAppState.wardrobeFilters,
        wardrobeSort: loadedAppState.wardrobeSort,
        savedWardrobeViews: loadedAppState.savedWardrobeViews
      }
    },
    items: deduplicatedItems,
    appState: loadedAppState
  };
}
