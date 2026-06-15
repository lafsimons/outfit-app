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
    migrationVersions
  }
) {
  const nextItems = Array.isArray(backup?.items) ? backup.items : [];
  const nextAppState = backup?.appState ?? {};
  const fallbackTimestampBaseMs = Date.now() - Math.max(nextItems.length - 1, 0) * 1000;
  const shouldApplyStyleWeightMigration =
    (nextAppState?.itemDefaultsMigrationVersion ?? 0) < migrationVersions.itemDefaults;
  const shouldApplyImagePresentationMigration =
    (nextAppState?.imagePresentationMigrationVersion ?? 0) < migrationVersions.imagePresentation;

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

  const effectiveItems = shouldApplyImagePresentationMigration
    ? await Promise.all(styleWeightedItems.map((item) => bakeItemImagePresentation(item)))
    : styleWeightedItems;

  const fallbackOutfit = nextAppState?.outfit ?? buildNextOutfit(
    effectiveItems,
    {},
    {},
    false,
    {},
    defaultGenerationLists,
    emptyOutfitFilters,
    null,
    defaultGenerationMode,
    normalizeOutfitAffinity(nextAppState?.outfitAffinity),
    normalizeRecentOutfits(nextAppState?.recentOutfits)
  );

  const hydratedAppState = normalizeHydratedAppState(nextAppState, {
    fallbackOutfit,
    normalizeWeatherSettings,
    itemsById: Object.fromEntries(effectiveItems.map((item) => [item.id, item]))
  });

  const loadedAppState = {
    ...hydratedAppState,
    recentOutfits: []
  };

  return {
    backup: {
      ...backup,
      items: effectiveItems,
      appState: {
        itemDefaultsMigrationVersion: migrationVersions.itemDefaults,
        imagePresentationMigrationVersion: migrationVersions.imagePresentation,
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
    items: effectiveItems,
    appState: loadedAppState
  };
}
