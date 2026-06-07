import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSavedOutfitSearchText,
  filterAndSortSavedOutfits,
  getSavedOutfitTagFilterOptions
} from "./savedOutfitLibrary.js";

const savedOutfits = [
  {
    id: "saved_1",
    name: "Monochrome Layer",
    description: "Black textured layers",
    tags: ["Black", "Winter"],
    favorite: true,
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-03-01T00:00:00.000Z"
  },
  {
    id: "saved_2",
    name: "Light Summer",
    description: "Relaxed linen mix",
    tags: ["Summer", "Light"],
    favorite: false,
    createdAt: "2024-04-01T00:00:00.000Z",
    updatedAt: "2024-04-03T00:00:00.000Z"
  },
  {
    id: "saved_3",
    name: "Archive Study",
    description: "",
    tags: ["black", "Study"],
    favorite: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null
  }
];

test("buildSavedOutfitSearchText includes name description and tags", () => {
  const text = buildSavedOutfitSearchText(savedOutfits[0]);

  assert.equal(text.includes("monochrome layer"), true);
  assert.equal(text.includes("black textured layers"), true);
  assert.equal(text.includes("winter"), true);
});

test("getSavedOutfitTagFilterOptions dedupes tags case-insensitively", () => {
  assert.deepEqual(getSavedOutfitTagFilterOptions(savedOutfits), [
    { value: "Black", label: "Black" },
    { value: "Light", label: "Light" },
    { value: "Study", label: "Study" },
    { value: "Summer", label: "Summer" },
    { value: "Winter", label: "Winter" }
  ]);
});

test("filterAndSortSavedOutfits supports local search and favorite filtering", () => {
  const filtered = filterAndSortSavedOutfits(savedOutfits, {
    search: "textured",
    favoritesOnly: true
  });

  assert.deepEqual(filtered.map((savedOutfit) => savedOutfit.id), ["saved_1"]);
});

test("filterAndSortSavedOutfits supports tag filtering and title sorting", () => {
  const filtered = filterAndSortSavedOutfits(savedOutfits, {
    tagFilter: "black",
    sort: "titleAz"
  });

  assert.deepEqual(filtered.map((savedOutfit) => savedOutfit.id), ["saved_3", "saved_1"]);
});

test("filterAndSortSavedOutfits defaults to updated newest with created fallback", () => {
  const filtered = filterAndSortSavedOutfits(savedOutfits, {
    sort: "updatedNewest"
  });

  assert.deepEqual(filtered.map((savedOutfit) => savedOutfit.id), ["saved_2", "saved_1", "saved_3"]);
});
