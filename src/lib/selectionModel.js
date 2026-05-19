function getUniqueIds(ids) {
  const seen = new Set();

  return (ids ?? []).filter((id) => {
    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

export function getSelectionRangeIds(orderedIds, startId, endId) {
  const startIndex = orderedIds.indexOf(startId);
  const endIndex = orderedIds.indexOf(endId);

  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const [fromIndex, toIndex] = startIndex <= endIndex
    ? [startIndex, endIndex]
    : [endIndex, startIndex];

  return orderedIds.slice(fromIndex, toIndex + 1);
}

export function pruneSelectedIds(selectedIds, validIds) {
  const validIdSet = new Set(validIds);
  return getUniqueIds(selectedIds).filter((id) => validIdSet.has(id));
}

export function getNextSelectionState({
  selectedIds,
  orderedIds,
  clickedId,
  anchorId,
  shiftKey = false,
  toggleKey = false
}) {
  if (!clickedId) {
    return {
      selectedIds: getUniqueIds(selectedIds),
      anchorId: anchorId ?? null
    };
  }

  const currentSelection = new Set(getUniqueIds(selectedIds));
  const rangeIds = shiftKey && anchorId
    ? getSelectionRangeIds(orderedIds, anchorId, clickedId)
    : [];

  if (shiftKey && rangeIds.length) {
    if (toggleKey) {
      rangeIds.forEach((id) => {
        if (currentSelection.has(id)) {
          currentSelection.delete(id);
        } else {
          currentSelection.add(id);
        }
      });

      return {
        selectedIds: getUniqueIds([...orderedIds.filter((id) => currentSelection.has(id)), ...currentSelection]),
        anchorId: clickedId
      };
    }

    return {
      selectedIds: rangeIds,
      anchorId
    };
  }

  if (toggleKey) {
    if (currentSelection.has(clickedId)) {
      currentSelection.delete(clickedId);
    } else {
      currentSelection.add(clickedId);
    }

    return {
      selectedIds: getUniqueIds([...orderedIds.filter((id) => currentSelection.has(id)), ...currentSelection]),
      anchorId: clickedId
    };
  }

  return {
    selectedIds: [clickedId],
    anchorId: clickedId
  };
}
