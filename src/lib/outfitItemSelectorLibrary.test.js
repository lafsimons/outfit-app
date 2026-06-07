import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SELECTOR_SORT,
  createEmptySelectorFilters,
  filterAndSortSelectorItems,
  getSelectorFilterOptions,
  hasActiveSelectorControls,
  normalizeSelectorSort
} from "./outfitItemSelectorLibrary.js";
import { getWardrobeSearchText } from "./wardrobeLibrary.js";

const selectorItems = [
  {
    id: "item_1",
    brand: "Lemaire",
    name: "Wrap Coat",
    type: "Coat",
    garmentType: "Outerwear",
    status: "Wardrobe",
    collections: ["Winter"],
    description: "Soft wool coat",
    styleTags: ["Relaxed"],
    climateTags: ["Cold"],
    favorite: true,
    createdAt: "2024-01-01T00:00:00.000Z"
  },
  {
    id: "item_2",
    brand: "Auralee",
    name: "Washed Shirt",
    type: "Shirt",
    garmentType: "Top",
    status: "Wardrobe",
    collections: ["Travel"],
    description: "Light cotton shirt",
    styleTags: ["Relaxed"],
    climateTags: ["Warm"],
    favorite: false,
    createdAt: "2024-02-01T00:00:00.000Z"
  },
  {
    id: "item_3",
    brand: "Man-tle",
    name: "Easy Pants",
    type: "Trousers",
    garmentType: "Bottom",
    status: "Wishlist",
    collections: ["Travel"],
    description: "Dry cotton pants",
    styleTags: ["Casual"],
    climateTags: ["Warm"],
    favorite: true,
    createdAt: "2024-03-01T00:00:00.000Z"
  }
];

const searchTextById = Object.fromEntries(selectorItems.map((item) => [item.id, getWardrobeSearchText(item)]));

test("normalizeSelectorSort falls back to the selector default", () => {
  assert.equal(normalizeSelectorSort("bad-sort"), DEFAULT_SELECTOR_SORT);
  assert.equal(normalizeSelectorSort("nameZa"), "nameZa");
});

test("filterAndSortSelectorItems applies selector-local search and filters", () => {
  const filtered = filterAndSortSelectorItems(selectorItems, {
    search: "cotton",
    filters: {
      ...createEmptySelectorFilters(),
      type: ["Shirt"],
      status: ["Wardrobe"],
      collections: ["Travel"]
    },
    searchTextById
  });

  assert.deepEqual(filtered.map((item) => item.id), ["item_2"]);
});

test("filterAndSortSelectorItems supports favorites and selector-local sorting", () => {
  const alphabetical = filterAndSortSelectorItems(selectorItems, {
    filters: {
      ...createEmptySelectorFilters(),
      favorite: "yes"
    },
    sort: "nameAz",
    searchTextById
  });
  const reverseAlphabetical = filterAndSortSelectorItems(selectorItems, {
    filters: {
      ...createEmptySelectorFilters(),
      favorite: "yes"
    },
    sort: "nameZa",
    searchTextById
  });
  const newest = filterAndSortSelectorItems(selectorItems, {
    sort: "newest",
    searchTextById
  });
  const oldest = filterAndSortSelectorItems(selectorItems, {
    sort: "oldest",
    searchTextById
  });

  assert.deepEqual(alphabetical.map((item) => item.id), ["item_1", "item_3"]);
  assert.deepEqual(reverseAlphabetical.map((item) => item.id), ["item_3", "item_1"]);
  assert.deepEqual(newest.map((item) => item.id), ["item_3", "item_2", "item_1"]);
  assert.deepEqual(oldest.map((item) => item.id), ["item_1", "item_2", "item_3"]);
});

test("getSelectorFilterOptions keeps selected local filter values visible", () => {
  const options = getSelectorFilterOptions(selectorItems, {
    ...createEmptySelectorFilters(),
    type: ["Missing Type"],
    status: ["Wardrobe"],
    collections: ["Missing Collection"]
  }, {
    itemStatusOptions: ["Wardrobe", "Wishlist"]
  });

  assert.ok(options.type.includes("Missing Type"));
  assert.deepEqual(options.status, ["Wardrobe"]);
  assert.ok(options.collections.includes("Missing Collection"));
});

test("hasActiveSelectorControls only reflects selector-local state", () => {
  assert.equal(hasActiveSelectorControls(), false);
  assert.equal(hasActiveSelectorControls({ search: "coat" }), true);
  assert.equal(
    hasActiveSelectorControls({
      filters: {
        ...createEmptySelectorFilters(),
        collections: ["Travel"]
      }
    }),
    true
  );
});
