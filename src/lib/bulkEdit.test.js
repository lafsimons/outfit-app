import test from "node:test";
import assert from "node:assert/strict";

import {
  addTagToItemTags,
  hasMeaningfulItemChange,
  removeSelectedItems,
  removeTagFromItemTags,
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
