import test from "node:test";
import assert from "node:assert/strict";

import {
  getWardrobePreviewDirectionForKey,
  getWardrobePreviewNavigation
} from "./wardrobePreviewNavigation.js";

test("wardrobe preview navigation returns next item in visible order", () => {
  assert.deepEqual(
    getWardrobePreviewNavigation(["alpha", "beta", "gamma"], "beta"),
    {
      currentIndex: 1,
      totalCount: 3,
      previousItemId: "alpha",
      nextItemId: "gamma"
    }
  );
});

test("wardrobe preview navigation returns previous item in visible order", () => {
  assert.deepEqual(
    getWardrobePreviewNavigation(["alpha", "beta", "gamma"], "gamma"),
    {
      currentIndex: 2,
      totalCount: 3,
      previousItemId: "beta",
      nextItemId: "alpha"
    }
  );
});

test("wardrobe preview navigation wraps around at both ends", () => {
  assert.deepEqual(getWardrobePreviewNavigation(["alpha", "beta", "gamma"], "alpha"), {
    currentIndex: 0,
    totalCount: 3,
    previousItemId: "gamma",
    nextItemId: "beta"
  });
});

test("wardrobe preview navigation only follows the current filtered dataset", () => {
  assert.deepEqual(
    getWardrobePreviewNavigation(["filtered-2", "filtered-4"], "filtered-2"),
    {
      currentIndex: 0,
      totalCount: 2,
      previousItemId: "filtered-4",
      nextItemId: "filtered-4"
    }
  );
});

test("wardrobe preview navigation skips excluded items when they are absent from the visible dataset", () => {
  assert.deepEqual(
    getWardrobePreviewNavigation(["item-1", "item-3"], "item-1"),
    {
      currentIndex: 0,
      totalCount: 2,
      previousItemId: "item-3",
      nextItemId: "item-3"
    }
  );
});

test("wardrobe preview keyboard navigation maps arrow keys to directions", () => {
  assert.equal(getWardrobePreviewDirectionForKey({ key: "ArrowLeft" }), "previous");
  assert.equal(getWardrobePreviewDirectionForKey({ key: "ArrowRight" }), "next");
  assert.equal(getWardrobePreviewDirectionForKey({ key: "ArrowRight", metaKey: true }), null);
  assert.equal(getWardrobePreviewDirectionForKey({ key: "Enter" }), null);
});

test("wardrobe preview preserves the current item across visible-order refreshes when it remains visible", () => {
  const initial = getWardrobePreviewNavigation(["a", "b", "c"], "b");
  const refreshed = getWardrobePreviewNavigation(["c", "b", "a"], "b");

  assert.equal(initial.currentIndex, 1);
  assert.equal(refreshed.currentIndex, 1);
  assert.equal(refreshed.previousItemId, "c");
  assert.equal(refreshed.nextItemId, "a");
});

test("wardrobe preview navigation reports no neighbors when the current item is no longer visible", () => {
  assert.deepEqual(getWardrobePreviewNavigation(["a", "c"], "b"), {
    currentIndex: -1,
    totalCount: 2,
    previousItemId: null,
    nextItemId: null
  });
});
