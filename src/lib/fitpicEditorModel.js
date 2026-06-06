import { buildDisplayName } from "./itemModel.js";

function normalizeDateInputValue(value) {
  const timestamp = typeof value === "string" ? value : "";

  if (!timestamp) {
    return "";
  }

  const parsed = Date.parse(timestamp);

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

export function getFitpicDateInputValue(fitDate) {
  return normalizeDateInputValue(fitDate);
}

export function applyFitpicDateInput(existingFitDate, nextDateInput) {
  const normalizedInput = typeof nextDateInput === "string" ? nextDateInput.trim() : "";

  if (!normalizedInput) {
    return null;
  }

  if (normalizeDateInputValue(existingFitDate) === normalizedInput) {
    return typeof existingFitDate === "string" && existingFitDate.trim() ? existingFitDate : normalizedInput;
  }

  const normalizedExisting = typeof existingFitDate === "string" ? existingFitDate.trim() : "";
  const timestampMatch = normalizedExisting.match(/^(\d{4}-\d{2}-\d{2})(T.*)$/);

  if (timestampMatch) {
    return `${normalizedInput}${timestampMatch[2]}`;
  }

  return normalizedInput;
}

export function resolveFitpicLinkedItems(linkedItemUuids = [], linkedItemIds = [], items = []) {
  const itemsByUuid = new Map(
    items
      .filter((item) => typeof item?.itemUuid === "string" && item.itemUuid.trim())
      .map((item) => [item.itemUuid, item])
  );
  const itemsById = new Map(
    items
      .filter((item) => typeof item?.id === "string" && item.id.trim())
      .map((item) => [item.id, item])
  );
  const seenItems = new Set();
  const entries = [];

  linkedItemUuids.forEach((itemUuid) => {
    const normalizedUuid = typeof itemUuid === "string" ? itemUuid.trim() : "";

    if (!normalizedUuid) {
      return;
    }

    const item = itemsByUuid.get(normalizedUuid) ?? null;

    if (item) {
      if (seenItems.has(item.id)) {
        return;
      }

      seenItems.add(item.id);
      entries.push({
        key: `uuid:${normalizedUuid}`,
        itemUuid: normalizedUuid,
        itemId: item.id,
        item,
        label: buildDisplayName(item),
        missing: false
      });
      return;
    }

    entries.push({
      key: `uuid:${normalizedUuid}`,
      itemUuid: normalizedUuid,
      itemId: null,
      item: null,
      label: "Missing wardrobe item",
      missing: true
    });
  });

  linkedItemIds.forEach((itemId) => {
    const normalizedId = typeof itemId === "string" ? itemId.trim() : "";

    if (!normalizedId) {
      return;
    }

    const item = itemsById.get(normalizedId) ?? null;

    if (item) {
      if (seenItems.has(item.id)) {
        return;
      }

      seenItems.add(item.id);
      entries.push({
        key: `id:${normalizedId}`,
        itemUuid: item.itemUuid ?? null,
        itemId: normalizedId,
        item,
        label: buildDisplayName(item),
        missing: false
      });
      return;
    }

    entries.push({
      key: `id:${normalizedId}`,
      itemUuid: null,
      itemId: normalizedId,
      item: null,
      label: "Missing wardrobe item",
      missing: true
    });
  });

  return entries;
}

export function addLinkedItemToFitpicDraft(currentDraft, item) {
  const itemUuid = typeof item?.itemUuid === "string" ? item.itemUuid.trim() : "";
  const itemId = typeof item?.id === "string" ? item.id.trim() : "";

  if (!itemUuid && !itemId) {
    return currentDraft;
  }

  const nextLinkedItemUuids = Array.isArray(currentDraft?.linkedItemUuids) ? [...currentDraft.linkedItemUuids] : [];
  const nextLinkedItemIds = Array.isArray(currentDraft?.linkedItemIds) ? [...currentDraft.linkedItemIds] : [];

  if (itemUuid && !nextLinkedItemUuids.includes(itemUuid)) {
    nextLinkedItemUuids.push(itemUuid);
  }

  if (itemId && !nextLinkedItemIds.includes(itemId)) {
    nextLinkedItemIds.push(itemId);
  }

  return {
    ...currentDraft,
    linkedItemUuids: nextLinkedItemUuids,
    linkedItemIds: nextLinkedItemIds
  };
}

export function removeLinkedItemFromFitpicDraft(currentDraft, { itemUuid = null, itemId = null } = {}) {
  return {
    ...currentDraft,
    linkedItemUuids: (Array.isArray(currentDraft?.linkedItemUuids) ? currentDraft.linkedItemUuids : [])
      .filter((value) => value !== itemUuid),
    linkedItemIds: (Array.isArray(currentDraft?.linkedItemIds) ? currentDraft.linkedItemIds : [])
      .filter((value) => value !== itemId)
  };
}
