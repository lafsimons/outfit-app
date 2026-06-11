import test from "node:test";
import assert from "node:assert/strict";

import {
  backfillOutfitItemUuids,
  normalizeEditorWindowState,
  normalizeOutfitUuid,
  normalizeHydratedAppState,
  normalizeGenerationLists,
  normalizeWindowState,
  normalizeOutfitItemUuids,
  normalizeSavedOutfit,
  normalizeSavedOutfits
} from "./appStateModel.js";

test("saved outfit default field filling preserves current behavior", () => {
  assert.deepEqual(
    normalizeSavedOutfit({
      id: "saved_1"
    }, {
      createOutfitUuid: () => "generated-outfit-uuid"
    }),
    {
      id: "saved_1",
      outfitUuid: "generated-outfit-uuid",
      name: "Saved outfit",
      description: "",
      tags: [],
      favorite: false,
      createdAt: null,
      updatedAt: null,
      outfit: {},
      outfitItemUuids: {},
      layering: false
    }
  );
});

test("saved outfit normalization preserves existing outfitUuid", () => {
  assert.deepEqual(
    normalizeSavedOutfit({
      id: "saved_1",
      outfitUuid: "stable-outfit-uuid"
    }, {
      createOutfitUuid: () => "generated-outfit-uuid"
    }),
    {
      id: "saved_1",
      outfitUuid: "stable-outfit-uuid",
      name: "Saved outfit",
      description: "",
      tags: [],
      favorite: false,
      createdAt: null,
      updatedAt: null,
      outfit: {},
      outfitItemUuids: {},
      layering: false
    }
  );
});

test("saved outfit normalization preserves additive outfitItemUuids sidecars", () => {
  assert.deepEqual(
    normalizeSavedOutfit({
      id: "saved_1",
      outfit: { TopInner: "top_1" },
      outfitItemUuids: { TopInner: "uuid_top_1", Bottom: "" }
    }, {
      createOutfitUuid: () => "generated-outfit-uuid"
    }),
    {
      id: "saved_1",
      outfitUuid: "generated-outfit-uuid",
      name: "Saved outfit",
      description: "",
      tags: [],
      favorite: false,
      createdAt: null,
      updatedAt: null,
      outfit: { TopInner: "top_1" },
      outfitItemUuids: { TopInner: "uuid_top_1", Bottom: null },
      layering: false
    }
  );
});

test("saved outfit normalization preserves tags favorite and timestamps", () => {
  assert.deepEqual(
    normalizeSavedOutfit({
      id: "saved_1",
      tags: [" Evening ", "evening", "Summer"],
      favorite: 1,
      createdAt: "2024-05-01T00:00:00.000Z",
      updatedAt: "2024-05-02T00:00:00.000Z"
    }, {
      createOutfitUuid: () => "generated-outfit-uuid"
    }),
    {
      id: "saved_1",
      outfitUuid: "generated-outfit-uuid",
      name: "Saved outfit",
      description: "",
      tags: ["Evening", "Summer"],
      favorite: true,
      createdAt: "2024-05-01T00:00:00.000Z",
      updatedAt: "2024-05-02T00:00:00.000Z",
      outfit: {},
      outfitItemUuids: {},
      layering: false
    }
  );
});

test("saved outfit deduplication uses getOutfitKey semantics", () => {
  const normalized = normalizeSavedOutfits([
    {
      id: "saved_1",
      outfitUuid: "outfit-uuid-1",
      name: "First",
      description: "A",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: true
    },
    {
      id: "saved_2",
      outfitUuid: "outfit-uuid-2",
      name: "Duplicate",
      description: "B",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: true
    },
    {
      id: "saved_3",
      outfitUuid: "outfit-uuid-3",
      name: "Different layering",
      description: "C",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: false
    }
  ], {
    createOutfitUuid: () => "generated-outfit-uuid"
  });

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "saved_1");
  assert.equal(normalized[0].outfitUuid, "outfit-uuid-1");
  assert.equal(normalized[1].id, "saved_3");
  assert.equal(normalized[1].outfitUuid, "outfit-uuid-3");
});

test("normalizeOutfitUuid preserves existing values and backfills missing ones", () => {
  assert.equal(normalizeOutfitUuid("stable-outfit-uuid", () => "generated-outfit-uuid"), "stable-outfit-uuid");
  assert.equal(normalizeOutfitUuid("", () => "generated-outfit-uuid"), "generated-outfit-uuid");
});

test("generation list default merging preserves current behavior", () => {
  assert.deepEqual(normalizeGenerationLists(undefined), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false,
    Archived: false
  });

  assert.deepEqual(normalizeGenerationLists({ Wishlist: false }), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false,
    Archived: false
  });

  assert.deepEqual(normalizeGenerationLists({ ArchivedLater: false }), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false,
    Archived: false,
    ArchivedLater: false
  });

  assert.deepEqual(normalizeGenerationLists({ Wishlist: "exclude" }), {
    Interested: false,
    Wishlist: "exclude",
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false,
    Archived: false
  });
});

