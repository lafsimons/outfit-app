import { normalizeCollections } from "./itemModel.js";
import { normalizeStatus } from "./typeDefaults.js";
import { getExcludedFilterKey } from "./wardrobeLibrary.js";
import { resolveFitpicLinkedItems } from "./fitpicEditorModel.js";

export const fitpicMultiValueFilterKeys = [
  "tags",
  "linkedItem",
  "brand",
  "garmentType",
  "type",
  "status",
  "collections"
];

export const fitpicExcludedMultiValueFilterKeys = fitpicMultiValueFilterKeys.map(getExcludedFilterKey);
export const fitpicTagFamilyOrder = [
  "season",
  "brand",
  "source",
  "subject",
  "medium",
  "platform",
  "publisher",
  "project",
  "event",
  "collab"
];

export const emptyFitpicFilters = {
  tags: [],
  tagsExcluded: [],
  linkedItem: [],
  linkedItemExcluded: [],
  brand: [],
  brandExcluded: [],
  garmentType: [],
  garmentTypeExcluded: [],
  type: [],
  typeExcluded: [],
  status: [],
  statusExcluded: [],
  collections: [],
  collectionsExcluded: [],
  favorite: ""
};

function normalizeSearchText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeFilterToken(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUniqueFilterValues(values, normalizeValue = (value) => value) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();

  return values.reduce((normalized, value) => {
    const nextValue = normalizeValue(normalizeFilterToken(value));

    if (!nextValue || seen.has(nextValue)) {
      return normalized;
    }

    seen.add(nextValue);
    normalized.push(nextValue);
    return normalized;
  }, []);
}

function normalizeLegacyOrMultiValue(value, normalizeValue = (entry) => entry) {
  if (Array.isArray(value)) {
    return normalizeUniqueFilterValues(value, normalizeValue);
  }

  const normalizedToken = normalizeFilterToken(value);

  if (!normalizedToken) {
    return [];
  }

  const normalizedValue = normalizeValue(normalizedToken);
  return normalizedValue ? [normalizedValue] : [];
}

function normalizeStatusFilterValue(value) {
  return value === "__none__" ? value : normalizeStatus(value);
}

function normalizeFilterDimensions(filters, key, normalizeValue = (entry) => entry) {
  return {
    [key]: normalizeLegacyOrMultiValue(filters[key], normalizeValue),
    [getExcludedFilterKey(key)]: normalizeLegacyOrMultiValue(filters[getExcludedFilterKey(key)], normalizeValue)
  };
}

function getTimestamp(value) {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFitpicDisplayTimestamp(fitpic, field) {
  if (field === "fitDate") {
    return getTimestamp(fitpic?.fitDate) || getTimestamp(fitpic?.createdAt);
  }

  if (field === "createdAt") {
    return getTimestamp(fitpic?.createdAt);
  }

  return getTimestamp(fitpic?.importedAt) || getTimestamp(fitpic?.createdAt);
}

export function buildFitpicSearchText(fitpic, items = []) {
  return [
    fitpic?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getResolvedLinkedItems(fitpic, items = []) {
  return resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items)
    .filter((entry) => !entry.missing && entry.item)
    .map((entry) => entry.item);
}

function getResolvedLinkedItemLabels(fitpic, items = []) {
  return resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items)
    .filter((entry) => !entry.missing)
    .map((entry) => entry.label);
}

function getFitpicFilterValues(fitpic, key, items = []) {
  if (key === "tags") {
    return normalizeUniqueFilterValues(Array.isArray(fitpic?.tags) ? fitpic.tags : []);
  }

  if (key === "linkedItem") {
    return normalizeUniqueFilterValues(getResolvedLinkedItemLabels(fitpic, items));
  }

  const linkedItems = getResolvedLinkedItems(fitpic, items);

  if (key === "collections") {
    return normalizeUniqueFilterValues(linkedItems.flatMap((item) => normalizeCollections(item.collections)));
  }

  if (key === "status") {
    return normalizeUniqueFilterValues(
      linkedItems.map((item) => normalizeStatus(item.status ?? item.list)),
      normalizeStatusFilterValue
    );
  }

  return normalizeUniqueFilterValues(linkedItems.map((item) => item?.[key]));
}

function matchesIncludedValues(values, selectedValues) {
  if (!selectedValues.length) {
    return true;
  }

  return selectedValues.some((selectedValue) => {
    if (selectedValue === "__none__") {
      return values.length === 0;
    }

    return values.includes(selectedValue);
  });
}

function matchesExcludedValues(values, excludedValues) {
  if (!excludedValues.length) {
    return true;
  }

  return excludedValues.every((excludedValue) => {
    if (excludedValue === "__none__") {
      return values.length > 0;
    }

    return !values.includes(excludedValue);
  });
}

function matchesFitpicMultiFilterDimension(fitpic, filters, key, items, ignored) {
  if (ignored.has(key)) {
    return true;
  }

  const values = getFitpicFilterValues(fitpic, key, items);
  return (
    matchesIncludedValues(values, filters[key] ?? [])
    && matchesExcludedValues(values, filters[getExcludedFilterKey(key)] ?? [])
  );
}

export function normalizeFitpicFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return { ...emptyFitpicFilters };
  }

  return {
    ...normalizeFilterDimensions(filters, "tags"),
    ...normalizeFilterDimensions(filters, "linkedItem"),
    ...normalizeFilterDimensions(filters, "brand"),
    ...normalizeFilterDimensions(filters, "garmentType"),
    ...normalizeFilterDimensions(filters, "type"),
    ...normalizeFilterDimensions(filters, "status", normalizeStatusFilterValue),
    ...normalizeFilterDimensions(filters, "collections"),
    favorite: normalizeFilterToken(filters.favorite)
  };
}

