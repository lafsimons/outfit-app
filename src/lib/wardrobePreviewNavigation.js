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
