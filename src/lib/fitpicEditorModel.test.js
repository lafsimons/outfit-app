import test from "node:test";
import assert from "node:assert/strict";

import {
  addLinkedItemToFitpicDraft,
  applyFitpicDateInput,
  getFitpicDateInputValue,
  removeLinkedItemFromFitpicDraft,
  resolveFitpicLinkedItems
} from "./fitpicEditorModel.js";

test("getFitpicDateInputValue extracts a date from date-only and timestamp values", () => {
  assert.equal(getFitpicDateInputValue("2024-06-12"), "2024-06-12");
  assert.equal(getFitpicDateInputValue("2024-06-12T10:11:12.000Z"), "2024-06-12");
  assert.equal(getFitpicDateInputValue(""), "");
});

test("applyFitpicDateInput preserves the original timestamp when the date is unchanged", () => {
  assert.equal(
    applyFitpicDateInput("2024-06-12T10:11:12.000Z", "2024-06-12"),
    "2024-06-12T10:11:12.000Z"
  );
});

test("applyFitpicDateInput preserves time-of-day when the date changes", () => {
  assert.equal(
    applyFitpicDateInput("2024-06-12T10:11:12.000Z", "2024-06-20"),
    "2024-06-20T10:11:12.000Z"
  );
  assert.equal(applyFitpicDateInput("2024-06-12", "2024-06-20"), "2024-06-20");
  assert.equal(applyFitpicDateInput("2024-06-12", ""), null);
});

test("resolveFitpicLinkedItems resolves current items and preserves missing links", () => {
  const entries = resolveFitpicLinkedItems(
    ["item-uuid-1", "missing-uuid"],
    ["item_1", "missing_id"],
    [
      { id: "item_1", itemUuid: "item-uuid-1", brand: "Brand", name: "One" },
      { id: "item_2", itemUuid: "item-uuid-2", brand: "Brand", name: "Two" }
    ]
  );

  assert.deepEqual(entries.map((entry) => ({
    key: entry.key,
    itemId: entry.itemId,
    itemUuid: entry.itemUuid,
    missing: entry.missing
  })), [
    { key: "uuid:item-uuid-1", itemId: "item_1", itemUuid: "item-uuid-1", missing: false },
    { key: "uuid:missing-uuid", itemId: null, itemUuid: "missing-uuid", missing: true },
    { key: "id:missing_id", itemId: "missing_id", itemUuid: null, missing: true }
  ]);
});

test("fitpic draft linked item helpers add and remove uuid/id sidecars together", () => {
  const added = addLinkedItemToFitpicDraft(
    {
      linkedItemUuids: [],
      linkedItemIds: []
    },
    {
      id: "item_1",
      itemUuid: "item-uuid-1"
    }
  );

  assert.deepEqual(added, {
    linkedItemUuids: ["item-uuid-1"],
    linkedItemIds: ["item_1"]
  });

  assert.deepEqual(
    removeLinkedItemFromFitpicDraft(added, { itemUuid: "item-uuid-1", itemId: "item_1" }),
    {
      linkedItemUuids: [],
      linkedItemIds: []
    }
  );
});
