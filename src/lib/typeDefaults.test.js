import test from "node:test";
import assert from "node:assert/strict";

import {
  getItemStatusOptions,
  getItemLayerRoles,
  isShirtLayeringType,
  resolveTypeDefaults,
  getItemListOptions,
  isActiveStatus,
  isInactiveStatus,
  matchesStatusFilter,
  normalizeStatus,
  matchesListFilter,
  normalizeList,
  sortStatusOptions
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

test("sortStatusOptions uses lifecycle order instead of alphabetical sorting", () => {
  assert.deepEqual(
    sortStatusOptions(["Incoming", "Interested", "Selling", "Wardrobe", "Wishlist", "Sold", "Archived"]),
    ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold", "Archived"]
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


test("legacy layer types map to explicit roles without broadening Both to Outer", () => {
  assert.deepEqual(getItemLayerRoles({ garmentType: "Top", layerType: "Both" }), ["Base", "Mid"]);
  assert.deepEqual(getItemLayerRoles({ garmentType: "Top", layerType: "Inner" }), ["Base"]);
  assert.deepEqual(getItemLayerRoles({ garmentType: "Outerwear", layerType: "Outer" }), ["Outer"]);
  assert.deepEqual(getItemLayerRoles({ garmentType: "Bottom", layerType: "Both" }), []);
  assert.deepEqual(resolveTypeDefaults("Sweatshirt").layerRoles, ["Base", "Mid"]);
  assert.deepEqual(resolveTypeDefaults("T-Shirt").layerRoles, ["Base"]);
  assert.deepEqual(resolveTypeDefaults("Jacket").layerRoles, ["Outer"]);
});

test("explicit layer selections override legacy metadata and retain an empty selection", () => {
  assert.deepEqual(getItemLayerRoles({ layerType: "Both", layerRoles: ["Outer", "Mid", "Mid", "invalid"] }), ["Mid", "Outer"]);
  assert.deepEqual(getItemLayerRoles({ layerType: "Both", layerRoles: [] }), []);
});


test("shirts default to Base and Mid while tees and sweatshirts retain their own classification", () => {
  for (const type of ["Shirt", "Casual Shirt", "Wool Shirt", "Shirt (heavier cotton, wool)", "Overshirt", "Work Shirt"]) {
    assert.deepEqual(resolveTypeDefaults(type).layerRoles, ["Base", "Mid"], type);
    assert.equal(isShirtLayeringType({ garmentType: "Top", type }), true, type);
  }
  for (const type of ["T-Shirt", "LS T-Shirt", "Sport T-Shirt", "Sport LS T-Shirt"]) {
    assert.deepEqual(resolveTypeDefaults(type).layerRoles, ["Base"], type);
    assert.equal(isShirtLayeringType({ garmentType: "Top", type }), false, type);
  }
  for (const type of ["Sweatshirt", "Sweatshirt (thin)", "Cotton Sweatshirt"]) {
    assert.equal(isShirtLayeringType({ garmentType: "Top", type }), false, type);
  }
});
