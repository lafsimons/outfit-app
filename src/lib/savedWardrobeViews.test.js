import test from "node:test";
import assert from "node:assert/strict";

import { emptyOutfitFilters } from "./generation.js";
import { emptyWardrobeFilters } from "./wardrobeLibrary.js";
import {
  applySavedWardrobeView,
  applySavedWardrobeViewToOutfitFilters,
  createSavedWardrobeViewSnapshot,
  deleteSavedWardrobeView,
  matchesCurrentWardrobeView,
  matchesCurrentOutfitFiltersSavedWardrobeView,
  normalizeSavedWardrobeViews,
  renameSavedWardrobeView,
  togglePinnedSavedWardrobeView,
  upsertSavedWardrobeView
} from "./savedWardrobeViews.js";

test("normalizeSavedWardrobeViews handles legacy aliases, dedupes ids, preserves stale filter values, and sorts pinned first", () => {
  const normalized = normalizeSavedWardrobeViews([
    {
      id: "view-1",
      name: " Wishlist ",
      scope: "bad-scope",
      wardrobeSearch: "coat",
      wardrobeFilters: {
        status: ["Wishlist", "Wishlist"],
        statusExcluded: ["Sold"],
        collections: ["A/W Rotation"],
        collectionsExcluded: ["Old collection"],
        type: ["Derby"],
        typeExcluded: ["Loafer"],
        favorite: "yes"
      },
      wardrobeSort: "oldest",
      pinned: true,
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-02T00:00:00.000Z"
    },
    {
      id: "view-1",
      name: " Alpha ",
      searchQuery: "",
      filters: emptyWardrobeFilters,
      sort: "newest",
      pinned: true
    },
    {
      id: "view-3",
      name: "Summer",
      searchQuery: "",
      filters: emptyWardrobeFilters,
      sort: "newest",
      pinned: false
    },
    {
      id: "view-4",
      name: "Incoming",
      searchQuery: "",
      filters: emptyWardrobeFilters,
      sort: "newest",
      pinned: false
    }
  ]);

  assert.equal(normalized.length, 4);
  assert.equal(normalized[0].name, "Alpha");
  assert.equal(normalized[1].name, "Wishlist");
  assert.equal(normalized[2].name, "Incoming");
  assert.equal(normalized[3].name, "Summer");
  assert.equal(normalized[1].scope, "wardrobe");
  assert.equal(normalized[0].pinned, true);
  assert.deepEqual(normalized[1].filters.status, ["Wishlist"]);
  assert.deepEqual(normalized[1].filters.statusExcluded, ["Sold"]);
  assert.deepEqual(normalized[1].filters.collectionsExcluded, ["Old collection"]);
  assert.deepEqual(normalized[1].filters.typeExcluded, ["Loafer"]);
  assert.equal(normalized[1].createdAt, "2024-06-01T00:00:00.000Z");
  assert.equal(normalized[1].updatedAt, "2024-06-02T00:00:00.000Z");
  assert.notEqual(normalized[0].id, normalized[1].id);
});

test("snapshot and apply normalize current wardrobe search filters and sort", () => {
  const snapshot = createSavedWardrobeViewSnapshot({
    wardrobeSearch: "wool coat",
    wardrobeFilters: {
      status: ["Wishlist", "Wishlist"],
      collections: ["A/W Rotation"],
      favorite: "yes"
    },
    wardrobeSort: "oldest"
  });

  assert.deepEqual(snapshot, {
    searchQuery: "wool coat",
    filters: {
      ...emptyWardrobeFilters,
      status: ["Wishlist"],
      collections: ["A/W Rotation"],
      favorite: "yes"
    },
    sort: "oldest"
  });
  assert.deepEqual(applySavedWardrobeView(snapshot), snapshot);
});

test("matchesCurrentWardrobeView compares normalized current state by replacement semantics", () => {
  const savedView = {
    id: "view-1",
    name: "Wishlist",
    scope: "wardrobe",
    searchQuery: "coat",
    filters: {
      ...emptyWardrobeFilters,
      status: ["Wishlist"]
    },
    sort: "oldest",
    pinned: false,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z"
  };

  assert.equal(matchesCurrentWardrobeView(savedView, {
    wardrobeSearch: "coat",
    wardrobeFilters: {
      ...emptyWardrobeFilters,
      status: ["Wishlist", "Wishlist"]
    },
    wardrobeSort: "oldest"
  }), true);
});

