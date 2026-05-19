import { getItemStyleTags } from "./generation.js";
import { getItemSortTimestamp, getNumericValue } from "./itemModel.js";
import { normalizeList } from "./typeDefaults.js";

export const DEFAULT_WARDROBE_SORT = "newest";
export const wardrobeMultiValueFilterKeys = ["brand", "type", "garmentType", "color", "style", "weight", "list"];

export const emptyWardrobeFilters = {
  brand: [],
  type: [],
  garmentType: [],
  color: [],
  style: [],
  laundry: "",
  weight: [],
  list: [],
  favorite: ""
};

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

  const normalizedValue = normalizeValue(normalizeFilterToken(value));
  return normalizedValue ? [normalizedValue] : [];
}

function normalizeListFilterValue(value) {
  return value === "__none__" ? value : normalizeList(value);
}

export function normalizeWardrobeFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return { ...emptyWardrobeFilters };
  }

  return {
    brand: normalizeLegacyOrMultiValue(filters.brand),
    type: normalizeLegacyOrMultiValue(filters.type),
    garmentType: normalizeLegacyOrMultiValue(filters.garmentType),
    color: normalizeLegacyOrMultiValue(filters.color),
    style: normalizeLegacyOrMultiValue(filters.style),
    laundry: normalizeFilterToken(filters.laundry),
    weight: normalizeLegacyOrMultiValue(filters.weight),
    list: normalizeLegacyOrMultiValue(filters.list, normalizeListFilterValue),
    favorite: normalizeFilterToken(filters.favorite)
  };
}

export function normalizeWardrobeSort(value) {
  const allowed = [
    DEFAULT_WARDROBE_SORT,
    "oldest",
    "garmentType",
    "brand",
    "type",
    "value",
    "paidHigh",
    "paidLow",
    "retailHigh",
    "retailLow",
    "color"
  ];

  return allowed.includes(value) ? value : DEFAULT_WARDROBE_SORT;
}

function matchesSelectedMetadataValues(value, selectedValues) {
  if (!selectedValues.length) {
    return true;
  }

  return selectedValues.some((selectedValue) => {
    if (selectedValue === "__none__") {
      return !value;
    }

    return value === selectedValue;
  });
}

export function matchesWardrobeFilters(item, filters, ignoredKeys = []) {
  const normalizedFilters = normalizeWardrobeFilters(filters);
  const ignored = new Set(ignoredKeys);
  const itemStyles = getItemStyleTags(item);

  return (
    (ignored.has("brand") || matchesSelectedMetadataValues(item.brand, normalizedFilters.brand)) &&
    (ignored.has("type") || matchesSelectedMetadataValues(item.type, normalizedFilters.type)) &&
    (ignored.has("garmentType") || matchesSelectedMetadataValues(item.garmentType, normalizedFilters.garmentType)) &&
    (ignored.has("color") || matchesSelectedMetadataValues(item.color, normalizedFilters.color)) &&
    (ignored.has("style") || !normalizedFilters.style.length || normalizedFilters.style.some((style) => itemStyles.includes(style))) &&
    (ignored.has("weight") || matchesSelectedMetadataValues(item.weight, normalizedFilters.weight)) &&
    (ignored.has("list") || !normalizedFilters.list.length || normalizedFilters.list.includes(normalizeList(item.list))) &&
    (ignored.has("favorite") ||
      !normalizedFilters.favorite ||
      (normalizedFilters.favorite === "yes" ? Boolean(item.favorite) : !item.favorite))
  );
}

function normalizeSearchToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getWardrobeSearchText(item) {
  return normalizeSearchToken([
    item.id,
    item.brand,
    item.name,
    item.type,
    item.garmentType,
    item.color,
    item.weight,
    normalizeList(item.list),
    item.description,
    ...(Array.isArray(item.styleTags) ? item.styleTags : []),
    ...(Array.isArray(item.climateTags) ? item.climateTags : [])
  ].join(" "));
}

