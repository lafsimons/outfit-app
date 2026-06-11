import { normalizeCollections } from "./itemModel.js";
import { normalizeTagList } from "./typeDefaults.js";

export function toggleItemEditorDraftTag(currentDraft, field, value, options) {
  const selectedValues = normalizeTagList(currentDraft?.[field], options);
  const isSelected = selectedValues.includes(value);

  return {
    ...currentDraft,
    [field]: isSelected
      ? selectedValues.filter((selectedValue) => selectedValue !== value)
      : [...selectedValues, value]
  };
}

export function addItemEditorDraftCollection(currentDraft, collection) {
  return {
    ...currentDraft,
    collections: normalizeCollections([
      ...(Array.isArray(currentDraft?.collections) ? currentDraft.collections : []),
      collection
    ])
  };
}

export function removeItemEditorDraftCollection(currentDraft, collectionToRemove) {
  return {
    ...currentDraft,
    collections: normalizeCollections(currentDraft?.collections).filter(
      (collection) => collection !== collectionToRemove
    )
  };
}

export function patchOpenItemEditorDraft(currentDraft, itemId, patch) {
  if (!currentDraft || currentDraft.id !== itemId) {
    return currentDraft;
  }

  return {
    ...currentDraft,
    ...patch
  };
}
