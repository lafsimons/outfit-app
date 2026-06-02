import test from "node:test";
import assert from "node:assert/strict";

import {
  addCollectionToItem,
  addTagToItemTags,
  clearItemCollections,
  hasMeaningfulItemChange,
  removeCollectionFromItem,
  removeSelectedItems,
  removeTagFromItemTags,
  setItemStatus,
  updateSelectedItems
} from "./bulkEdit.js";
import { editableClimateTagOptions } from "./generation.js";
import { styleTagOptions } from "./typeDefaults.js";

test("updateSelectedItems only updates selected entries", () => {
  const items = [
    { id: "a", favorite: false },
    { id: "b", favorite: false },
    { id: "c", favorite: false }
  ];

  const result = updateSelectedItems(items, ["b", "c"], (item) => ({
    ...item,
    favorite: true
  }));

  assert.deepEqual(result.nextItems, [
    { id: "a", favorite: false },
    { id: "b", favorite: true },
    { id: "c", favorite: true }
  ]);
  assert.deepEqual(result.changedIds, ["b", "c"]);
});

test("updateSelectedItems supports bulk moves across known lifecycle lists without touching other items", () => {
  ["Interested", "Wishlist", "Incoming", "Wardrobe", "Selling", "Sold"].forEach((targetList) => {
    const items = [
      { id: "a", status: "Wardrobe", list: "Wardrobe", name: "A" },
      { id: "b", status: "Wishlist", list: "Wishlist", name: "B" },
      { id: "c", status: "Wardrobe", list: "Wardrobe", name: "C" }
    ];

    const result = updateSelectedItems(items, ["b", "c"], (item) => ({
      ...setItemStatus(item, targetList)
    }));

    assert.deepEqual(result.nextItems, [
      { id: "a", status: "Wardrobe", list: "Wardrobe", name: "A" },
      { id: "b", status: targetList, list: targetList, name: "B" },
      { id: "c", status: targetList, list: targetList, name: "C" }
    ]);
    assert.deepEqual(result.changedIds, ["b", "c"]);
  });
});

test("bulk collection helpers add, remove, and clear collections without changing unrelated fields", () => {
  const baseItem = {
    id: "item_1",
    status: "Wardrobe",
    list: "Wardrobe",
    collections: ["Travel", "Workwear"],
    name: "Field Jacket",
    favorite: true
  };

  assert.deepEqual(
    addCollectionToItem(baseItem, "Summer"),
    {
      ...baseItem,
      collections: ["Travel", "Workwear", "Summer"]
    }
  );

  assert.deepEqual(
    removeCollectionFromItem(baseItem, "Travel"),
    {
      ...baseItem,
      collections: ["Workwear"]
    }
  );

  assert.deepEqual(
    clearItemCollections(baseItem),
    {
      ...baseItem,
      collections: []
    }
  );
});

test("bulk status helper keeps legacy list mirror synchronized", () => {
  assert.deepEqual(
    setItemStatus(
      {
        id: "item_2",
        status: "Wishlist",
        list: "Wishlist",
        collections: ["Travel"],
        description: "Keep me"
      },
      "Sold"
    ),
    {
      id: "item_2",
      status: "Sold",
      list: "Sold",
      collections: ["Travel"],
      description: "Keep me"
    }
  );
});

test("removeSelectedItems removes only selected entries", () => {
  const items = [
    { id: "a" },
    { id: "b" },
    { id: "c" }
  ];

  const result = removeSelectedItems(items, ["a", "c"]);

  assert.deepEqual(result.nextItems, [{ id: "b" }]);
  assert.deepEqual(result.removedIds, ["a", "c"]);
});

test("bulk tag helpers preserve normalization and uniqueness", () => {
  assert.deepEqual(addTagToItemTags(["Casual"], "Casual", styleTagOptions), ["Casual"]);
  assert.deepEqual(addTagToItemTags(["Casual"], "Formal", styleTagOptions), ["Casual", "Formal"]);
  assert.deepEqual(removeTagFromItemTags(["Casual", "Formal"], "Casual", styleTagOptions), ["Formal"]);
  assert.deepEqual(addTagToItemTags(["Rain"], "Snow", editableClimateTagOptions), ["Rain", "Snow"]);
});

test("hasMeaningfulItemChange ignores updatedAt-only changes", () => {
  assert.equal(
    hasMeaningfulItemChange(
      { id: "a", favorite: false, updatedAt: "2024-01-01T00:00:00.000Z" },
      { id: "a", favorite: false, updatedAt: "2024-01-02T00:00:00.000Z" }
    ),
    false
  );

  assert.equal(
    hasMeaningfulItemChange(
      { id: "a", favorite: false, updatedAt: "2024-01-01T00:00:00.000Z" },
      { id: "a", favorite: true, updatedAt: "2024-01-02T00:00:00.000Z" }
    ),
    true
  );
});
