import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyWardrobeFilters,
  getVisibleWardrobeItems
} from "./wardrobeLibrary.js";
import {
  getWardrobePreviewDirectionForKey,
  getWardrobePreviewImageNavigation,
  getWardrobePreviewNavigation
} from "./wardrobePreviewNavigation.js";

const previewItems = [
  {
    id: "item-704-a",
    brand: "Brand A",
    name: "Lot 704 Indigo Jacket",
    type: "Jacket",
    garmentType: "Outerwear",
    status: "Wardrobe",
    collections: ["Archive"],
    description: "First 704 item",
    createdAt: "2024-01-01T00:00:00.000Z"
  },
  {
    id: "item-704-b",
    brand: "Brand B",
    name: "Lot 704 Work Shirt",
    type: "Shirt",
    garmentType: "Top",
    status: "Wishlist",
    collections: ["Travel"],
    description: "Second 704 item",
    createdAt: "2024-03-01T00:00:00.000Z"
  },
  {
    id: "item-601",
    brand: "Brand C",
    name: "Lot 601 Denim",
    type: "Jeans",
    garmentType: "Bottom",
    status: "Wardrobe",
    collections: ["Travel"],
    description: "Travel item",
    createdAt: "2024-02-01T00:00:00.000Z"
  }
];

const previewSearchTextById = Object.fromEntries(
  previewItems.map((item) => [
    item.id,
    `${item.id} ${item.brand} ${item.name} ${item.type} ${item.garmentType} ${item.status} ${item.collections.join(" ")} ${item.description}`.toLowerCase()
  ])
);

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

test("wardrobe preview navigation stays inside the current search result set", () => {
  const visibleIds = getVisibleWardrobeItems(
    previewItems,
    emptyWardrobeFilters,
    {},
    "704",
    previewSearchTextById,
    "newest"
  ).map((item) => item.id);

  assert.deepEqual(visibleIds, ["item-704-b", "item-704-a"]);
  assert.deepEqual(getWardrobePreviewNavigation(visibleIds, "item-704-b"), {
    currentIndex: 0,
    totalCount: 2,
    previousItemId: "item-704-a",
    nextItemId: "item-704-a"
  });
});

test("wardrobe preview navigation stays inside collection and status result sets in sort order", () => {
  const travelIds = getVisibleWardrobeItems(
    previewItems,
    {
      ...emptyWardrobeFilters,
      collections: ["Travel"]
    },
    {},
    "",
    previewSearchTextById,
    "oldest"
  ).map((item) => item.id);
  const wishlistIds = getVisibleWardrobeItems(
    previewItems,
    {
      ...emptyWardrobeFilters,
      status: ["Wishlist"]
    },
    {},
    "",
    previewSearchTextById,
    "newest"
  ).map((item) => item.id);

  assert.deepEqual(travelIds, ["item-601", "item-704-b"]);
  assert.deepEqual(getWardrobePreviewNavigation(travelIds, "item-601"), {
    currentIndex: 0,
    totalCount: 2,
    previousItemId: "item-704-b",
    nextItemId: "item-704-b"
  });
  assert.deepEqual(wishlistIds, ["item-704-b"]);
  assert.deepEqual(getWardrobePreviewNavigation(wishlistIds, "item-704-b"), {
    currentIndex: 0,
    totalCount: 1,
    previousItemId: "item-704-b",
    nextItemId: "item-704-b"
  });
});

test("active image initializes preview image selection", () => {
  const navigation = getWardrobePreviewImageNavigation(
    [
      { itemImageUuid: "image-1" },
      { itemImageUuid: "image-2" },
      { itemImageUuid: "image-3" }
    ],
    "image-2"
  );

  assert.equal(navigation.currentIndex, 1);
  assert.equal(navigation.currentItemImage?.itemImageUuid, "image-2");
});

test("multi-image preview navigation returns previous and next image uuids", () => {
  const navigation = getWardrobePreviewImageNavigation(
    [
      { itemImageUuid: "image-1" },
      { itemImageUuid: "image-2" },
      { itemImageUuid: "image-3" }
    ],
    "image-2"
  );

  assert.equal(navigation.previousItemImageUuid, "image-1");
  assert.equal(navigation.nextItemImageUuid, "image-3");
  assert.equal(navigation.showCarousel, true);
});

test("multi-image preview navigation wraps around", () => {
  const navigation = getWardrobePreviewImageNavigation(
    [
      { itemImageUuid: "image-1" },
      { itemImageUuid: "image-2" },
      { itemImageUuid: "image-3" }
    ],
    "image-1"
  );

  assert.equal(navigation.previousItemImageUuid, "image-3");
  assert.equal(navigation.nextItemImageUuid, "image-2");
});

test("single-image preview hides carousel behavior", () => {
  assert.deepEqual(
    getWardrobePreviewImageNavigation([{ itemImageUuid: "image-1" }], "image-1"),
    {
      currentIndex: 0,
      totalCount: 1,
      currentItemImage: { itemImageUuid: "image-1" },
      previousItemImageUuid: null,
      nextItemImageUuid: null,
      showCarousel: false
    }
  );
});

test("invalid preview image selection falls back safely to the first image", () => {
  const navigation = getWardrobePreviewImageNavigation(
    [
      { itemImageUuid: "image-1" },
      { itemImageUuid: "image-2" }
    ],
    "missing-image"
  );

  assert.equal(navigation.currentIndex, 0);
  assert.equal(navigation.currentItemImage?.itemImageUuid, "image-1");
});

test("preview image navigation does not mutate active image selection", () => {
  const item = {
    activeItemImageUuid: "image-2",
    itemImages: [
      { itemImageUuid: "image-1" },
      { itemImageUuid: "image-2" }
    ]
  };

  const navigation = getWardrobePreviewImageNavigation(item.itemImages, "image-1");

  assert.equal(navigation.currentItemImage?.itemImageUuid, "image-1");
  assert.equal(item.activeItemImageUuid, "image-2");
});
