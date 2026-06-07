import test from "node:test";
import assert from "node:assert/strict";

import {
  addWardrobeItemImagesToDraft,
  createImportedWardrobeItemImage,
  moveWardrobeItemImageInDraft,
  removeWardrobeItemImageFromDraft,
  replaceActiveWardrobeItemImageAssetInDraft,
  setActiveWardrobeItemImageInDraft
} from "./wardrobeItemImageEditorModel.js";

function createBaseDraft() {
  return {
    itemUuid: "item-uuid-1",
    imageUrl: "data:image/png;base64,front",
    images: {
      original: { src: "" },
      preview: { src: "data:image/png;base64,front" },
      thumbnail: { src: "data:image/png;base64,front" }
    },
    activeItemImageUuid: "item-image-1",
    itemImages: [
      {
        itemImageUuid: "item-image-1",
        parentItemUuid: "item-uuid-1",
        order: 0,
        canonicalAsset: {
          assetUuid: "asset-1",
          kind: "canonical",
          parentItemImageUuid: "item-image-1",
          order: 0,
          imageUrl: "data:image/png;base64,front",
          images: {
            original: { src: "" },
            preview: { src: "data:image/png;base64,front" },
            thumbnail: { src: "data:image/png;base64,front" }
          }
        },
        derivedAssets: [],
        activeImageAssetUuid: "asset-1"
      }
    ]
  };
}

test("wardrobe item image draft helpers append images without changing the active image", () => {
  const currentDraft = createBaseDraft();
  const addedImage = createImportedWardrobeItemImage({
    parentItemUuid: "item-uuid-1",
    order: 1,
    imageUrl: "data:image/png;base64,back",
    importMetadata: {
      importedAt: "2024-06-01T00:00:00.000Z",
      sourceOriginalFilename: "back.png"
    }
  });

  const added = addWardrobeItemImagesToDraft(currentDraft, [addedImage]);

  assert.equal(added.itemImages.length, 2);
  assert.equal(added.activeItemImageUuid, "item-image-1");
  assert.equal(added.imageUrl, "data:image/png;base64,front");
  assert.equal(added.itemImages[1].canonicalAsset.imageUrl, "data:image/png;base64,back");
  assert.equal(added.itemImages[1].activeImageAssetUuid, added.itemImages[1].canonicalAsset.assetUuid);
  assert.deepEqual(added.itemImages[1].derivedAssets, []);
});

test("wardrobe item image draft helpers cannot remove the final remaining image", () => {
  const currentDraft = createBaseDraft();
  const unchanged = removeWardrobeItemImageFromDraft(currentDraft, "item-image-1");

  assert.deepEqual(unchanged, currentDraft);
});

test("wardrobe item image draft helpers remove the active image and promote the first remaining image", () => {
  const currentDraft = addWardrobeItemImagesToDraft(createBaseDraft(), [
    createImportedWardrobeItemImage({
      parentItemUuid: "item-uuid-1",
      order: 1,
      imageUrl: "data:image/png;base64,back"
    })
  ]);

  const removed = removeWardrobeItemImageFromDraft(currentDraft, "item-image-1");

  assert.equal(removed.itemImages.length, 1);
  assert.equal(removed.activeItemImageUuid, removed.itemImages[0].itemImageUuid);
  assert.equal(removed.imageUrl, "data:image/png;base64,back");
});

test("wardrobe item image draft helpers remove inactive images without changing the active image", () => {
  const currentDraft = addWardrobeItemImagesToDraft(createBaseDraft(), [
    createImportedWardrobeItemImage({
      parentItemUuid: "item-uuid-1",
      order: 1,
      imageUrl: "data:image/png;base64,back"
    })
  ]);

  const inactiveImageUuid = currentDraft.itemImages[1].itemImageUuid;
  const removed = removeWardrobeItemImageFromDraft(currentDraft, inactiveImageUuid);

  assert.equal(removed.itemImages.length, 1);
  assert.equal(removed.activeItemImageUuid, "item-image-1");
  assert.equal(removed.imageUrl, "data:image/png;base64,front");
});

test("wardrobe item image draft helpers move images while preserving UUID stability and active identity", () => {
  const appended = addWardrobeItemImagesToDraft(createBaseDraft(), [
    createImportedWardrobeItemImage({
      parentItemUuid: "item-uuid-1",
      order: 1,
      imageUrl: "data:image/png;base64,back"
    }),
    createImportedWardrobeItemImage({
      parentItemUuid: "item-uuid-1",
      order: 2,
      imageUrl: "data:image/png;base64,detail"
    })
  ]);
  const movedImageUuid = appended.itemImages[1].itemImageUuid;
  const moved = moveWardrobeItemImageInDraft(appended, movedImageUuid, "down");

  assert.deepEqual(
    moved.itemImages.map((itemImage) => ({
      itemImageUuid: itemImage.itemImageUuid,
      order: itemImage.order
    })),
    [
      { itemImageUuid: "item-image-1", order: 0 },
      { itemImageUuid: appended.itemImages[2].itemImageUuid, order: 1 },
      { itemImageUuid: movedImageUuid, order: 2 }
    ]
  );
  assert.equal(moved.activeItemImageUuid, "item-image-1");
});

test("wardrobe item image draft helpers set the active image and mirror legacy aliases", () => {
  const appended = addWardrobeItemImagesToDraft(createBaseDraft(), [
    createImportedWardrobeItemImage({
      parentItemUuid: "item-uuid-1",
      order: 1,
      imageUrl: "data:image/png;base64,back"
    })
  ]);
  const nextActiveItemImageUuid = appended.itemImages[1].itemImageUuid;
  const updated = setActiveWardrobeItemImageInDraft(appended, nextActiveItemImageUuid);

  assert.equal(updated.activeItemImageUuid, nextActiveItemImageUuid);
  assert.equal(updated.imageUrl, "data:image/png;base64,back");
  assert.equal(updated.images.preview.src, "data:image/png;base64,back");
});

test("wardrobe item image draft helpers replace the active asset without changing active image selection", () => {
  const replaced = replaceActiveWardrobeItemImageAssetInDraft(createBaseDraft(), {
    imageUrl: "data:image/png;base64,cutout",
    images: {
      preview: { src: "data:image/png;base64,cutout" },
      thumbnail: { src: "data:image/png;base64,cutout" }
    }
  });

  assert.equal(replaced.activeItemImageUuid, "item-image-1");
  assert.equal(replaced.imageUrl, "data:image/png;base64,cutout");
  assert.equal(replaced.itemImages[0].canonicalAsset.imageUrl, "data:image/png;base64,cutout");
});
