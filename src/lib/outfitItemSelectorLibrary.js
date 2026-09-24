import { buildDisplayName, normalizeCollections } from "./itemModel.js";
import { defaultGenerationLists, normalizeOutfitFilters, isEligibleForGeneration } from "./generation.js";
import { getItemStatusOptions, styleTagOptions } from "./typeDefaults.js";
import {
  emptyWardrobeFilters,
  filterWardrobeItems,
  getWardrobeFilterOptions,
  sortWardrobeItems
} from "./wardrobeLibrary.js";

export const DEFAULT_SELECTOR_SORT = "nameAz";

export function createEmptySelectorFilters() {
  return {
    ...emptyWardrobeFilters,
    laundry: ""
  };
}

export function createSelectorFiltersFromControls(outfitFilters, generationLists = defaultGenerationLists, statuses = []) {
  const options = getItemStatusOptions([...statuses, ...Object.keys(generationLists)]);
  const included = options.filter((status) => isEligibleForGeneration({ status }, {}, generationLists));
  return {
    ...createEmptySelectorFilters(),
    ...normalizeOutfitFilters(outfitFilters),
    status: included.length === options.length ? [] : included,
    statusExcluded: options.filter((status) => generationLists[status] === "exclude" || !included.length)
  };
}

export function normalizeSelectorSort(value) {
  const allowed = [DEFAULT_SELECTOR_SORT, "nameZa", "newest", "oldest"];
  return allowed.includes(value) ? value : DEFAULT_SELECTOR_SORT;
}

function getSelectorItemName(item) {
  return buildDisplayName(item).toLowerCase();
}

export function getSelectorSearchText(item) {
  return String([
    item.id,
    item.brand,
    item.name,
    item.type,
    item.garmentType,
    ...normalizeCollections(item.collections)
  ].filter(Boolean).join(" "))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function filterAndSortSelectorItems(
  items = [],
  {
    search = "",
    filters = createEmptySelectorFilters(),
    sort = DEFAULT_SELECTOR_SORT,
    searchTextById = {}
  } = {}
) {
  const filtered = filterWardrobeItems(items, filters, {}, search, searchTextById);
  const normalizedSort = normalizeSelectorSort(sort);

  if (normalizedSort === "newest" || normalizedSort === "oldest") {
    return sortWardrobeItems(filtered, normalizedSort);
  }

  return [...filtered].sort((left, right) => {
    if (normalizedSort === "nameAz") {
      return getSelectorItemName(left).localeCompare(getSelectorItemName(right));
    }

    if (normalizedSort === "nameZa") {
      return getSelectorItemName(right).localeCompare(getSelectorItemName(left));
    }

    return 0;
  });
}

export function getSelectorFilterOptions(items = [], filters = {}, options = {}) {
  const wardrobeOptions = getWardrobeFilterOptions(items, filters, { styleTagOptions, ...options });

  return {
    type: wardrobeOptions.type,
    status: wardrobeOptions.status,
    style: wardrobeOptions.style,
    climate: wardrobeOptions.climate,
    collections: wardrobeOptions.collections
  };
}

export function hasActiveSelectorControls({ search = "", filters = {}, sort = DEFAULT_SELECTOR_SORT } = {}) {
  return Boolean(
    search.trim()
    || ["type", "status", "collections", "style", "climate"].some((key) =>
      (filters[key] ?? []).length || (filters[`${key}Excluded`] ?? []).length)
    || filters.favorite
    || normalizeSelectorSort(sort) !== DEFAULT_SELECTOR_SORT
  );
}
