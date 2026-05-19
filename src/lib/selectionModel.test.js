import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextSelectionState,
  getSelectionRangeIds,
  pruneSelectedIds
} from "./selectionModel.js";

test("getSelectionRangeIds returns inclusive visible ranges in either direction", () => {
  const orderedIds = ["a", "b", "c", "d"];

  assert.deepEqual(getSelectionRangeIds(orderedIds, "b", "d"), ["b", "c", "d"]);
  assert.deepEqual(getSelectionRangeIds(orderedIds, "d", "b"), ["b", "c", "d"]);
  assert.deepEqual(getSelectionRangeIds(orderedIds, "x", "b"), []);
});

test("getNextSelectionState keeps file-browser style single, toggle, and shift range semantics", () => {
  const orderedIds = ["a", "b", "c", "d"];

  assert.deepEqual(
    getNextSelectionState({
      selectedIds: [],
      orderedIds,
      clickedId: "b",
      anchorId: null
    }),
    {
      selectedIds: ["b"],
      anchorId: "b"
    }
  );

  assert.deepEqual(
    getNextSelectionState({
      selectedIds: ["b"],
      orderedIds,
      clickedId: "d",
      anchorId: "b",
      shiftKey: true
    }),
    {
      selectedIds: ["b", "c", "d"],
      anchorId: "b"
    }
  );

  assert.deepEqual(
    getNextSelectionState({
      selectedIds: ["b", "c", "d"],
      orderedIds,
      clickedId: "c",
      anchorId: "b",
      toggleKey: true
    }),
    {
      selectedIds: ["b", "d"],
      anchorId: "c"
    }
  );
});

test("getNextSelectionState falls back safely when shift has no usable anchor", () => {
  assert.deepEqual(
    getNextSelectionState({
      selectedIds: ["a"],
      orderedIds: ["a", "b", "c"],
      clickedId: "c",
      anchorId: "missing",
      shiftKey: true
    }),
    {
      selectedIds: ["c"],
      anchorId: "c"
    }
  );
});

test("pruneSelectedIds removes duplicates and missing ids", () => {
  assert.deepEqual(pruneSelectedIds(["b", "a", "b", "x"], ["a", "b", "c"]), ["b", "a"]);
});
