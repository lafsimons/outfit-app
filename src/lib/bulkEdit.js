import { normalizeCollections } from "./itemModel.js";
import { normalizeStatus, normalizeTagList } from "./typeDefaults.js";

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

export function setItemStatus(item, status) {
  const normalizedStatus = normalizeStatus(status);

  return {
    ...item,
    status: normalizedStatus,
    list: normalizedStatus
  };
}

export function addCollectionToItem(item, collection) {
  return {
    ...item,
    collections: normalizeCollections([...(Array.isArray(item?.collections) ? item.collections : []), collection])
  };
}

export function removeCollectionFromItem(item, collection) {
  return {
    ...item,
    collections: normalizeCollections(item?.collections).filter((existingCollection) => existingCollection !== collection)
  };
}

export function clearItemCollections(item) {
  return {
    ...item,
    collections: []
  };
}

export function addTagToItemTags(tags, tag, allowedOptions) {
  return normalizeTagList([...(Array.isArray(tags) ? tags : []), tag], allowedOptions);
}

export function removeTagFromItemTags(tags, tag, allowedOptions) {
  return normalizeTagList(tags, allowedOptions).filter((existingTag) => existingTag !== tag);
}
