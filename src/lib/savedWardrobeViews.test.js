import test from "node:test";
import assert from "node:assert/strict";

import { emptyWardrobeFilters } from "./wardrobeLibrary.js";
import {
  applySavedWardrobeView,
  createSavedWardrobeViewSnapshot,
  deleteSavedWardrobeView,
  matchesCurrentWardrobeView,
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
      pinned: true
    },
    {
      id: "view-1",
      name: "",
      searchQuery: "",
      filters: emptyWardrobeFilters,
      sort: "newest",
      pinned: false
    }
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].name, "Wishlist");
  assert.equal(normalized[0].pinned, true);
  assert.deepEqual(normalized[0].filters.status, ["Wishlist"]);
  assert.deepEqual(normalized[0].filters.statusExcluded, ["Sold"]);
  assert.deepEqual(normalized[0].filters.collectionsExcluded, ["Old collection"]);
  assert.deepEqual(normalized[0].filters.typeExcluded, ["Loafer"]);
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
    searchQuery: "coat",
    filters: {
      ...emptyWardrobeFilters,
      status: ["Wishlist"]
    },
    sort: "oldest",
    pinned: false
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
      pinned: false
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
      pinned: false
    }
  ];

  const renamed = renameSavedWardrobeView(sourceViews, "view-1", "Wishlist edited");
  assert.equal(renamed.savedViews[0].name, "Wishlist edited");

  const pinned = togglePinnedSavedWardrobeView(renamed.savedViews, "view-2");
  assert.equal(pinned[0].id, "view-2");
  assert.equal(pinned[0].pinned, true);

  const deleted = deleteSavedWardrobeView(pinned, "view-1");
  assert.deepEqual(deleted, [{
    id: "view-2",
    name: "Current Wardrobe",
    searchQuery: "",
    filters: {
      ...emptyWardrobeFilters,
      status: ["Wardrobe"]
    },
    sort: "newest",
    pinned: true
  }]);
});