test("saved wardrobe views map to generation outfit filters by supported shared fields only", () => {
  const savedView = {
    id: "view-1",
    name: "Summer rotation",
    scope: "wardrobe",
    searchQuery: "ignored in controls",
    filters: {
      ...emptyWardrobeFilters,
      style: ["Casual", "Unsupported Style"],
      styleExcluded: ["Formal"],
      climate: ["Warm", "Hot", "Unsupported Climate"],
      climateExcluded: ["Rain"],
      collections: ["S/S Rotation", "Sportswear"],
      collectionsExcluded: ["Archive"],
      status: ["Wishlist"],
      statusExcluded: ["Sold"],
      brand: ["A Kind of Guise"],
      favorite: "yes",
      laundry: "hide"
    },
    sort: "oldest",
    pinned: false,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z"
  };

  assert.deepEqual(
    applySavedWardrobeViewToOutfitFilters(savedView),
    {
      ...emptyOutfitFilters,
      style: ["Casual"],
      styleExcluded: ["Formal"],
      climate: ["Warm", "Hot"],
      climateExcluded: ["Rain"],
      collections: ["S/S Rotation", "Sportswear"],
      collectionsExcluded: ["Archive"]
    }
  );
  assert.equal(
    matchesCurrentOutfitFiltersSavedWardrobeView(savedView, {
      style: ["Casual"],
      styleExcluded: ["Formal"],
      climate: ["Warm", "Hot"],
      climateExcluded: ["Rain"],
      collections: ["S/S Rotation", "Sportswear"],
      collectionsExcluded: ["Archive"]
    }),
    true
  );
});

test("upsertSavedWardrobeView reports duplicate-name conflicts unless replacement is allowed", () => {
  const firstResult = upsertSavedWardrobeView([], "Wishlist", {
    wardrobeSearch: "coat",
    wardrobeFilters: {
      ...emptyWardrobeFilters,
      status: ["Wishlist"]
    },
    wardrobeSort: "oldest"
  });

  assert.equal(firstResult.savedViews.length, 1);
  assert.equal(firstResult.savedViews[0].name, "Wishlist");
  assert.equal(firstResult.savedViews[0].scope, "wardrobe");
  assert.equal(Boolean(firstResult.savedViews[0].createdAt), true);
  assert.equal(Boolean(firstResult.savedViews[0].updatedAt), true);

  const conflictResult = upsertSavedWardrobeView(firstResult.savedViews, " wishlist ", {
    wardrobeSearch: "jacket",
    wardrobeFilters: emptyWardrobeFilters,
    wardrobeSort: "newest"
  });

  assert.equal(conflictResult.savedView, null);
  assert.equal(conflictResult.conflictingView?.name, "Wishlist");

  const replaceResult = upsertSavedWardrobeView(firstResult.savedViews, " wishlist ", {
    wardrobeSearch: "jacket",
    wardrobeFilters: {
      ...emptyWardrobeFilters,
      status: ["Wardrobe"]
    },
    wardrobeSort: "newest"
  }, { allowReplace: true });

  assert.equal(replaceResult.savedViews.length, 1);
  assert.equal(replaceResult.savedViews[0].searchQuery, "jacket");
  assert.deepEqual(replaceResult.savedViews[0].filters.status, ["Wardrobe"]);
  assert.equal(replaceResult.savedViews[0].createdAt, firstResult.savedViews[0].createdAt);
});

test("rename delete and pin preserve view list behavior", () => {
  const sourceViews = [
    {
      id: "view-1",
      name: "Wishlist",
      searchQuery: "",
      filters: {
        ...emptyWardrobeFilters,
        status: ["Wishlist"]
      },
      sort: "newest",
      pinned: false,
      scope: "wardrobe",
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z"
    },
    {
      id: "view-2",
      name: "Current Wardrobe",
      searchQuery: "",
      filters: {
        ...emptyWardrobeFilters,
        status: ["Wardrobe"]
      },
      sort: "newest",
      pinned: false,
      scope: "wardrobe",
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z"
    }
  ];

  const renamed = renameSavedWardrobeView(sourceViews, "view-1", "Wishlist edited");
  assert.equal(renamed.savedViews.find((view) => view.id === "view-1")?.name, "Wishlist edited");

  const pinned = togglePinnedSavedWardrobeView(renamed.savedViews, "view-2");
  assert.equal(pinned[0].id, "view-2");
  assert.equal(pinned[0].pinned, true);
  assert.equal(pinned[0].updatedAt > "2024-06-01T00:00:00.000Z", true);

  const deleted = deleteSavedWardrobeView(pinned, "view-1");
  assert.deepEqual(deleted, [{
    id: "view-2",
    name: "Current Wardrobe",
    scope: "wardrobe",
    searchQuery: "",
    filters: {
      ...emptyWardrobeFilters,
      status: ["Wardrobe"]
    },
    sort: "newest",
    pinned: true,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: pinned[0].updatedAt
  }]);
});
