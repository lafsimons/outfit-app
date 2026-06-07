import test from "node:test";
import assert from "node:assert/strict";

import {
  addFitpicTagsToDraft,
  addFitpicImagesToDraft,
  addLinkedItemToFitpicDraft,
  applyFitpicDateInput,
  getFitpicDateInputValue,
  moveFitpicImageInDraft,
  removeFitpicTagFromDraft,
  removeFitpicImageFromDraft,
  removeLinkedItemFromFitpicDraft,
  resolveFitpicLinkedItems,
  setPrimaryFitpicImageInDraft,
  syncFitpicLinkedItemSidecars
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
    { key: "uuid:missing-uuid", itemId: null, itemUuid: "missing-uuid", missing: true }
  ]);
});

test("resolveFitpicLinkedItems prefers itemUuid and ignores stale legacy sidecars after item id rename", () => {
  const entries = resolveFitpicLinkedItems(
    ["item-uuid-1"],
    ["old_item_id"],
    [
      { id: "renamed_item_id", itemUuid: "item-uuid-1", brand: "Brand", name: "Renamed" }
    ]
  );

  assert.deepEqual(entries.map((entry) => ({
    key: entry.key,
    itemId: entry.itemId,
    itemUuid: entry.itemUuid,
    missing: entry.missing
  })), [
    { key: "uuid:item-uuid-1", itemId: "renamed_item_id", itemUuid: "item-uuid-1", missing: false }
  ]);
});

test("resolveFitpicLinkedItems falls back to legacy item ids for legacy-only data", () => {
  const entries = resolveFitpicLinkedItems(
    [],
    ["legacy_item_id"],
    [
      { id: "legacy_item_id", itemUuid: "item-uuid-1", brand: "Brand", name: "Legacy" }
    ]
  );

  assert.deepEqual(entries.map((entry) => ({
    itemId: entry.itemId,
    itemUuid: entry.itemUuid,
    missing: entry.missing
  })), [
    { itemId: "legacy_item_id", itemUuid: "item-uuid-1", missing: false }
  ]);
});

test("syncFitpicLinkedItemSidecars refreshes legacy item ids from stable uuids after rename", () => {
  const synced = syncFitpicLinkedItemSidecars(
    {
      linkedItemUuids: ["item-uuid-1"],
      linkedItemIds: ["old_item_id"]
    },
    [
      { id: "renamed_item_id", itemUuid: "item-uuid-1", brand: "Brand", name: "Renamed" }
    ]
  );

  assert.deepEqual(synced, {
    linkedItemUuids: ["item-uuid-1"],
    linkedItemIds: ["renamed_item_id"]
  });
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

test("fitpic draft linked item helpers keep uuid/id sidecars aligned and avoid duplicate links", () => {
  const added = addLinkedItemToFitpicDraft(
    {
      linkedItemUuids: ["item-uuid-1"],
      linkedItemIds: ["old_item_id"]
    },
    {
      id: "renamed_item_id",
      itemUuid: "item-uuid-1"
    }
  );

  assert.deepEqual(added, {
    linkedItemUuids: ["item-uuid-1"],
    linkedItemIds: ["renamed_item_id"]
  });

  assert.deepEqual(
    removeLinkedItemFromFitpicDraft(added, { itemUuid: "item-uuid-1", itemId: "renamed_item_id" }),
    {
      linkedItemUuids: [],
      linkedItemIds: []
    }
  );
});

test("fitpic draft tag helpers add deduped trimmed tags and clear tag input", () => {
  const added = addFitpicTagsToDraft(
    {
      tags: ["Summer"],
      tagInput: "  black, summer,  fit-check "
    },
    "  black, summer,  fit-check "
  );

  assert.deepEqual(added, {
    tags: ["Summer", "black", "fit-check"],
    tagInput: ""
  });
});

test("fitpic draft tag helpers remove tags case-insensitively", () => {
  const removed = removeFitpicTagFromDraft(
    {
      tags: ["Summer", "black", "fit-check"],
      tagInput: ""
    },
    "BLACK"
  );

  assert.deepEqual(removed, {
    tags: ["Summer", "fit-check"],
    tagInput: ""
  });
});

test("fitpic image draft helpers add images and keep appended order", () => {
  const added = addFitpicImagesToDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" }
      ],
      primaryImageUuid: "image-1"
    },
    [
      { fitpicImageUuid: "image-2", order: 0, imageData: "two" },
      { fitpicImageUuid: "image-3", order: 0, imageData: "three" }
    ]
  );

  assert.deepEqual(
    added.fitpicImages.map((fitpicImage) => ({
      fitpicImageUuid: fitpicImage.fitpicImageUuid,
      order: fitpicImage.order
    })),
    [
      { fitpicImageUuid: "image-1", order: 0 },
      { fitpicImageUuid: "image-2", order: 1 },
      { fitpicImageUuid: "image-3", order: 2 }
    ]
  );
  assert.equal(added.primaryImageUuid, "image-1");
});

