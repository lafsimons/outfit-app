import {
  emptyOutfitFilters,
  normalizeOutfitFilters
} from "./generation.js";
import {
  emptyWardrobeFilters,
  normalizeWardrobeFilters,
  normalizeWardrobeSort
} from "./wardrobeLibrary.js";

export const emptySavedWardrobeViews = [];
export const savedWardrobeViewScope = "wardrobe";

function normalizeTimestampLike(value) {
  const timestamp = typeof value === "string" ? value : "";
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : "";
}

function normalizeWardrobeSearch(value) {
  return typeof value === "string" ? value : "";
}

function normalizeSavedWardrobeViewName(value, index = 0) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || `View ${index + 1}`;
}

function normalizeSavedWardrobeViewNameKey(value) {
  return normalizeSavedWardrobeViewName(value).toLowerCase();
}

function createSavedWardrobeViewId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `wardrobe_view_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSavedWardrobeViewPinned(value) {
  return Boolean(value);
}

function normalizeSavedWardrobeViewScope(value) {
  return value === savedWardrobeViewScope ? value : savedWardrobeViewScope;
}

function getSavedWardrobeViewTimestamp(value = new Date().toISOString()) {
  return normalizeTimestampLike(value) || new Date().toISOString();
}

function sortSavedWardrobeViews(views) {
  return [...views].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
    }

    return left.name.localeCompare(right.name);
  });
}

export function normalizeSavedWardrobeView(view, index = 0) {
  if (!view || typeof view !== "object" || Array.isArray(view)) {
    return null;
  }

  return {
    id: typeof view.id === "string" && view.id.trim() ? view.id.trim() : createSavedWardrobeViewId(),
    name: normalizeSavedWardrobeViewName(view.name, index),
    scope: normalizeSavedWardrobeViewScope(view.scope),
    searchQuery: normalizeWardrobeSearch(view.searchQuery ?? view.wardrobeSearch),
    filters: normalizeWardrobeFilters(view.filters ?? view.wardrobeFilters),
    sort: normalizeWardrobeSort(view.sort ?? view.wardrobeSort),
    pinned: normalizeSavedWardrobeViewPinned(view.pinned),
    createdAt: normalizeTimestampLike(view.createdAt),
    updatedAt: normalizeTimestampLike(view.updatedAt)
  };
}

export function normalizeSavedWardrobeViews(value) {
  const seenIds = new Set();
  const normalizedViews = (Array.isArray(value) ? value : [])
    .map((view, index) => normalizeSavedWardrobeView(view, index))
    .filter(Boolean)
    .map((view) => {
      if (!seenIds.has(view.id)) {
        seenIds.add(view.id);
        return view;
      }

      let nextId = createSavedWardrobeViewId();

      while (seenIds.has(nextId)) {
        nextId = createSavedWardrobeViewId();
      }

      seenIds.add(nextId);
      return {
        ...view,
        id: nextId
      };
    });

  return sortSavedWardrobeViews(normalizedViews);
}

export function createSavedWardrobeViewSnapshot({ wardrobeSearch, wardrobeFilters, wardrobeSort, searchQuery, filters, sort }) {
  return {
    searchQuery: normalizeWardrobeSearch(wardrobeSearch ?? searchQuery),
    filters: normalizeWardrobeFilters(wardrobeFilters ?? filters),
    sort: normalizeWardrobeSort(wardrobeSort ?? sort)
  };
}

export function applySavedWardrobeView(savedView) {
  const normalizedSavedView = normalizeSavedWardrobeView(savedView);

  if (!normalizedSavedView) {
    return createSavedWardrobeViewSnapshot({
      wardrobeSearch: "",
      wardrobeFilters: emptyWardrobeFilters,
      wardrobeSort: "newest"
    });
  }

  return createSavedWardrobeViewSnapshot({
    wardrobeSearch: normalizedSavedView.searchQuery,
    wardrobeFilters: normalizedSavedView.filters,
    wardrobeSort: normalizedSavedView.sort
  });
}

export function applySavedWardrobeViewToOutfitFilters(savedView) {
  const normalizedSavedView = normalizeSavedWardrobeView(savedView);

  if (!normalizedSavedView) {
    return { ...emptyOutfitFilters };
  }

  const { filters } = normalizedSavedView;
  return normalizeOutfitFilters({
    style: filters.style,
    styleExcluded: filters.styleExcluded,
    climate: filters.climate,
    climateExcluded: filters.climateExcluded,
    collections: filters.collections,
    collectionsExcluded: filters.collectionsExcluded
  });
}

export function areSavedWardrobeViewsEquivalent(leftView, rightState) {
  return JSON.stringify(applySavedWardrobeView(leftView)) === JSON.stringify(createSavedWardrobeViewSnapshot(rightState));
}

export function matchesCurrentWardrobeView(savedView, currentState) {
  return areSavedWardrobeViewsEquivalent(savedView, currentState);
}

export function matchesCurrentOutfitFiltersSavedWardrobeView(savedView, outfitFilters) {
  return JSON.stringify(applySavedWardrobeViewToOutfitFilters(savedView)) === JSON.stringify(normalizeOutfitFilters(outfitFilters));
}

export function upsertSavedWardrobeView(savedViews, name, currentState, options = {}) {
  const normalizedSavedViews = normalizeSavedWardrobeViews(savedViews);
  const normalizedName = normalizeSavedWardrobeViewName(name);
  const targetId = typeof options.targetId === "string" ? options.targetId.trim() : "";
  const timestamp = getSavedWardrobeViewTimestamp(options.updatedAt);
  const conflictingView = normalizedSavedViews.find(
    (view) => normalizeSavedWardrobeViewNameKey(view.name) === normalizeSavedWardrobeViewNameKey(normalizedName) && view.id !== targetId
  ) ?? null;

  if (conflictingView && !options.allowReplace) {
    return {
      savedViews: normalizedSavedViews,
      savedView: null,
      conflictingView
    };
  }

  const targetView = normalizedSavedViews.find((view) => view.id === targetId) ?? null;
  const nextSavedView = {
    id: targetId || conflictingView?.id || createSavedWardrobeViewId(),
    name: normalizedName,
    scope: savedWardrobeViewScope,
    pinned: normalizeSavedWardrobeViewPinned(options.pinned ?? targetView?.pinned ?? conflictingView?.pinned),
    createdAt: targetView?.createdAt || conflictingView?.createdAt || timestamp,
    updatedAt: timestamp,
    ...createSavedWardrobeViewSnapshot(currentState)
  };
  const nextSavedViews = normalizedSavedViews.filter(
    (view) => view.id !== targetId && view.id !== conflictingView?.id
  );
  const targetIndex = targetId
    ? normalizedSavedViews.findIndex((view) => view.id === targetId)
    : conflictingView
      ? normalizedSavedViews.findIndex((view) => view.id === conflictingView.id)
      : -1;

  if (targetIndex >= 0 && targetIndex <= nextSavedViews.length) {
    nextSavedViews.splice(targetIndex, 0, nextSavedView);
  } else {
    nextSavedViews.push(nextSavedView);
  }

  return {
    savedViews: normalizeSavedWardrobeViews(nextSavedViews),
    savedView: nextSavedView,
    conflictingView
  };
}

export function renameSavedWardrobeView(savedViews, id, name, options = {}) {
  const normalizedSavedViews = normalizeSavedWardrobeViews(savedViews);
  const normalizedId = typeof id === "string" ? id.trim() : "";
  const targetView = normalizedSavedViews.find((view) => view.id === normalizedId) ?? null;

  if (!targetView) {
    return {
      savedViews: normalizedSavedViews,
      savedView: null,
      conflictingView: null
    };
  }

  return upsertSavedWardrobeView(
    normalizedSavedViews,
    name,
    applySavedWardrobeView(targetView),
    {
      targetId: normalizedId,
      allowReplace: options.allowReplace,
      pinned: targetView.pinned
    }
  );
}

export function deleteSavedWardrobeView(savedViews, id) {
  const normalizedId = typeof id === "string" ? id.trim() : "";
  return normalizeSavedWardrobeViews(savedViews).filter((view) => view.id !== normalizedId);
}

export function togglePinnedSavedWardrobeView(savedViews, id) {
  const normalizedId = typeof id === "string" ? id.trim() : "";
  const timestamp = getSavedWardrobeViewTimestamp();

  return normalizeSavedWardrobeViews(
    normalizeSavedWardrobeViews(savedViews)
      .map((view) => (
      view.id === normalizedId
        ? {
            ...view,
            pinned: !view.pinned,
            updatedAt: timestamp
          }
        : view
      ))
  );
}
