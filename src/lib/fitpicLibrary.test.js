import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFitpicSearchText,
  filterAndSortFitpics,
  fitpicMatchesLinkedItemFilter,
  getFitpicLinkedItemFilterOptions,
  getFitpicPreviewDirectionForKey,
  getFitpicPreviewNavigation
} from "./fitpicLibrary.js";

const items = [
  { id: "shirt_old", itemUuid: "uuid-shirt", brand: "Brand", name: "Shirt Renamed" },
  { id: "boots_1", itemUuid: "uuid-boots", brand: "Brand", name: "Boots" }
];

const fitpics = [
  {
    id: "fitpic_1",
    name: "Morning Look",
    description: "Soft tailoring",
    tags: ["Spring"],
    favorite: true,
    fitDate: "2024-05-05",
    createdAt: "2024-05-06T00:00:00.000Z",
    importedAt: "2024-05-07T00:00:00.000Z",
    linkedItemUuids: ["uuid-shirt"],
    linkedItemIds: ["shirt_legacy"]
  },
  {
    id: "fitpic_2",
    name: "Night Look",
    description: "Boots focus",
    tags: ["Winter"],
    favorite: false,
    fitDate: null,
    createdAt: "2024-05-08T00:00:00.000Z",
    importedAt: "2024-05-09T00:00:00.000Z",
    linkedItemUuids: [],
    linkedItemIds: ["boots_1"]
  },
  {
    id: "fitpic_3",
    name: "Afternoon Look",
    description: "",
    tags: [],
    favorite: false,
    fitDate: "2024-05-01",
    createdAt: "2024-05-02T00:00:00.000Z",
    importedAt: "2024-05-03T00:00:00.000Z",
    linkedItemUuids: [],
    linkedItemIds: []
  }
];

test("buildFitpicSearchText includes linked wardrobe item labels through uuid-first resolution", () => {
  const text = buildFitpicSearchText(fitpics[0], items);

  assert.equal(text.includes("shirt renamed"), true);
  assert.equal(text.includes("soft tailoring"), true);
});

test("linked wardrobe item filter survives item rename through uuid-first resolution", () => {
  assert.equal(fitpicMatchesLinkedItemFilter(fitpics[0], "uuid:uuid-shirt", items), true);
  assert.equal(fitpicMatchesLinkedItemFilter(fitpics[0], "id:shirt_old", items), true);
  assert.equal(fitpicMatchesLinkedItemFilter(fitpics[0], "id:shirt_legacy", items), false);
});

test("linked wardrobe item filter options dedupe uuid/id sidecars into one current item", () => {
  assert.deepEqual(getFitpicLinkedItemFilterOptions(fitpics, items), [
    { value: "uuid:uuid-boots", label: "Brand Boots" },
    { value: "uuid:uuid-shirt", label: "Brand Shirt Renamed" }
  ]);
});

test("fitpic local search and favorite filter work together", () => {
  const filtered = filterAndSortFitpics(
    fitpics,
    {
      search: "shirt renamed",
      favoritesOnly: true
    },
    items
  );

  assert.deepEqual(filtered.map((fitpic) => fitpic.id), ["fitpic_1"]);
});

test("fitDate newest sorting falls back gracefully when fitDate is missing", () => {
  const sorted = filterAndSortFitpics(fitpics, { sort: "fitDateNewest" }, items);

  assert.deepEqual(sorted.map((fitpic) => fitpic.id), ["fitpic_2", "fitpic_1", "fitpic_3"]);
});

test("title sorting and linked item filtering are fitpics-local behaviors", () => {
  const sorted = filterAndSortFitpics(
    fitpics,
    {
      sort: "titleAz",
      linkedItemFilter: "uuid:uuid-boots"
    },
    items
  );

  assert.deepEqual(sorted.map((fitpic) => fitpic.id), ["fitpic_2"]);
});

test("fitpic preview navigation follows the current visible order without wrapping", () => {
  assert.deepEqual(getFitpicPreviewNavigation(["fitpic_3", "fitpic_1", "fitpic_2"], "fitpic_1"), {
    currentIndex: 1,
    totalCount: 3,
    previousFitpicId: "fitpic_3",
    nextFitpicId: "fitpic_2"
  });

  assert.deepEqual(getFitpicPreviewNavigation(["fitpic_3", "fitpic_1", "fitpic_2"], "fitpic_3"), {
    currentIndex: 0,
    totalCount: 3,
    previousFitpicId: null,
    nextFitpicId: "fitpic_1"
  });

  assert.deepEqual(getFitpicPreviewNavigation(["fitpic_3", "fitpic_1", "fitpic_2"], "fitpic_2"), {
    currentIndex: 2,
    totalCount: 3,
    previousFitpicId: "fitpic_1",
    nextFitpicId: null
  });
});

test("fitpic preview navigation reports no neighbors when the current fitpic is no longer visible", () => {
  assert.deepEqual(getFitpicPreviewNavigation(["fitpic_1", "fitpic_3"], "fitpic_2"), {
    currentIndex: -1,
    totalCount: 2,
    previousFitpicId: null,
    nextFitpicId: null
  });
});

test("fitpic preview keyboard navigation maps arrow keys to directions", () => {
  assert.equal(getFitpicPreviewDirectionForKey({ key: "ArrowLeft" }), "previous");
  assert.equal(getFitpicPreviewDirectionForKey({ key: "ArrowRight" }), "next");
  assert.equal(getFitpicPreviewDirectionForKey({ key: "ArrowLeft", shiftKey: true }), null);
  assert.equal(getFitpicPreviewDirectionForKey({ key: "Enter" }), null);
});
