function normalizeSearchText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getTimestamp(value) {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTagValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildSavedOutfitSearchText(savedOutfit) {
  return [
    savedOutfit?.name,
    savedOutfit?.description,
    ...(Array.isArray(savedOutfit?.tags) ? savedOutfit.tags : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getSavedOutfitTagFilterOptions(savedOutfits = []) {
  const options = [];
  const seen = new Set();

  savedOutfits.forEach((savedOutfit) => {
    (Array.isArray(savedOutfit?.tags) ? savedOutfit.tags : []).forEach((tag) => {
      const normalizedTag = normalizeTagValue(tag);
      const normalizedKey = normalizedTag.toLowerCase();

      if (!normalizedTag || seen.has(normalizedKey)) {
        return;
      }

      seen.add(normalizedKey);
      options.push({
        value: normalizedTag,
        label: normalizedTag
      });
    });
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function filterAndSortSavedOutfits(
  savedOutfits = [],
  {
    search = "",
    favoritesOnly = false,
    tagFilter = "",
    sort = "updatedNewest"
  } = {}
) {
  const normalizedSearch = normalizeSearchText(search);
  const normalizedTagFilter = normalizeSearchText(tagFilter);
  const filtered = savedOutfits.filter((savedOutfit) => {
    if (favoritesOnly && !savedOutfit?.favorite) {
      return false;
    }

    if (
      normalizedTagFilter
      && !(Array.isArray(savedOutfit?.tags) ? savedOutfit.tags : [])
        .some((tag) => normalizeSearchText(tag) === normalizedTagFilter)
    ) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return buildSavedOutfitSearchText(savedOutfit).includes(normalizedSearch);
  });

  const sorted = [...filtered];
  sorted.sort((left, right) => {
    if (sort === "titleAz") {
      return (left?.name || "").localeCompare(right?.name || "");
    }

    if (sort === "createdNewest") {
      return getTimestamp(right?.createdAt) - getTimestamp(left?.createdAt);
    }

    return (
      getTimestamp(right?.updatedAt) || getTimestamp(right?.createdAt)
    ) - (
      getTimestamp(left?.updatedAt) || getTimestamp(left?.createdAt)
    );
  });

  return sorted;
}