test("hydrated app-state missing fields normalize to current defaults", () => {
  assert.deepEqual(
    normalizeHydratedAppState(undefined, {
      fallbackOutfit: { TopInner: "fallback_top" },
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
      itemsById: {}
    }),
    {
      layering: false,
      accessoriesEnabled: true,
      locked: {},
      excluded: {},
      outfit: { TopInner: "fallback_top" },
      outfitItemUuids: { TopInner: null },
      guidedDebugPayload: [],
      ignoredImportImages: [],
      savedOutfits: [],
      likedOutfitKeys: {},
      outfitAffinity: {},
      recentOutfits: [],
      generateCount: 0,
      generationLists: {
        Interested: false,
        Wishlist: false,
        Incoming: false,
        Wardrobe: true,
        Selling: false,
        Sold: false,
        Archived: false
      },
      generationMode: "guided",
      outfitFilters: {
        style: [],
        styleExcluded: [],
        climate: [],
        climateExcluded: [],
        collections: [],
        collectionsExcluded: []
      },
      weatherSettings: { locationName: "", latitude: null, longitude: null },
      weatherLocationDraft: "",
      weatherData: null,
      fitpics: [],
      wardrobeFilters: {
        brand: [],
        brandExcluded: [],
        type: [],
        typeExcluded: [],
        garmentType: [],
        garmentTypeExcluded: [],
        color: [],
        colorExcluded: [],
        style: [],
        styleExcluded: [],
        climate: [],
        climateExcluded: [],
        laundry: "",
        weight: [],
        weightExcluded: [],
        status: [],
        statusExcluded: [],
        collections: [],
        collectionsExcluded: [],
        favorite: ""
      },
      wardrobeSort: "newest",
      windowState: {
        outfitEditor: { width: 396 },
        wardrobeEditor: { width: 396 },
        addImagesWindow: { width: 396 }
      }
    }
  );
});

test("hydrated app-state uses fallback outfit only when outfit is missing", () => {
  const fallbackOutfit = { TopInner: "fallback_top" };

  assert.deepEqual(
    normalizeHydratedAppState({}, {
      fallbackOutfit,
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
      itemsById: {}
    }).outfit,
    fallbackOutfit
  );

  const explicitOutfit = { TopInner: "explicit_top" };
  assert.deepEqual(
    normalizeHydratedAppState({ outfit: explicitOutfit }, {
      fallbackOutfit,
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
      itemsById: {}
    }).outfit,
    explicitOutfit
  );
});

test("hydrated app-state normalizes fields through existing helpers", () => {
  const hydrated = normalizeHydratedAppState({
    savedOutfits: [
      { id: "one", outfit: { TopInner: "a" }, layering: true },
      { id: "two", outfit: { TopInner: "a" }, layering: true }
    ],
    likedOutfitKeys: { alpha: true, beta: false },
    outfitAffinity: { pair: 2.2, zero: 0, negative: -4 },
    recentOutfits: [{ outfit: { TopInner: "a" }, layering: 1 }],
    generationLists: { Wishlist: false, Selling: true, ArchivedLater: false },
    generationMode: "unknown-mode",
    outfitFilters: { style: ["Casual", "Casual"], climate: ["Rain", "Bad"], extra: ["x"] },
    wardrobeFilters: { brand: "Our Legacy", list: "Wardrobe", style: 42, extra: "ignored" },
    wardrobeSort: "bad-sort"
  }, {
    fallbackOutfit: {},
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {}
  });

  assert.equal(hydrated.savedOutfits.length, 1);
  assert.deepEqual(hydrated.likedOutfitKeys, { alpha: true });
  assert.deepEqual(hydrated.outfitAffinity, { pair: 2 });
  assert.equal(hydrated.recentOutfits.length, 1);
  assert.deepEqual(hydrated.generationLists, {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: true,
    Sold: false,
    Archived: false,
    ArchivedLater: false
  });
  assert.equal(hydrated.generationMode, "guided");
  assert.deepEqual(hydrated.outfitFilters, {
    style: ["Casual", "Casual"],
    styleExcluded: [],
    climate: ["Rain"],
    climateExcluded: [],
    collections: [],
    collectionsExcluded: []
  });
  assert.deepEqual(hydrated.wardrobeFilters, {
    brand: ["Our Legacy"],
    brandExcluded: [],
    type: [],
    typeExcluded: [],
    garmentType: [],
    garmentTypeExcluded: [],
    color: [],
    colorExcluded: [],
    style: [],
    styleExcluded: [],
    climate: [],
    climateExcluded: [],
    laundry: "",
    weight: [],
    weightExcluded: [],
    status: ["Wardrobe"],
    statusExcluded: [],
    collections: [],
    collectionsExcluded: [],
    favorite: ""
  });
  assert.equal(hydrated.wardrobeSort, "newest");
  assert.deepEqual(hydrated.windowState, {
    outfitEditor: { width: 396 },
    wardrobeEditor: { width: 396 },
    addImagesWindow: { width: 396 }
  });
});