test("fitpic image draft helpers cannot remove the only remaining image", () => {
  const unchanged = removeFitpicImageFromDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" }
      ],
      primaryImageUuid: "image-1"
    },
    "image-1"
  );

  assert.deepEqual(unchanged, {
    fitpicImages: [
      { fitpicImageUuid: "image-1", order: 0, imageData: "one" }
    ],
    primaryImageUuid: "image-1"
  });
});

test("fitpic image draft helpers remove images and reassign primary safely", () => {
  const removed = removeFitpicImageFromDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" },
        { fitpicImageUuid: "image-2", order: 1, imageData: "two" }
      ],
      primaryImageUuid: "image-1"
    },
    "image-1"
  );

  assert.deepEqual(removed, {
    fitpicImages: [
      { fitpicImageUuid: "image-2", order: 0, imageData: "two" }
    ],
    primaryImageUuid: "image-2"
  });
});

test("fitpic image draft helpers set the selected primary image", () => {
  const updated = setPrimaryFitpicImageInDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" },
        { fitpicImageUuid: "image-2", order: 1, imageData: "two" }
      ],
      primaryImageUuid: "image-1"
    },
    "image-2"
  );

  assert.equal(updated.primaryImageUuid, "image-2");
});

test("fitpic image draft helpers move an image up while preserving primary identity", () => {
  const updated = moveFitpicImageInDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" },
        { fitpicImageUuid: "image-2", order: 1, imageData: "two" },
        { fitpicImageUuid: "image-3", order: 2, imageData: "three" }
      ],
      primaryImageUuid: "image-2"
    },
    "image-2",
    "up"
  );

  assert.deepEqual(
    updated.fitpicImages.map((fitpicImage) => ({
      fitpicImageUuid: fitpicImage.fitpicImageUuid,
      order: fitpicImage.order
    })),
    [
      { fitpicImageUuid: "image-2", order: 0 },
      { fitpicImageUuid: "image-1", order: 1 },
      { fitpicImageUuid: "image-3", order: 2 }
    ]
  );
  assert.equal(updated.primaryImageUuid, "image-2");
});

test("fitpic image draft helpers move an image down while preserving image uuids", () => {
  const updated = moveFitpicImageInDraft(
    {
      fitpicImages: [
        { fitpicImageUuid: "image-1", order: 0, imageData: "one" },
        { fitpicImageUuid: "image-2", order: 1, imageData: "two" },
        { fitpicImageUuid: "image-3", order: 2, imageData: "three" }
      ],
      primaryImageUuid: "image-1"
    },
    "image-2",
    "down"
  );

  assert.deepEqual(
    updated.fitpicImages.map((fitpicImage) => ({
      fitpicImageUuid: fitpicImage.fitpicImageUuid,
      order: fitpicImage.order
    })),
    [
      { fitpicImageUuid: "image-1", order: 0 },
      { fitpicImageUuid: "image-3", order: 1 },
      { fitpicImageUuid: "image-2", order: 2 }
    ]
  );
  assert.equal(updated.primaryImageUuid, "image-1");
});
