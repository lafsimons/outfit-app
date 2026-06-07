function getWrappedIndex(length, index) {
  if (!Number.isInteger(length) || length <= 0) {
    return -1;
  }

  return ((index % length) + length) % length;
}

export function getWardrobePreviewNavigation(visibleItemIds, currentItemId) {
  const orderedIds = Array.isArray(visibleItemIds) ? visibleItemIds.filter(Boolean) : [];
  const currentIndex = orderedIds.indexOf(currentItemId);

  if (currentIndex === -1) {
    return {
      currentIndex: -1,
      totalCount: orderedIds.length,
      previousItemId: null,
      nextItemId: null
    };
  }

  return {
    currentIndex,
    totalCount: orderedIds.length,
    previousItemId: orderedIds[getWrappedIndex(orderedIds.length, currentIndex - 1)] ?? null,
    nextItemId: orderedIds[getWrappedIndex(orderedIds.length, currentIndex + 1)] ?? null
  };
}

export function getWardrobePreviewImageNavigation(itemImages, currentItemImageUuid) {
  const orderedImages = Array.isArray(itemImages)
    ? itemImages.filter(
        (itemImage) => typeof itemImage?.itemImageUuid === "string" && itemImage.itemImageUuid.trim()
      )
    : [];

  if (!orderedImages.length) {
    return {
      currentIndex: -1,
      totalCount: 0,
      currentItemImage: null,
      previousItemImageUuid: null,
      nextItemImageUuid: null,
      showCarousel: false
    };
  }

  const normalizedCurrentItemImageUuid = typeof currentItemImageUuid === "string" ? currentItemImageUuid.trim() : "";
  const resolvedCurrentIndex = orderedImages.findIndex(
    (itemImage) => itemImage.itemImageUuid === normalizedCurrentItemImageUuid
  );
  const currentIndex = resolvedCurrentIndex >= 0 ? resolvedCurrentIndex : 0;
  const showCarousel = orderedImages.length > 1;

  return {
    currentIndex,
    totalCount: orderedImages.length,
    currentItemImage: orderedImages[currentIndex] ?? null,
    previousItemImageUuid: showCarousel
      ? orderedImages[getWrappedIndex(orderedImages.length, currentIndex - 1)]?.itemImageUuid ?? null
      : null,
    nextItemImageUuid: showCarousel
      ? orderedImages[getWrappedIndex(orderedImages.length, currentIndex + 1)]?.itemImageUuid ?? null
      : null,
    showCarousel
  };
}

export function getWardrobePreviewDirectionForKey(eventLike) {
  if (!eventLike || eventLike.altKey || eventLike.ctrlKey || eventLike.metaKey || eventLike.shiftKey) {
    return null;
  }

  if (eventLike.key === "ArrowLeft") {
    return "previous";
  }

  if (eventLike.key === "ArrowRight") {
    return "next";
  }

  return null;
}