export function matchesFitpicFilters(fitpic, filters, items = [], ignoredKeys = []) {
  const normalizedFilters = normalizeFitpicFilters(filters);
  const ignored = new Set(ignoredKeys);
  const linkedItems = getResolvedLinkedItems(fitpic, items);

  return (
    fitpicMultiValueFilterKeys.every((key) => matchesFitpicMultiFilterDimension(fitpic, normalizedFilters, key, items, ignored))
    && (
      ignored.has("favorite")
      || !normalizedFilters.favorite
      || (
        normalizedFilters.favorite === "yes"
          ? linkedItems.some((item) => Boolean(item.favorite))
          : linkedItems.length > 0 && linkedItems.every((item) => !item.favorite)
      )
    )
  );
}

function mergeSelected(options, ...selectedGroups) {
  return [...new Set([...options, ...selectedGroups.flat()])].sort((left, right) => left.localeCompare(right));
}

function getTagFamilySortIndex(family) {
  const index = fitpicTagFamilyOrder.indexOf(family);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function getFitpicTagFilterGroups(tags = []) {
  const grouped = new Map();

  tags.forEach((tag) => {
    const normalizedTag = normalizeFilterToken(tag);

    if (!normalizedTag) {
      return;
    }

    const separatorIndex = normalizedTag.indexOf("/");
    const family = separatorIndex === -1 ? "other" : normalizedTag.slice(0, separatorIndex).trim().toLowerCase();
    const valueLabel = separatorIndex === -1 ? normalizedTag : normalizedTag.slice(separatorIndex + 1).trim();
    const familyLabel = family === "other" ? "other" : family;
    const nextEntry = {
      value: normalizedTag,
      label: valueLabel || normalizedTag,
      fullLabel: normalizedTag
    };

    if (!grouped.has(familyLabel)) {
      grouped.set(familyLabel, []);
    }

    grouped.get(familyLabel).push(nextEntry);
  });

  return [...grouped.entries()]
    .sort(([leftFamily], [rightFamily]) => (
      getTagFamilySortIndex(leftFamily) - getTagFamilySortIndex(rightFamily)
      || leftFamily.localeCompare(rightFamily)
    ))
    .map(([family, options]) => ({
      family,
      label: family === "other" ? "Other" : family,
      options: options.sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value))
    }));
}

