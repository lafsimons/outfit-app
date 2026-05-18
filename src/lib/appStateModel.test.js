import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeHydratedAppState,
  normalizeGenerationLists,
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
    Wardrobe: true,
    Wishlist: true
  });

  assert.deepEqual(normalizeGenerationLists({ Wishlist: false }), {
    Wardrobe: true,
    Wishlist: false
  });
});

test("hydrated app-state missing fields normalize to current defaults", () => {
  assert.deepEqual(
    normalizeHydratedAppState(undefined, {
      fallbackOutfit: { TopInner: "fallback_top" },
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null }
    }),
    {
      layering: false,
      accessoriesEnabled: true,
      locked: {},
      excluded: {},
      outfit: { TopInner: "fallback_top" },
      guidedDebugPayload: [],
      ignoredImportImages: [],
      savedOutfits: [],
      likedOutfitKeys: {},
      outfitAffinity: {},
      recentOutfits: [],
      generateCount: 0,
      generationLists: { Wardrobe: true, Wishlist: true },
      generationMode: "guided",
      outfitFilters: { style: [], climate: [] },
      weatherSettings: { locationName: "", latitude: null, longitude: null },
      weatherLocationDraft: "",
      weatherData: null,
      fitpics: [],
      wardrobeSort: "newest"
    }
  );
});

test("hydrated app-state uses fallback outfit only when outfit is missing", () => {
  const fallbackOutfit = { TopInner: "fallback_top" };

  assert.deepEqual(
    normalizeHydratedAppState({}, {
      fallbackOutfit,
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null }
    }).outfit,
    fallbackOutfit
  );

  const explicitOutfit = { TopInner: "explicit_top" };
  assert.deepEqual(
    normalizeHydratedAppState({ outfit: explicitOutfit }, {
      fallbackOutfit,
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null }
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
    generationLists: { Wishlist: false },
    generationMode: "unknown-mode",
    outfitFilters: { style: ["Casual", "Casual"], climate: ["Rain", "Bad"], extra: ["x"] },
    wardrobeSort: "bad-sort"
  }, {
    fallbackOutfit: {},
    normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null }
  });

  assert.equal(hydrated.savedOutfits.length, 1);
  assert.deepEqual(hydrated.likedOutfitKeys, { alpha: true });
  assert.deepEqual(hydrated.outfitAffinity, { pair: 2 });
  assert.equal(hydrated.recentOutfits.length, 1);
  assert.deepEqual(hydrated.generationLists, { Wardrobe: true, Wishlist: false });
  assert.equal(hydrated.generationMode, "guided");
  assert.deepEqual(hydrated.outfitFilters, { style: ["Casual", "Casual"], climate: ["Rain"] });
  assert.equal(hydrated.wardrobeSort, "newest");
});

test("hydrated app-state derives weather location draft and clamps generate count", () => {
  const hydrated = normalizeHydratedAppState({
    weatherSettings: { locationName: "Berlin, Germany", latitude: 52.5, longitude: 13.4 },
    generateCount: "3.6"
  }, {
    fallbackOutfit: {},
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
      normalizeWeatherSettings: (settings) => settings ?? { locationName: "", latitude: null, longitude: null }
    }).guidedDebugPayload,
    []
  );
});
