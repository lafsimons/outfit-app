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
      brandExcluded: ["Man-tle"],
      type: ["Shirt", "Shirt", ""],
      style: "Casual",
      climate: ["Rain", "Rain"],
      list: "Wardrobe",
      statusExcluded: ["Sold"],
      collections: ["Travel", "Travel", ""],
      collectionsExcluded: ["Hiking"],
      favorite: "yes"
    }),
    {
      brand: ["Our Legacy"],
      brandExcluded: ["Man-tle"],
      type: ["Shirt"],
      typeExcluded: [],
      garmentType: [],
      garmentTypeExcluded: [],
      color: [],
      colorExcluded: [],
      style: ["Casual"],
      styleExcluded: [],
      climate: ["Rain"],
      climateExcluded: [],
      laundry: "",
      weight: [],
      weightExcluded: [],
      status: ["Wardrobe"],
      statusExcluded: ["Sold"],
      collections: ["Travel"],
      collectionsExcluded: ["Hiking"],
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
      climate: [],
      laundry: "hide",
      weight: [],
      status: ["Wardrobe"],
      statusExcluded: [],
      collections: ["Travel"],
      collectionsExcluded: ["Hiking"],
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
    brandExcluded: ["Missing Excluded Brand"],
    garmentType: ["Top"],
    garmentTypeExcluded: [],
    type: [],
    typeExcluded: [],
    color: [],
    colorExcluded: [],
    style: [],
    styleExcluded: [],
    climate: [],
    climateExcluded: ["Snow"],
    laundry: "",
    weight: [],
    weightExcluded: [],
    status: ["Wardrobe"],
    statusExcluded: [],
    collections: ["Travel", "Missing Collection"],
    collectionsExcluded: ["Missing Excluded Collection"],
    favorite: ""
  }, {
    itemStatusOptions: ["Wardrobe", "Wishlist"],
    styleTagOptions: ["Casual", "Smart Casual", "Athleisure", "Formal"]
  });

  assert.ok(options.brand.includes("Missing Brand"));
  assert.ok(options.brand.includes("Missing Excluded Brand"));
  assert.deepEqual(options.status, ["Wardrobe"]);
  assert.ok(options.collections.includes("Missing Collection"));
  assert.ok(options.collections.includes("Missing Excluded Collection"));
  assert.ok(options.climate.includes("Snow"));
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
      climate: [],
      climateExcluded: [],
      laundry: "",
      weight: [],
      weightExcluded: [],
      status: [],
      statusExcluded: [],
      collections: ["Hiking"],
      collectionsExcluded: [],
      favorite: ""
    },
    {},
    ""
  );

  assert.deepEqual(filtered.map((item) => item.id), ["beta-boots"]);
});

test("filterWardrobeItems excludes selected values and supports include plus exclude combinations", () => {
  assert.deepEqual(
    filterWardrobeItems(
      items,
      {
        brand: [],
        brandExcluded: [],
        type: [],
        typeExcluded: [],
        garmentType: [],
        garmentTypeExcluded: [],
        color: [],
        colorExcluded: [],
        style: ["Casual"],
        styleExcluded: [],
        climate: [],
        climateExcluded: ["Rain"],
        laundry: "",
        weight: [],
        weightExcluded: [],
        status: ["Wardrobe"],
        statusExcluded: ["Sold"],
        collections: [],
        collectionsExcluded: ["Hiking"],
        favorite: ""
      },
      {},
      ""
    ).map((item) => item.id),
    []
  );
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