test("editor window state clamps widths and backfills missing contexts", () => {
  assert.deepEqual(normalizeEditorWindowState({ width: 900 }), { width: 520 });
  assert.deepEqual(normalizeEditorWindowState({ width: 12 }), { width: 344 });
  assert.deepEqual(normalizeWindowState({ wardrobeEditor: { width: 420 } }), {
    outfitEditor: { width: 396 },
    wardrobeEditor: { width: 420 },
    addImagesWindow: { width: 396 }
  });
});

test("hydrated app-state normalizes fitpics additively for legacy and metadata-rich records", () => {
  const hydrated = normalizeHydratedAppState({
    fitpics: [
      {
        id: "legacy-fitpic",
        name: "Legacy",
        imageData: "data:image/png;base64,legacy",
        createdAt: "2024-02-01T00:00:00.000Z"
      },
      {
        id: "rich-fitpic",
        fitpicUuid: "fitpic-uuid-2",
        name: "Rich",
        imageData: "data:image/png;base64,rich",
        createdAt: "2024-03-01T00:00:00.000Z",
        importedAt: "2024-03-02T00:00:00.000Z",
        fitDate: "2024-03-03T00:00:00.000Z",
        sourceOriginalFilename: "rich.png",
        sourceFileExtension: "png",
        linkedItemUuids: ["item-uuid-1"],
        linkedItemIds: ["item_1"],
        savedOutfitUuid: "outfit-uuid-1",
        savedOutfitId: "saved_1",
        tags: ["  Spring ", "spring", ""],
        favorite: 1
      }
    ]
  }, {
    fallbackOutfit: {},
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {}
  });

  assert.equal(hydrated.fitpics.length, 2);
  assert.equal(hydrated.fitpics[0].fitpicUuid.length > 0, true);
  assert.equal(hydrated.fitpics[0].images.preview, "data:image/png;base64,legacy");
  assert.equal(hydrated.fitpics[0].importedAt, "2024-02-01T00:00:00.000Z");
  assert.equal(hydrated.fitpics[0].fitDate, "2024-02-01T00:00:00.000Z");
  assert.equal(hydrated.fitpics[1].fitpicUuid, "fitpic-uuid-2");
  assert.deepEqual(hydrated.fitpics[1].tags, ["Spring"]);
  assert.equal(hydrated.fitpics[1].favorite, true);
  assert.equal(hydrated.fitpics[1].fitDate, "2024-03-03T00:00:00.000Z");
  assert.deepEqual(hydrated.fitpics[1].linkedItemUuids, ["item-uuid-1"]);
  assert.deepEqual(hydrated.fitpics[1].linkedItemIds, ["item_1"]);
  assert.equal(hydrated.fitpics[1].savedOutfitUuid, "outfit-uuid-1");
  assert.equal(hydrated.fitpics[1].savedOutfitId, "saved_1");
  assert.equal(hydrated.fitpics[1].sourceFileExtension, "png");
});

test("hydrated app-state wardrobe filter normalization preserves backward compatibility defaults", () => {
  const hydrated = normalizeHydratedAppState({
    wardrobeFilters: []
  }, {
    fallbackOutfit: {},
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {}
  });

  assert.deepEqual(hydrated.wardrobeFilters, {
    brand: [],
    brandExcluded: [],
    type: [],
    typeExcluded: [],
    garmentType: [],
    garmentTypeExcluded: [],
    color: [],
    colorExcluded: [],
    style: [],
    styleExcluded: [],
    climate: [],
    climateExcluded: [],
    laundry: "",
    weight: [],
    weightExcluded: [],
    status: [],
    statusExcluded: [],
    collections: [],
    collectionsExcluded: [],
    favorite: ""
  });
});

test("hydrated app-state derives weather location draft and clamps generate count", () => {
  const hydrated = normalizeHydratedAppState({
    weatherSettings: { locationName: "Berlin, Germany", latitude: 52.5, longitude: 13.4 },
    generateCount: "3.6"
  }, {
    fallbackOutfit: {},
    itemsById: {},
    normalizeWeatherSettings: (settings) => ({
      locationName: settings?.locationName ?? "",
      latitude: settings?.latitude ?? null,
      longitude: settings?.longitude ?? null
    })
  });

  assert.deepEqual(hydrated.weatherSettings, {
    locationName: "Berlin, Germany",
    latitude: 52.5,
    longitude: 13.4
  });
  assert.equal(hydrated.weatherLocationDraft, "Berlin, Germany");
  assert.equal(hydrated.generateCount, 4);
});

