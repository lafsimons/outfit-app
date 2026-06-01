import test from "node:test";
import assert from "node:assert/strict";

import {
  filterWardrobeItems,
  getWardrobeFilterOptions,
  normalizeWardrobeFilters,
  sortWardrobeItems
} from "./wardrobeLibrary.js";

const items = [
  {
    id: "alpha-shirt",
    brand: "Our Legacy",
    name: "Borrowed Shirt",
    type: "Shirt",
    garmentType: "Top",
    color: "Blue",
    weight: "Light",
    status: "Wardrobe",
    collections: ["Travel", "Workwear"],
    description: "Airy cotton travel shirt",
    styleTags: ["Smart Casual"],
    climateTags: [],
    favorite: true,
    value: "180",
    retailValue: "240",
    createdAt: "2024-02-01T00:00:00.000Z"
  },
  {
    id: "beta-boots",
    brand: "",
    name: "Trail Boots",
    type: "Boots",
    garmentType: "Footwear",
    color: "Black",
    weight: "Heavy",
    status: "Wardrobe",
    collections: ["Hiking"],
    description: "",
    styleTags: ["Casual"],
    climateTags: ["Rain"],
    favorite: false,
    value: "320",
    retailValue: "480",
    createdAt: "2024-01-01T00:00:00.000Z"
  },
  {
    id: "gamma-cap",
    brand: "Man-tle",
    name: "Field Cap",
    type: "Cap",
    garmentType: "Headwear",
    color: "Beige",
    weight: "Light",
    status: "Wishlist",
    collections: ["Summer"],
    description: "Packable summer cap",
    styleTags: ["Casual", "Athleisure"],
    climateTags: [],
    favorite: false,
    value: "",
    retailValue: "90",
    createdAt: "2024-03-01T00:00:00.000Z"
  }
];

test("normalizeWardrobeFilters keeps backward-compatible strings and new multi-select arrays", () => {
  assert.deepEqual(
    normalizeWardrobeFilters({
      brand: "Our Legacy",
      type: ["Shirt", "Shirt", ""],
      style: "Casual",
      list: "Wardrobe",
      collections: ["Travel", "Travel", ""],
      favorite: "yes"
    }),
    {
      brand: ["Our Legacy"],
      type: ["Shirt"],
      garmentType: [],
      color: [],
      style: ["Casual"],
      laundry: "",
      weight: [],
      status: ["Wardrobe"],
      collections: ["Travel"],
      favorite: "yes"
    }
  );
});

test("filterWardrobeItems combines live search with multi-select filters", () => {
  const filtered = filterWardrobeItems(
    items,
    {
      brand: ["Our Legacy", "__none__"],
      type: [],
      garmentType: ["Top", "Footwear"],
      color: [],
      style: ["Smart Casual", "Casual"],
      laundry: "hide",
      weight: [],
      status: ["Wardrobe"],
      collections: ["Travel"],
      favorite: "",
      extra: "ignored"
    },
    { "beta-boots": true },
    "cotton shirt"
  );

  assert.deepEqual(filtered.map((item) => item.id), ["alpha-shirt"]);
});

test("getWardrobeFilterOptions preserves selected options while deriving contextual choices", () => {
  const options = getWardrobeFilterOptions(items, {
    brand: ["Our Legacy", "Missing Brand"],
    garmentType: ["Top"],
    type: [],
    color: [],
    style: [],
    laundry: "",
    weight: [],
    status: ["Wardrobe"],
    collections: ["Travel", "Missing Collection"],
    favorite: ""
  }, {
    itemStatusOptions: ["Wardrobe", "Wishlist"],
    styleTagOptions: ["Casual", "Smart Casual", "Athleisure", "Formal"]
  });

  assert.ok(options.brand.includes("Missing Brand"));
  assert.deepEqual(options.status, ["Wardrobe"]);
  assert.ok(options.collections.includes("Missing Collection"));
  assert.ok(options.type.includes("Shirt"));
});

test("filterWardrobeItems matches items by collection", () => {
  const filtered = filterWardrobeItems(
    items,
    {
      brand: [],
      type: [],
      garmentType: [],
      color: [],
      style: [],
      laundry: "",
      weight: [],
      status: [],
      collections: ["Hiking"],
      favorite: ""
    },
    {},
    ""
  );

  assert.deepEqual(filtered.map((item) => item.id), ["beta-boots"]);
});

test("sortWardrobeItems keeps existing wardrobe sort semantics", () => {
  assert.deepEqual(
    sortWardrobeItems(items, "newest").map((item) => item.id),
    ["gamma-cap", "alpha-shirt", "beta-boots"]
  );
  assert.deepEqual(
    sortWardrobeItems(items, "paidHigh").map((item) => item.id),
    ["beta-boots", "alpha-shirt", "gamma-cap"]
  );
});
