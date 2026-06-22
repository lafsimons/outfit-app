import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFitpicSearchText,
  emptyFitpicFilters,
  filterAndSortFitpics,
  getFitpicFilterOptions,
  getFitpicTagFilterGroups,
  getFitpicPreviewDirectionForKey,
  getFitpicPreviewNavigation,
  matchesFitpicFilters
} from "./fitpicLibrary.js";

const items = [
  {
    id: "shirt_old",
    itemUuid: "uuid-shirt",
    brand: "3sixteen",
    name: "Shirt Renamed",
    type: "Shirt",
    garmentType: "Top",
    status: "available",
    collections: ["Core"],
    favorite: true
  },
  {
    id: "boots_1",
    itemUuid: "uuid-boots",
    brand: "Paraboot",
    name: "Boots",
    type: "Boots",
    garmentType: "Footwear",
    status: "storage",
    collections: ["Rain"],
    favorite: false
  }
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

test("buildFitpicSearchText includes fitpic title and linked wardrobe item metadata", () => {
  const text = buildFitpicSearchText(fitpics[0], items);

  assert.equal(text.includes("morning look"), true);
  assert.equal(text.includes("soft tailoring"), false);
  assert.equal(text.includes("shirt renamed"), true);
  assert.equal(text.includes("3sixteen"), true);
  assert.equal(text.includes("core"), true);
  assert.equal(text.includes("spring"), false);
});

test("fitpic local search matches fitpic title and linked wardrobe metadata but ignores fitpic-only description", () => {
  const filtered = filterAndSortFitpics(
    fitpics,
    {
      search: "Morning"
    },
    items
  );

  assert.deepEqual(filtered.map((fitpic) => fitpic.id), ["fitpic_1"]);
  assert.deepEqual(filterAndSortFitpics(fitpics, { search: "soft tailoring" }, items), []);
  assert.deepEqual(filterAndSortFitpics(fitpics, { search: "shirt renamed" }, items).map((fitpic) => fitpic.id), ["fitpic_1"]);
  assert.deepEqual(filterAndSortFitpics(fitpics, { search: "3sixteen core" }, items).map((fitpic) => fitpic.id), ["fitpic_1"]);
});

test("fitpic tag filters and linked metadata filters use the fitpic filter architecture", () => {
  const filtered = filterAndSortFitpics(
    fitpics,
    {
      filters: {
        ...emptyFitpicFilters,
        tags: ["Spring"],
        type: ["Shirt"],
        collections: ["Core"],
        favorite: "yes"
      }
    },
    items
  );

  assert.deepEqual(filtered.map((fitpic) => fitpic.id), ["fitpic_1"]);
});

test("fitpic filters can exclude linked metadata values", () => {
  const filtered = filterAndSortFitpics(
    fitpics,
    {
      filters: {
        ...emptyFitpicFilters,
        statusExcluded: ["storage"]
      }
    },
    items
  );

  assert.deepEqual(filtered.map((fitpic) => fitpic.id), ["fitpic_1", "fitpic_3"]);
});

test("fitDate newest sorting falls back gracefully when fitDate is missing", () => {
  const sorted = filterAndSortFitpics(fitpics, { sort: "fitDateNewest" }, items);

  assert.deepEqual(sorted.map((fitpic) => fitpic.id), ["fitpic_2", "fitpic_1", "fitpic_3"]);
});

test("fitpic filter options include tags and linked wardrobe metadata", () => {
  const options = getFitpicFilterOptions(fitpics, items, {
    ...emptyFitpicFilters,
    collections: ["Core"]
  });

  assert.deepEqual(options.tags, ["Spring"]);
  assert.deepEqual(options.linkedItem, ["3sixteen Shirt Renamed"]);
  assert.deepEqual(options.brand, ["3sixteen"]);
  assert.deepEqual(options.type, ["Shirt"]);
  assert.deepEqual(options.status, ["available"]);
});

test("fitpic tag filter groups nest taxonomy-style tags by family", () => {
  const groups = getFitpicTagFilterGroups([
    "brand/taiga takahashi",
    "season/aw25",
    "season/ss25",
    "subject/garment",
    "source/official",
    "editorial"
  ]);

  assert.deepEqual(groups, [
    {
      family: "season",
      label: "season",
      options: [
        { value: "season/aw25", label: "aw25", fullLabel: "season/aw25" },
        { value: "season/ss25", label: "ss25", fullLabel: "season/ss25" }
      ]
    },
    {
      family: "brand",
      label: "brand",
      options: [
        { value: "brand/taiga takahashi", label: "taiga takahashi", fullLabel: "brand/taiga takahashi" }
      ]
    },
    {
      family: "source",
      label: "source",
      options: [
        { value: "source/official", label: "official", fullLabel: "source/official" }
      ]
    },
    {
      family: "subject",
      label: "subject",
      options: [
        { value: "subject/garment", label: "garment", fullLabel: "subject/garment" }
      ]
    },
    {
      family: "other",
      label: "Other",
      options: [
        { value: "editorial", label: "editorial", fullLabel: "editorial" }
      ]
    }
  ]);
});

test("matchesFitpicFilters treats linked favorite as linked-item metadata, not fitpic favorite", () => {
  assert.equal(
    matchesFitpicFilters(
      { ...fitpics[1], favorite: true },
      {
        ...emptyFitpicFilters,
        favorite: "no"
      },
      items
    ),
    true
  );
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
