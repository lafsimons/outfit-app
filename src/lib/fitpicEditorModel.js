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
  const maxLength = Math.max(linkedItemUuids.length, linkedItemIds.length);

  for (let index = 0; index < maxLength; index += 1) {
    const normalizedUuid = typeof linkedItemUuids[index] === "string" ? linkedItemUuids[index].trim() : "";
    const normalizedId = typeof linkedItemIds[index] === "string" ? linkedItemIds[index].trim() : "";

    if (!normalizedUuid && !normalizedId) {
      continue;
    }

    const uuidItem = normalizedUuid ? itemsByUuid.get(normalizedUuid) ?? null : null;

    if (uuidItem) {
      if (!seenItems.has(uuidItem.id)) {
        seenItems.add(uuidItem.id);
        entries.push({
          key: `uuid:${normalizedUuid}`,
          itemUuid: normalizedUuid,
          itemId: uuidItem.id,
          item: uuidItem,
          label: buildDisplayName(uuidItem),
          missing: false
        });
      }

      continue;
    }

    if (normalizedUuid) {
      entries.push({
        key: `uuid:${normalizedUuid}`,
        itemUuid: normalizedUuid,
        itemId: null,
        item: null,
        label: "Missing wardrobe item",
        missing: true
      });
      continue;
    }

    const idItem = normalizedId ? itemsById.get(normalizedId) ?? null : null;

    if (idItem) {
      if (!seenItems.has(idItem.id)) {
        seenItems.add(idItem.id);
        entries.push({
          key: `id:${normalizedId}`,
          itemUuid: idItem.itemUuid ?? null,
          itemId: normalizedId,
          item: idItem,
          label: buildDisplayName(idItem),
          missing: false
        });
      }

      continue;
    }

    entries.push({
      key: `id:${normalizedId}`,
      itemUuid: null,
      itemId: normalizedId,
      item: null,
      label: "Missing wardrobe item",
      missing: true
    });
  }

  return entries;
}

export function syncFitpicLinkedItemSidecars(fitpic, items = []) {
  const linkedItemUuids = Array.isArray(fitpic?.linkedItemUuids) ? fitpic.linkedItemUuids : [];
  const linkedItemIds = Array.isArray(fitpic?.linkedItemIds) ? fitpic.linkedItemIds : [];
  const itemsByUuid = new Map(
    items
      .filter((item) => typeof item?.itemUuid === "string" && item.itemUuid.trim())
      .map((item) => [item.itemUuid, item])
  );
  const nextLinkedItemIds = [...linkedItemIds];

  linkedItemUuids.forEach((itemUuid, index) => {
    const normalizedUuid = typeof itemUuid === "string" ? itemUuid.trim() : "";

    if (!normalizedUuid) {
      return;
    }

    const item = itemsByUuid.get(normalizedUuid) ?? null;

    if (item?.id) {
      nextLinkedItemIds[index] = item.id;
    }
  });

  if (JSON.stringify(nextLinkedItemIds) === JSON.stringify(linkedItemIds)) {
    return fitpic;
  }

  return {
    ...fitpic,
    linkedItemIds: nextLinkedItemIds
  };
}

export function addLinkedItemToFitpicDraft(currentDraft, item) {
  const itemUuid = typeof item?.itemUuid === "string" ? item.itemUuid.trim() : "";
  const itemId = typeof item?.id === "string" ? item.id.trim() : "";

  if (!itemUuid && !itemId) {
    return currentDraft;
  }

  const nextLinkedItemUuids = Array.isArray(currentDraft?.linkedItemUuids) ? [...currentDraft.linkedItemUuids] : [];
  const nextLinkedItemIds = Array.isArray(currentDraft?.linkedItemIds) ? [...currentDraft.linkedItemIds] : [];

  if (itemUuid) {
    const existingIndex = nextLinkedItemUuids.indexOf(itemUuid);

    if (existingIndex === -1) {
      nextLinkedItemUuids.push(itemUuid);
      nextLinkedItemIds.push(itemId || "");
    } else if (itemId) {
      nextLinkedItemIds[existingIndex] = itemId;
    }

    return {
      ...currentDraft,
      linkedItemUuids: nextLinkedItemUuids,
      linkedItemIds: nextLinkedItemIds
    };
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
  const linkedItemUuids = Array.isArray(currentDraft?.linkedItemUuids) ? currentDraft.linkedItemUuids : [];
  const linkedItemIds = Array.isArray(currentDraft?.linkedItemIds) ? currentDraft.linkedItemIds : [];
  const nextLinkedItemUuids = [];
  const nextLinkedItemIds = [];
  const maxLength = Math.max(linkedItemUuids.length, linkedItemIds.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentUuid = linkedItemUuids[index] ?? null;
    const currentId = linkedItemIds[index] ?? null;
    const matchesUuid = itemUuid !== null && currentUuid === itemUuid;
    const matchesId = itemId !== null && currentId === itemId;

    if (matchesUuid || matchesId) {
      continue;
    }

    if (currentUuid !== undefined) {
      nextLinkedItemUuids.push(currentUuid);
    }

    if (currentId !== undefined) {
      nextLinkedItemIds.push(currentId);
    }
  }

  return {
    ...currentDraft,
    linkedItemUuids: nextLinkedItemUuids,
    linkedItemIds: nextLinkedItemIds
  };
}

function normalizeDraftTags(tags = []) {
  const seen = new Set();
  const normalizedTags = [];

  tags.forEach((tag) => {
    const normalizedTag = typeof tag === "string" ? tag.trim() : "";
    const normalizedKey = normalizedTag.toLowerCase();

    if (!normalizedTag || seen.has(normalizedKey)) {
      return;
    }

    seen.add(normalizedKey);
    normalizedTags.push(normalizedTag);
  });

  return normalizedTags;
}

export function addFitpicTagsToDraft(currentDraft, rawValue) {
  const incomingTags = String(rawValue ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!incomingTags.length) {
    return currentDraft;
  }

  return {
    ...currentDraft,
    tags: normalizeDraftTags([...(Array.isArray(currentDraft?.tags) ? currentDraft.tags : []), ...incomingTags]),
    tagInput: ""
  };
}

export function removeFitpicTagFromDraft(currentDraft, tagToRemove) {
  const normalizedRemoveKey = typeof tagToRemove === "string" ? tagToRemove.trim().toLowerCase() : "";

  if (!normalizedRemoveKey) {
    return currentDraft;
  }

  return {
    ...currentDraft,
    tags: normalizeDraftTags(
      (Array.isArray(currentDraft?.tags) ? currentDraft.tags : []).filter(
        (tag) => tag.trim().toLowerCase() !== normalizedRemoveKey
      )
    )
  };
}
