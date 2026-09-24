import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SELECTOR_SORT,
  createEmptySelectorFilters,
  createSelectorFiltersFromControls,
  filterAndSortSelectorItems,
  getSelectorSearchText,
  getSelectorFilterOptions,
  hasActiveSelectorControls,
  normalizeSelectorSort
} from "./outfitItemSelectorLibrary.js";
import { defaultGenerationLists, getManualSelectorSlotPool } from "./generation.js";

const selectorItems = [
  {
    id: "item_1",
    brand: "Lemaire",
    name: "Wrap Coat",
    type: "Coat",
    garmentType: "Outerwear",
    status: "Wardrobe",
    collections: ["Winter"],
    description: "Soft wool coat with muddy hem notes",
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
    description: "Light cotton shirt with mud-stained placket",
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

const searchTextById = Object.fromEntries(selectorItems.map((item) => [item.id, getSelectorSearchText(item)]));

test("selector inherits controls filters and clearing them restores items outside the saved view", () => {
  const lists = { ...defaultGenerationLists, Wardrobe: false, Wishlist: true, Sold: "exclude" };
  const controls = { style: ["Casual"], climate: ["Warm"], collections: ["Travel"] };
  const filters = createSelectorFiltersFromControls(controls, lists);
  assert.deepEqual(filters.status, ["Wishlist"]);
  assert.deepEqual(filters.statusExcluded, ["Sold"]);
  assert.deepEqual(filters.style, ["Casual"]);
  assert.deepEqual(filters.climate, ["Warm"]);
  assert.deepEqual(filters.collections, ["Travel"]);
  const items = selectorItems.map((item) => ({ ...item, garmentType: "Bottom" }));
  const pool = getManualSelectorSlotPool(items, "Bottom", false, {}, {}, null);
  assert.equal(pool.length, 3);
  assert.deepEqual(filterAndSortSelectorItems(pool, { filters }).map((item) => item.id), ["item_3"]);
  assert.equal(filterAndSortSelectorItems(pool, { filters: createEmptySelectorFilters() }).length, 3);
  const multi = { ...createEmptySelectorFilters(), status: ["Wardrobe", "Wishlist"] };
  assert.equal(filterAndSortSelectorItems(pool, { filters: multi }).length, 3);
  assert.equal(lists.Wardrobe, false);
});

test("selector retains exclusion-only filters and an empty generation status selection", () => {
  const filters = createSelectorFiltersFromControls({ climateExcluded: ["Cold"] });
  assert.equal(hasActiveSelectorControls({ filters: { climateExcluded: ["Cold"] } }), true);
  assert.deepEqual(filters.climateExcluded, ["Cold"]);
  const none = createSelectorFiltersFromControls({}, Object.fromEntries(Object.keys(defaultGenerationLists).map((key) => [key, false])));
  assert.equal(filterAndSortSelectorItems(selectorItems, { filters: none }).length, 0);
});

test("normalizeSelectorSort falls back to the selector default", () => {
  assert.equal(normalizeSelectorSort("bad-sort"), DEFAULT_SELECTOR_SORT);
  assert.equal(normalizeSelectorSort("nameZa"), "nameZa");
});

test("filterAndSortSelectorItems applies selector-local search and filters", () => {
  const filtered = filterAndSortSelectorItems(selectorItems, {
    search: "auralee",
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

test("filterAndSortSelectorItems matches selector identity fields and ignores descriptions", () => {
  assert.deepEqual(
    filterAndSortSelectorItems(selectorItems, {
      search: "wrap",
      searchTextById
    }).map((item) => item.id),
    ["item_1"]
  );

  assert.deepEqual(
    filterAndSortSelectorItems(selectorItems, {
      search: "lemaire",
      searchTextById
    }).map((item) => item.id),
    ["item_1"]
  );

  assert.deepEqual(
    filterAndSortSelectorItems(selectorItems, {
      search: "mud",
      searchTextById
    }).map((item) => item.id),
    []
  );
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