export function getFitpicFilterOptions(fitpics = [], items = [], filters = emptyFitpicFilters) {
  const normalizedFilters = normalizeFitpicFilters(filters);
  const getFitpicsForKey = (key) => fitpics.filter((fitpic) => matchesFitpicFilters(fitpic, normalizedFilters, items, [key]));
  const getUniqueValues = (sourceFitpics, key) =>
    [...new Set(sourceFitpics.flatMap((fitpic) => getFitpicFilterValues(fitpic, key, items)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));

  return {
    tags: mergeSelected(getUniqueValues(getFitpicsForKey("tags"), "tags"), normalizedFilters.tags, normalizedFilters.tagsExcluded),
    linkedItem: mergeSelected(
      getUniqueValues(getFitpicsForKey("linkedItem"), "linkedItem"),
      normalizedFilters.linkedItem,
      normalizedFilters.linkedItemExcluded
    ),
    brand: mergeSelected(getUniqueValues(getFitpicsForKey("brand"), "brand"), normalizedFilters.brand, normalizedFilters.brandExcluded),
    garmentType: mergeSelected(
      getUniqueValues(getFitpicsForKey("garmentType"), "garmentType"),
      normalizedFilters.garmentType,
      normalizedFilters.garmentTypeExcluded
    ),
    type: mergeSelected(getUniqueValues(getFitpicsForKey("type"), "type"), normalizedFilters.type, normalizedFilters.typeExcluded),
    status: mergeSelected(getUniqueValues(getFitpicsForKey("status"), "status"), normalizedFilters.status, normalizedFilters.statusExcluded),
    collections: mergeSelected(
      getUniqueValues(getFitpicsForKey("collections"), "collections"),
      normalizedFilters.collections,
      normalizedFilters.collectionsExcluded
    )
  };
}

export function getFitpicLinkedItemFilterOptions(fitpics = [], items = []) {
  const options = [];
  const seen = new Set();

  fitpics.forEach((fitpic) => {
    resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items)
      .filter((entry) => !entry.missing)
      .forEach((entry) => {
        const value = entry.itemUuid ? `uuid:${entry.itemUuid}` : entry.itemId ? `id:${entry.itemId}` : "";

        if (!value || seen.has(value)) {
          return;
        }

        seen.add(value);
        options.push({
          value,
          label: entry.label
        });
      });
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function fitpicMatchesLinkedItemFilter(fitpic, filterValue, items = []) {
  const normalizedFilter = typeof filterValue === "string" ? filterValue.trim() : "";

  if (!normalizedFilter) {
    return true;
  }

  return resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items)
    .some((entry) =>
      !entry.missing && (
        (entry.itemUuid && normalizedFilter === `uuid:${entry.itemUuid}`)
        || (entry.itemId && normalizedFilter === `id:${entry.itemId}`)
      )
    );
}

export function getFitpicPreviewNavigation(visibleFitpicIds = [], currentFitpicId) {
  const orderedIds = Array.isArray(visibleFitpicIds) ? visibleFitpicIds.filter(Boolean) : [];
  const currentIndex = orderedIds.indexOf(currentFitpicId);

  if (currentIndex === -1) {
    return {
      currentIndex: -1,
      totalCount: orderedIds.length,
      previousFitpicId: null,
      nextFitpicId: null
    };
  }

  return {
    currentIndex,
    totalCount: orderedIds.length,
    previousFitpicId: orderedIds[currentIndex - 1] ?? null,
    nextFitpicId: orderedIds[currentIndex + 1] ?? null
  };
}

export function getFitpicPreviewDirectionForKey(eventLike) {
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

export function filterAndSortFitpics(
  fitpics = [],
  {
    search = "",
    filters = emptyFitpicFilters,
    sort = "fitDateNewest"
  } = {},
  items = []
) {
  const normalizedSearch = normalizeSearchText(search);
  const normalizedFilters = normalizeFitpicFilters(filters);
  const filtered = fitpics.filter((fitpic) => {
    if (!matchesFitpicFilters(fitpic, normalizedFilters, items)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return buildFitpicSearchText(fitpic, items).includes(normalizedSearch);
  });

  const sorted = [...filtered];

  sorted.sort((left, right) => {
    if (sort === "titleAz") {
      return (left?.name || "").localeCompare(right?.name || "");
    }

    if (sort === "fitDateOldest") {
      return getFitpicDisplayTimestamp(left, "fitDate") - getFitpicDisplayTimestamp(right, "fitDate");
    }

    if (sort === "createdNewest") {
      return getFitpicDisplayTimestamp(right, "createdAt") - getFitpicDisplayTimestamp(left, "createdAt");
    }

    if (sort === "importedNewest") {
      return getFitpicDisplayTimestamp(right, "importedAt") - getFitpicDisplayTimestamp(left, "importedAt");
    }

    return getFitpicDisplayTimestamp(right, "fitDate") - getFitpicDisplayTimestamp(left, "fitDate");
  });

  return sorted;
}