export function matchesWardrobeSearch(item, searchQuery, precomputedSearchText = "") {
  const normalizedQuery = normalizeSearchToken(searchQuery);

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = precomputedSearchText || getWardrobeSearchText(item);
  return normalizedQuery.split(" ").every((term) => searchableText.includes(term));
}

export function getWardrobeFilterOptions(items, filters, { itemListOptions = [], styleTagOptions = [] } = {}) {
  const normalizedFilters = normalizeWardrobeFilters(filters);
  const getItemsForKey = (key) => items.filter((item) => matchesWardrobeFilters(item, normalizedFilters, [key]));
  const mergeSelected = (options, selectedValues) =>
    [...new Set([...options, ...selectedValues])].sort((left, right) => left.localeCompare(right));
  const getUniqueValues = (sourceItems, key) =>
    [...new Set(sourceItems.map((item) => normalizeFilterToken(item[key])).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  return {
    brand: mergeSelected(getUniqueValues(getItemsForKey("brand"), "brand"), normalizedFilters.brand),
    type: mergeSelected(getUniqueValues(getItemsForKey("type"), "type"), normalizedFilters.type),
    garmentType: mergeSelected(getUniqueValues(getItemsForKey("garmentType"), "garmentType"), normalizedFilters.garmentType),
    color: mergeSelected(getUniqueValues(getItemsForKey("color"), "color"), normalizedFilters.color),
    style: mergeSelected(
      styleTagOptions.filter((style) => getItemsForKey("style").some((item) => getItemStyleTags(item).includes(style))),
      normalizedFilters.style
    ),
    weight: mergeSelected(getUniqueValues(getItemsForKey("weight"), "weight"), normalizedFilters.weight),
    list: mergeSelected(
      itemListOptions.filter((list) => getItemsForKey("list").some((item) => normalizeList(item.list) === list)),
      normalizedFilters.list
    )
  };
}

export function filterWardrobeItems(items, filters, excluded, searchQuery, searchTextById = {}) {
  const normalizedFilters = normalizeWardrobeFilters(filters);

  return items.filter((item) => {
    if (!matchesWardrobeFilters(item, normalizedFilters)) {
      return false;
    }

    if (
      normalizedFilters.laundry &&
      (normalizedFilters.laundry === "show" ? !excluded[item.id] : Boolean(excluded[item.id]))
    ) {
      return false;
    }

    return matchesWardrobeSearch(item, searchQuery, searchTextById[item.id] ?? "");
  });
}

export function sortWardrobeItems(items, wardrobeSort) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (wardrobeSort === "garmentType") {
        return a.item.garmentType.localeCompare(b.item.garmentType) || a.index - b.index;
      }

      if (wardrobeSort === "brand") {
        return (a.item.brand || "").localeCompare(b.item.brand || "") || a.index - b.index;
      }

      if (wardrobeSort === "type") {
        return (a.item.type || "").localeCompare(b.item.type || "") || a.index - b.index;
      }

      if (wardrobeSort === "value" || wardrobeSort === "paidHigh") {
        return getNumericValue(b.item.value) - getNumericValue(a.item.value) || a.index - b.index;
      }

      if (wardrobeSort === "paidLow") {
        return getNumericValue(a.item.value) - getNumericValue(b.item.value) || a.index - b.index;
      }

      if (wardrobeSort === "retailHigh") {
        return getNumericValue(b.item.retailValue) - getNumericValue(a.item.retailValue) || a.index - b.index;
      }

      if (wardrobeSort === "retailLow") {
        return getNumericValue(a.item.retailValue) - getNumericValue(b.item.retailValue) || a.index - b.index;
      }

      if (wardrobeSort === "newest") {
        return getItemSortTimestamp(b.item) - getItemSortTimestamp(a.item) || b.index - a.index;
      }

      if (wardrobeSort === "oldest") {
        return getItemSortTimestamp(a.item) - getItemSortTimestamp(b.item) || a.index - b.index;
      }

      if (wardrobeSort === "color") {
        return (a.item.color || "").localeCompare(b.item.color || "") || a.index - b.index;
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}
