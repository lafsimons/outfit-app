import { resolveFitpicLinkedItems } from "./fitpicEditorModel.js";

function normalizeSearchText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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
  const linkedItemLabels = resolveFitpicLinkedItems(fitpic?.linkedItemUuids, fitpic?.linkedItemIds, items)
    .filter((entry) => !entry.missing)
    .map((entry) => entry.label);

  return [
    fitpic?.name,
    fitpic?.description,
    ...(Array.isArray(fitpic?.tags) ? fitpic.tags : []),
    ...linkedItemLabels
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

export function filterAndSortFitpics(
  fitpics = [],
  {
    search = "",
    favoritesOnly = false,
    linkedItemFilter = "",
    sort = "fitDateNewest"
  } = {},
  items = []
) {
  const normalizedSearch = normalizeSearchText(search);
  const filtered = fitpics.filter((fitpic) => {
    if (favoritesOnly && !fitpic?.favorite) {
      return false;
    }

    if (!fitpicMatchesLinkedItemFilter(fitpic, linkedItemFilter, items)) {
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
