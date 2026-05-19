import { normalizeTagList } from "./typeDefaults.js";

function omitUpdatedAt(item) {
  const { updatedAt, ...rest } = item ?? {};
  return rest;
}

export function hasMeaningfulItemChange(originalItem, nextItem) {
  return JSON.stringify(omitUpdatedAt(originalItem)) !== JSON.stringify(omitUpdatedAt(nextItem));
}

export function updateSelectedItems(items, selectedIds, updater) {
  const selectedIdSet = new Set(selectedIds);
  const changedItems = [];
  const changedIds = [];

  const nextItems = items.map((item) => {
    if (!selectedIdSet.has(item.id)) {
      return item;
    }

    const nextItem = updater(item);

    if (nextItem === item) {
      return item;
    }

    changedItems.push(nextItem);
    changedIds.push(item.id);
    return nextItem;
  });

  return {
    nextItems,
    changedItems,
    changedIds
  };
}

export function removeSelectedItems(items, selectedIds) {
  const selectedIdSet = new Set(selectedIds);
  const removedIds = items.filter((item) => selectedIdSet.has(item.id)).map((item) => item.id);

  return {
    nextItems: items.filter((item) => !selectedIdSet.has(item.id)),
    removedIds
  };
}

export function addTagToItemTags(tags, tag, allowedOptions) {
  return normalizeTagList([...(Array.isArray(tags) ? tags : []), tag], allowedOptions);
}

export function removeTagFromItemTags(tags, tag, allowedOptions) {
  return normalizeTagList(tags, allowedOptions).filter((existingTag) => existingTag !== tag);
}
