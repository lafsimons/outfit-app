import { buildDisplayName } from "./itemModel.js";
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

export function normalizeSelectorSort(value) {
  const allowed = [DEFAULT_SELECTOR_SORT, "nameZa", "newest", "oldest"];
  return allowed.includes(value) ? value : DEFAULT_SELECTOR_SORT;
}

function getSelectorItemName(item) {
  return buildDisplayName(item).toLowerCase();
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
  const wardrobeOptions = getWardrobeFilterOptions(items, filters, options);

  return {
    type: wardrobeOptions.type,
    status: wardrobeOptions.status,
    collections: wardrobeOptions.collections
  };
}

export function hasActiveSelectorControls({ search = "", filters = {}, sort = DEFAULT_SELECTOR_SORT } = {}) {
  return Boolean(
    search.trim()
    || (filters.type ?? []).length
    || (filters.status ?? []).length
    || (filters.collections ?? []).length
    || filters.favorite
    || normalizeSelectorSort(sort) !== DEFAULT_SELECTOR_SORT
  );
}
