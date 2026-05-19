import test from "node:test";
import assert from "node:assert/strict";

import {
  backfillOutfitItemUuids,
  normalizeHydratedAppState,
  normalizeGenerationLists,
  normalizeOutfitItemUuids,
  normalizeSavedOutfit,
  normalizeSavedOutfits
} from "./appStateModel.js";

test("saved outfit default field filling preserves current behavior", () => {
  assert.deepEqual(
    normalizeSavedOutfit({
      id: "saved_1"
    }),
    {
      id: "saved_1",
      name: "Saved outfit",
      description: "",
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
    }),
    {
      id: "saved_1",
      name: "Saved outfit",
      description: "",
      outfit: { TopInner: "top_1" },
      outfitItemUuids: { TopInner: "uuid_top_1", Bottom: null },
      layering: false
    }
  );
});

test("saved outfit deduplication uses getOutfitKey semantics", () => {
  const normalized = normalizeSavedOutfits([
    {
      id: "saved_1",
      name: "First",
      description: "A",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: true
    },
    {
      id: "saved_2",
      name: "Duplicate",
      description: "B",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: true
    },
    {
      id: "saved_3",
      name: "Different layering",
      description: "C",
      outfit: { Headwear: "head_1", TopInner: "top_1", TopOuter: null, Bottom: "bottom_1", Footwear: "shoe_1" },
      layering: false
    }
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "saved_1");
  assert.equal(normalized[1].id, "saved_3");
});

test("generation list default merging preserves current behavior", () => {
  assert.deepEqual(normalizeGenerationLists(undefined), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false
  });

  assert.deepEqual(normalizeGenerationLists({ Wishlist: false }), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false
  });

  assert.deepEqual(normalizeGenerationLists({ ArchivedLater: false }), {
    Interested: false,
    Wishlist: false,
    Incoming: false,
    Wardrobe: true,
    Selling: false,
    Sold: false,
    ArchivedLater: false
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
        Sold: false
      },
      generationMode: "guided",
      outfitFilters: { style: [], climate: [] },
      weatherSettings: { locationName: "", latitude: null, longitude: null },
      weatherLocationDraft: "",
      weatherData: null,
      fitpics: [],
      wardrobeFilters: {
        brand: "",
        type: "",
        garmentType: "",
        color: "",
        style: "",
        laundry: "",
        weight: "",
        list: "",
        favorite: ""
      },
      wardrobeSort: "newest"
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
    ArchivedLater: false
  });
  assert.equal(hydrated.generationMode, "guided");
  assert.deepEqual(hydrated.outfitFilters, { style: ["Casual", "Casual"], climate: ["Rain"] });
  assert.deepEqual(hydrated.wardrobeFilters, {
    brand: "Our Legacy",
    type: "",
    garmentType: "",
    color: "",
    style: "",
    laundry: "",
    weight: "",
    list: "Wardrobe",
    favorite: ""
  });
  assert.equal(hydrated.wardrobeSort, "newest");
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
    brand: "",
    type: "",
    garmentType: "",
    color: "",
    style: "",
    laundry: "",
    weight: "",
    list: "",
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
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null },
    itemsById: {
      top_1: { id: "top_1", itemUuid: "uuid_top_1" },
      shoe_1: { id: "shoe_1", itemUuid: "uuid_shoe_1" }
    }
  });

  assert.deepEqual(hydrated.savedOutfits, [
    {
      id: "saved_1",
      name: "Saved outfit",
      description: "",
      outfit: { TopInner: "top_1", Footwear: "shoe_1" },
      outfitItemUuids: { TopInner: "uuid_top_1", Footwear: "uuid_shoe_1" },
      layering: true
    }
  ]);
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
