import test from "node:test";
import assert from "node:assert/strict";

import {
  getItemStatusOptions,
  getItemListOptions,
  isActiveStatus,
  isInactiveStatus,
  matchesStatusFilter,
  normalizeStatus,
  matchesListFilter,
  normalizeList
} from "./typeDefaults.js";

test("normalizeStatus defaults missing values to Wardrobe and accepts Incoming", () => {
  assert.equal(normalizeStatus(undefined), "Wardrobe");
  assert.equal(normalizeStatus(""), "Wardrobe");
  ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "Archived"].forEach((status) => {
    assert.equal(normalizeStatus(status), status);
  });
});

test("normalizeList remains a compatibility alias for status normalization", () => {
  assert.equal(normalizeList(undefined), "Wardrobe");
  assert.equal(normalizeList(""), "Wardrobe");
  ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "Archived"].forEach((list) => {
    assert.equal(normalizeList(list), list);
  });
});

test("active and inactive status helpers centralize lifecycle behavior", () => {
  assert.equal(isActiveStatus("Wardrobe"), true);
  assert.equal(isActiveStatus("Archived"), false);
  assert.equal(isInactiveStatus("Sold"), true);
  assert.equal(isInactiveStatus("Archived"), true);
  assert.equal(isInactiveStatus("Wishlist"), false);
  assert.equal(isInactiveStatus("ArchivedLater"), false);
});

test("normalizeList preserves unknown non-empty list values for forward compatibility", () => {
  assert.equal(normalizeList("ArchivedLater"), "ArchivedLater");
  assert.equal(normalizeList("  ArchivedLater  "), "ArchivedLater");
});

test("getItemListOptions keeps known list order and appends unknown values once", () => {
  assert.deepEqual(
    getItemListOptions(["Wishlist", "Incoming", "ArchivedLater", "ArchivedLater", "Zeta"]),
    ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "Archived", "ArchivedLater", "Zeta"]
  );
});

test("getItemStatusOptions keeps known status order and appends unknown values once", () => {
  assert.deepEqual(
    getItemStatusOptions(["Wishlist", "Incoming", "ArchivedLater", "ArchivedLater", "Zeta"]),
    ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "Archived", "ArchivedLater", "Zeta"]
  );
});

test("matchesStatusFilter respects incoming and preserved unknown status values", () => {
  assert.equal(matchesStatusFilter("Incoming", "Incoming"), true);
  assert.equal(matchesStatusFilter("Selling", "Selling"), true);
  assert.equal(matchesStatusFilter("Sold", "Sold"), true);
  assert.equal(matchesStatusFilter("Archived", "Archived"), true);
  assert.equal(matchesStatusFilter("ArchivedLater", "ArchivedLater"), true);
  assert.equal(matchesStatusFilter("ArchivedLater", "Incoming"), false);
  assert.equal(matchesStatusFilter("ArchivedLater", ""), true);
});

test("matchesListFilter respects incoming and preserved unknown list values", () => {
  assert.equal(matchesListFilter("Incoming", "Incoming"), true);
  assert.equal(matchesListFilter("Selling", "Selling"), true);
  assert.equal(matchesListFilter("Sold", "Sold"), true);
  assert.equal(matchesListFilter("Archived", "Archived"), true);
  assert.equal(matchesListFilter("ArchivedLater", "ArchivedLater"), true);
  assert.equal(matchesListFilter("ArchivedLater", "Incoming"), false);
  assert.equal(matchesListFilter("ArchivedLater", ""), true);
});
