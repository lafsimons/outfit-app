import { climateTagOptions, getItemClimateTags, getItemStyleTags } from "./generation.js";
import { getItemSortTimestamp, getNumericValue, normalizeCollections } from "./itemModel.js";
import { normalizeStatus } from "./typeDefaults.js";

export const DEFAULT_WARDROBE_SORT = "newest";
export const wardrobeMultiValueFilterKeys = ["brand", "type", "garmentType", "color", "style", "climate", "weight", "status", "collections"];

export function getExcludedFilterKey(key) {
  return `${key}Excluded`;
}

export const wardrobeExcludedMultiValueFilterKeys = wardrobeMultiValueFilterKeys.map(getExcludedFilterKey);

export const emptyWardrobeFilters = {
  brand: [],
  brandExcluded: [],
  type: [],
  typeExcluded: [],
  garmentType: [],
  garmentTypeExcluded: [],
  color: [],
  colorExcluded: [],
  style: [],
  styleExcluded: [],
  climate: [],
  climateExcluded: [],
  laundry: "",
  weight: [],
  weightExcluded: [],
  status: [],
  statusExcluded: [],
  collections: [],
  collectionsExcluded: [],
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

function normalizeFilterDimensions(filters, key, normalizeValue = (entry) => entry, legacyFallback = undefined) {
  return {
    [key]: normalizeLegacyOrMultiValue(filters[key] ?? legacyFallback, normalizeValue),
    [getExcludedFilterKey(key)]: normalizeLegacyOrMultiValue(filters[getExcludedFilterKey(key)], normalizeValue)
  };
}

export function normalizeWardrobeFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return { ...emptyWardrobeFilters };
  }

  return {
    ...normalizeFilterDimensions(filters, "brand"),
    ...normalizeFilterDimensions(filters, "type"),
    ...normalizeFilterDimensions(filters, "garmentType"),
    ...normalizeFilterDimensions(filters, "color"),
    ...normalizeFilterDimensions(filters, "style"),
    ...normalizeFilterDimensions(filters, "climate"),
    laundry: normalizeFilterToken(filters.laundry),
    ...normalizeFilterDimensions(filters, "weight"),
    ...normalizeFilterDimensions(filters, "status", normalizeStatusFilterValue, filters.list),
    ...normalizeFilterDimensions(filters, "collections"),
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

function getItemFilterValues(item, key) {
  if (key === "style") {
    return getItemStyleTags(item);
  }

  if (key === "climate") {
    return getItemClimateTags(item);
  }

  if (key === "collections") {
    return normalizeCollections(item.collections);
  }

  if (key === "status") {
    return [normalizeStatus(item.status ?? item.list)];
  }

  const value = normalizeFilterToken(item?.[key]);
  return value ? [value] : [];
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

function matchesMultiFilterDimension(item, filters, key, ignored) {
  if (ignored.has(key)) {
    return true;
  }

  const values = getItemFilterValues(item, key);
  return (
    matchesIncludedValues(values, filters[key] ?? [])
    && matchesExcludedValues(values, filters[getExcludedFilterKey(key)] ?? [])
  );
}

export function matchesWardrobeFilters(item, filters, ignoredKeys = []) {
  const normalizedFilters = normalizeWardrobeFilters(filters);
  const ignored = new Set(ignoredKeys);

  return (
    wardrobeMultiValueFilterKeys.every((key) => matchesMultiFilterDimension(item, normalizedFilters, key, ignored))
    && (
      ignored.has("favorite")
      || !normalizedFilters.favorite
      || (normalizedFilters.favorite === "yes" ? Boolean(item.favorite) : !item.favorite)
    )
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
    normalizeStatus(item.status ?? item.list),
    item.description,
    ...normalizeCollections(item.collections),
    ...getItemStyleTags(item),
    ...getItemClimateTags(item)
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

function mergeSelected(options, ...selectedGroups) {
  return [...new Set([...options, ...selectedGroups.flat()])].sort((left, right) => left.localeCompare(right));
}

export function getWardrobeFilterOptions(
  items,
  filters,
  {
    itemStatusOptions = [],
    styleTagOptions = [],
    climateFilterOptions = climateTagOptions
  } = {}
) {
  const normalizedFilters = normalizeWardrobeFilters(filters);
  const getItemsForKey = (key) => items.filter((item) => matchesWardrobeFilters(item, normalizedFilters, [key]));
  const getUniqueValues = (sourceItems, key) =>
    [...new Set(sourceItems.flatMap((item) => getItemFilterValues(item, key)).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  return {
    brand: mergeSelected(getUniqueValues(getItemsForKey("brand"), "brand"), normalizedFilters.brand, normalizedFilters.brandExcluded),
    type: mergeSelected(getUniqueValues(getItemsForKey("type"), "type"), normalizedFilters.type, normalizedFilters.typeExcluded),
    garmentType: mergeSelected(getUniqueValues(getItemsForKey("garmentType"), "garmentType"), normalizedFilters.garmentType, normalizedFilters.garmentTypeExcluded),
    color: mergeSelected(getUniqueValues(getItemsForKey("color"), "color"), normalizedFilters.color, normalizedFilters.colorExcluded),
    style: mergeSelected(
      styleTagOptions.filter((style) => getItemsForKey("style").some((item) => getItemStyleTags(item).includes(style))),
      normalizedFilters.style,
      normalizedFilters.styleExcluded
    ),
    climate: mergeSelected(
      climateFilterOptions.filter((climate) => getItemsForKey("climate").some((item) => getItemClimateTags(item).includes(climate))),
      normalizedFilters.climate,
      normalizedFilters.climateExcluded
    ),
    weight: mergeSelected(getUniqueValues(getItemsForKey("weight"), "weight"), normalizedFilters.weight, normalizedFilters.weightExcluded),
    status: mergeSelected(
      itemStatusOptions.filter((status) => getItemsForKey("status").some((item) => normalizeStatus(item.status ?? item.list) === status)),
      normalizedFilters.status,
      normalizedFilters.statusExcluded
    ),
    collections: mergeSelected(
      getUniqueValues(getItemsForKey("collections"), "collections"),
      normalizedFilters.collections,
      normalizedFilters.collectionsExcluded
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
