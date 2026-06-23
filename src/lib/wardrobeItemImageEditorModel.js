import {
  getActiveWardrobeItemImage,
  getActiveWardrobeItemImageAsset,
  getWardrobeItemImages,
  mirrorActiveWardrobeImageAssetToLegacyAliases,
  normalizeWardrobeItemImage
} from "./itemModel.js";

function createDraftWardrobeImageUuid(prefix) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDraftWardrobeImages(itemImages = []) {
  return itemImages.map((itemImage, index) => ({
    ...itemImage,
    order: index
  }));
}

function mirrorDraft(currentDraft, updates = {}) {
  return mirrorActiveWardrobeImageAssetToLegacyAliases({
    ...currentDraft,
    ...updates
  });
}

export function createImportedWardrobeItemImage(
  {
    parentItemUuid,
    order = 0,
    imageUrl = "",
    images,
    importMetadata = {},
    originalPreserved = false,
    archivalOriginalPreserved = false
  } = {}
) {
  const normalizedParentItemUuid = typeof parentItemUuid === "string" ? parentItemUuid.trim() : "";

  if (!normalizedParentItemUuid || !imageUrl) {
    throw new Error("A parent item UUID and image URL are required.");
  }

  const itemImageUuid = createDraftWardrobeImageUuid("item-image");
  const assetUuid = createDraftWardrobeImageUuid("image-asset");

  return normalizeWardrobeItemImage(
    {
      itemImageUuid,
      parentItemUuid: normalizedParentItemUuid,
      order,
      canonicalAsset: {
        ...importMetadata,
        assetUuid,
        kind: "canonical",
        parentItemImageUuid: itemImageUuid,
        order: 0,
        imageUrl,
        originalPreserved,
        archivalOriginalPreserved,
        images: images ?? {
          original: { src: "" },
          display: { src: imageUrl },
          preview: { src: imageUrl },
          thumbnail: { src: imageUrl }
        }
      },
      derivedAssets: [],
      activeImageAssetUuid: assetUuid
    },
    {
      parentItemUuid: normalizedParentItemUuid,
      fallbackOrder: order,
      fallbackImportedAt: importMetadata.importedAt
    }
  );
}

export function addWardrobeItemImagesToDraft(currentDraft, itemImages = []) {
  const currentImages = getWardrobeItemImages(currentDraft);
  const appendedImages = (Array.isArray(itemImages) ? itemImages : []).filter(Boolean);

  if (!appendedImages.length) {
    return currentDraft;
  }

  const nextImages = normalizeDraftWardrobeImages([...currentImages, ...appendedImages]);

  return mirrorDraft(currentDraft, {
    itemImages: nextImages,
    activeItemImageUuid: currentDraft?.activeItemImageUuid || nextImages[0]?.itemImageUuid || null
  });
}

export function removeWardrobeItemImageFromDraft(currentDraft, itemImageUuid) {
  const normalizedItemImageUuid = typeof itemImageUuid === "string" ? itemImageUuid.trim() : "";
  const currentImages = getWardrobeItemImages(currentDraft);

  if (!normalizedItemImageUuid || currentImages.length <= 1) {
    return currentDraft;
  }

  const nextImages = normalizeDraftWardrobeImages(
    currentImages.filter((itemImage) => itemImage.itemImageUuid !== normalizedItemImageUuid)
  );

  if (nextImages.length === currentImages.length) {
    return currentDraft;
  }

  const currentActiveItemImage = getActiveWardrobeItemImage(currentDraft);
  const nextActiveItemImageUuid =
    currentActiveItemImage?.itemImageUuid === normalizedItemImageUuid
      ? nextImages[0]?.itemImageUuid ?? null
      : currentDraft?.activeItemImageUuid || nextImages[0]?.itemImageUuid || null;

  return mirrorDraft(currentDraft, {
    itemImages: nextImages,
    activeItemImageUuid: nextActiveItemImageUuid
  });
}

