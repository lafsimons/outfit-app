import test from "node:test";
import assert from "node:assert/strict";

import {
  getItemListOptions,
  matchesListFilter,
  normalizeList
} from "./typeDefaults.js";

test("normalizeList defaults missing values to Wardrobe and accepts Incoming", () => {
  assert.equal(normalizeList(undefined), "Wardrobe");
  assert.equal(normalizeList(""), "Wardrobe");
  ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold"].forEach((list) => {
    assert.equal(normalizeList(list), list);
  });
});

test("normalizeList preserves unknown non-empty list values for forward compatibility", () => {
  assert.equal(normalizeList("ArchivedLater"), "ArchivedLater");
  assert.equal(normalizeList("  ArchivedLater  "), "ArchivedLater");
});

test("getItemListOptions keeps known list order and appends unknown values once", () => {
  assert.deepEqual(
    getItemListOptions(["Wishlist", "Incoming", "ArchivedLater", "ArchivedLater", "Zeta"]),
    ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "ArchivedLater", "Zeta"]
  );
});

test("matchesListFilter respects incoming and preserved unknown list values", () => {
  assert.equal(matchesListFilter("Incoming", "Incoming"), true);
  assert.equal(matchesListFilter("Selling", "Selling"), true);
  assert.equal(matchesListFilter("Sold", "Sold"), true);
  assert.equal(matchesListFilter("ArchivedLater", "ArchivedLater"), true);
  assert.equal(matchesListFilter("ArchivedLater", "Incoming"), false);
  assert.equal(matchesListFilter("ArchivedLater", ""), true);
});