test("hydrated app-state always resets guided debug payload", () => {
  assert.deepEqual(
    normalizeHydratedAppState({
      guidedDebugPayload: [{ slot: "TopInner" }]
    }, {
      fallbackOutfit: {},
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
      itemsById: {}
    }).guidedDebugPayload,
    []
  );
});

test("legacy id-only current outfit hydration preserves outfit and backfills sidecar when item id resolves", () => {
  const hydrated = normalizeHydratedAppState({
    outfit: { TopInner: "top_1", Bottom: "bottom_1" }
  }, {
    fallbackOutfit: {},
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {
      top_1: { id: "top_1", itemUuid: "uuid_top_1" }
    }
  });

  assert.deepEqual(hydrated.outfit, { TopInner: "top_1", Bottom: "bottom_1" });
  assert.deepEqual(hydrated.outfitItemUuids, {
    TopInner: "uuid_top_1",
    Bottom: null
  });
});

test("legacy id-only saved outfit hydration preserves outfits and backfills sidecars when item ids resolve", () => {
  const hydrated = normalizeHydratedAppState({
    savedOutfits: [
      {
        id: "saved_1",
        outfit: { TopInner: "top_1", Footwear: "shoe_1" },
        layering: true
      }
    ]
  }, {
    fallbackOutfit: {},
    createOutfitUuid: () => "generated-outfit-uuid",
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {
      top_1: { id: "top_1", itemUuid: "uuid_top_1" },
      shoe_1: { id: "shoe_1", itemUuid: "uuid_shoe_1" }
    }
  });

  assert.deepEqual(hydrated.savedOutfits, [
    {
      id: "saved_1",
      outfitUuid: "generated-outfit-uuid",
      name: "Saved outfit",
      description: "",
      tags: [],
      favorite: false,
      createdAt: null,
      updatedAt: null,
      outfit: { TopInner: "top_1", Footwear: "shoe_1" },
      outfitItemUuids: { TopInner: "uuid_top_1", Footwear: "uuid_shoe_1" },
      layering: true
    }
  ]);
});

test("saved outfit hydration preserves an existing outfitUuid", () => {
  const hydrated = normalizeHydratedAppState({
    savedOutfits: [
      {
        id: "saved_1",
        outfitUuid: "stable-outfit-uuid",
        outfit: { TopInner: "top_1" }
      }
    ]
  }, {
    fallbackOutfit: {},
    createOutfitUuid: () => "generated-outfit-uuid",
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {
      top_1: { id: "top_1", itemUuid: "uuid_top_1" }
    }
  });

  assert.equal(hydrated.savedOutfits[0].outfitUuid, "stable-outfit-uuid");
});

test("backfillOutfitItemUuids preserves existing sidecars and fills resolved ids", () => {
  assert.deepEqual(
    backfillOutfitItemUuids(
      { TopInner: "top_1", Bottom: "bottom_1", Footwear: null },
      { TopInner: "legacy_top_uuid", Footwear: "stale_uuid" },
      {
        top_1: { id: "top_1", itemUuid: "uuid_top_1" }
      }
    ),
    {
      TopInner: "uuid_top_1",
      Bottom: null,
      Footwear: null
    }
  );
});

test("rename repair sidecar sync keeps current behavior and updates to the resolved itemUuid", () => {
  const renamedOutfit = { TopInner: "top_renamed" };

  assert.deepEqual(
    backfillOutfitItemUuids(
      renamedOutfit,
      { TopInner: "uuid_top_1" },
      {
        top_renamed: { id: "top_renamed", itemUuid: "uuid_top_1" }
      }
    ),
    { TopInner: "uuid_top_1" }
  );
});

test("delete cleanup sidecar sync keeps current behavior and clears the uuid when the slot is cleared", () => {
  assert.deepEqual(
    backfillOutfitItemUuids(
      { TopInner: null, Bottom: "bottom_1" },
      { TopInner: "uuid_top_1", Bottom: "uuid_bottom_1" },
      {
        bottom_1: { id: "bottom_1", itemUuid: "uuid_bottom_1" }
      }
    ),
    {
      TopInner: null,
      Bottom: "uuid_bottom_1"
    }
  );
});

test("normalizeOutfitItemUuids keeps only string uuids and nulls invalid values", () => {
  assert.deepEqual(
    normalizeOutfitItemUuids({
      TopInner: "uuid_top_1",
      Bottom: "",
      Footwear: 42
    }),
    {
      TopInner: "uuid_top_1",
      Bottom: null,
      Footwear: null
    }
  );
});