export function moveWardrobeItemImageInDraft(currentDraft, itemImageUuid, direction) {
  const normalizedItemImageUuid = typeof itemImageUuid === "string" ? itemImageUuid.trim() : "";
  const currentImages = getWardrobeItemImages(currentDraft);
  const currentIndex = currentImages.findIndex((itemImage) => itemImage.itemImageUuid === normalizedItemImageUuid);

  if (currentIndex === -1) {
    return currentDraft;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : direction === "down" ? currentIndex + 1 : currentIndex;

  if (targetIndex < 0 || targetIndex >= currentImages.length || targetIndex === currentIndex) {
    return currentDraft;
  }

  const nextImages = [...currentImages];
  const [movedImage] = nextImages.splice(currentIndex, 1);
  nextImages.splice(targetIndex, 0, movedImage);

  return mirrorDraft(currentDraft, {
    itemImages: normalizeDraftWardrobeImages(nextImages)
  });
}

export function setActiveWardrobeItemImageInDraft(currentDraft, itemImageUuid) {
  const normalizedItemImageUuid = typeof itemImageUuid === "string" ? itemImageUuid.trim() : "";
  const currentImages = getWardrobeItemImages(currentDraft);

  if (!normalizedItemImageUuid || !currentImages.some((itemImage) => itemImage.itemImageUuid === normalizedItemImageUuid)) {
    return currentDraft;
  }

  return mirrorDraft(currentDraft, {
    itemImages: currentImages,
    activeItemImageUuid: normalizedItemImageUuid
  });
}

export function replaceActiveWardrobeItemImageAssetInDraft(
  currentDraft,
  {
    imageUrl,
    images,
    importMetadata = null,
    originalPreserved = null,
    archivalOriginalPreserved = null
  } = {}
) {
    const activeItemImage = getActiveWardrobeItemImage(currentDraft);
    const activeAsset = getActiveWardrobeItemImageAsset(currentDraft);

    if (!activeItemImage || !activeAsset || !imageUrl) {
      return currentDraft;
    }

    const nextImages = getWardrobeItemImages(currentDraft).map((itemImage) => {
      if (itemImage.itemImageUuid !== activeItemImage.itemImageUuid) {
        return itemImage;
      }

        const nextCanonicalAsset = {
          ...itemImage.canonicalAsset,
          ...(importMetadata ?? {}),
          imageUrl,
          originalPreserved:
            typeof originalPreserved === "boolean" ? originalPreserved : itemImage.canonicalAsset.originalPreserved,
          archivalOriginalPreserved:
            typeof archivalOriginalPreserved === "boolean"
              ? archivalOriginalPreserved
              : itemImage.canonicalAsset.archivalOriginalPreserved,
          images: images ?? {
            ...itemImage.canonicalAsset.images,
            display: { src: imageUrl },
          preview: { src: imageUrl },
          thumbnail: { src: imageUrl }
        }
      };
      const nextDerivedAssets = itemImage.derivedAssets.map((asset) =>
        asset.assetUuid === itemImage.activeImageAssetUuid
          ? {
              ...asset,
              ...(importMetadata ?? {}),
              imageUrl,
              originalPreserved: typeof originalPreserved === "boolean" ? originalPreserved : asset.originalPreserved,
              archivalOriginalPreserved:
                typeof archivalOriginalPreserved === "boolean"
                  ? archivalOriginalPreserved
                  : asset.archivalOriginalPreserved,
              images: images ?? {
                ...asset.images,
                display: { src: imageUrl },
                preview: { src: imageUrl },
                thumbnail: { src: imageUrl }
              }
            }
          : asset
      );

      return {
        ...itemImage,
        canonicalAsset:
          itemImage.activeImageAssetUuid === itemImage.canonicalAsset.assetUuid
            ? nextCanonicalAsset
            : itemImage.canonicalAsset,
        derivedAssets: nextDerivedAssets
      };
    });

    return mirrorDraft(currentDraft, {
      itemImages: nextImages
    });
}
