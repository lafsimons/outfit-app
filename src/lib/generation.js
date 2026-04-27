import {
  getTypeMatchKeys,
  normalizeList,
  normalizeTagList,
  normalizeType,
  normalizeWeight,
  resolveTypeDefaults,
  styleTagOptions
} from "./typeDefaults.js";

export const visibleSlots = ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"];
export const accessorySlots = ["Glasses", "Neck", "LeftHand", "RightHand", "Bag", "Belt"];
export const defaultGenerationLists = { Wardrobe: true, Wishlist: true };
export const climateTagOptions = ["Cold", "Warm", "Hot", "Snow", "Rain", "Transitional"];
export const editableClimateTagOptions = ["Rain", "Snow"];
export const outfitFilterOptions = {
  climate: climateTagOptions,
  style: styleTagOptions
};
export const emptyOutfitFilters = {
  style: [],
  climate: []
};
export const generationModes = ["guided", "random"];
export const defaultGenerationMode = "guided";
export const RECENT_OUTFIT_WINDOW = 3;

const nonStackableTopTypes = new Set(["sweatshirt", "jacket"]);
const affinityRelationships = [
  ["TopInner", "Bottom"],
  ["Bottom", "Footwear"],
  ["TopOuter", "TopInner"],
  ["TopOuter", "Bottom"]
];
const guidedExplanationLabels = {
  climate: "Climate suitability",
  styleCoherence: "Style match",
  styleCompletion: "Style completion",
  dominance: "Style consistency",
  weightContrast: "Extreme weight mix penalty",
  styleConflict: "Cross-style conflict penalty",
  hotOuterwear: "Outerwear adjusted for heat",
  lonelyExtremes: "Lonely extremes penalty",
  baseline: "Clean baseline outfit",
  earlyAnchor: "Early style anchoring",
  selectedStyleBonus: "Selected style bonus",
  favorite: "Favorite item boost",
  affinity: "Liked combo affinity",
  recentItemPenalty: "Recent item repetition penalty",
  recentExactPenalty: "Exact outfit repetition penalty",
  recentLikedBoost: "Recent like combo boost",
  coldOuterwear: "Outerwear added for cold"
};

function normalizeBooleanLookup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, isEnabled]) => Boolean(isEnabled)).map(([key]) => [key, true])
  );
}

function normalizeAffinityMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, Math.max(0, Math.round(Number(count) || 0))])
      .filter(([, count]) => count > 0)
  );
}

function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function pickWeightedRandom(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (!totalWeight) {
    return pickRandom(entries.map((entry) => entry.item));
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= Math.max(0, entry.weight);
    if (remaining <= 0) {
      return entry.item;
    }
  }

  return entries.at(-1)?.item ?? null;
}

export function getOutfitKey(outfit, layering) {
  return JSON.stringify({
    layering: Boolean(layering),
    slots: Object.fromEntries(visibleSlots.map((slot) => [slot, outfit?.[slot] ?? null]))
  });
}

function buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId) {
  return ["pair", sourceSlot, targetSlot, sourceItemId, targetItemId].join("|");
}

function buildAffinityItemKey(slot, itemId) {
  return ["item", slot, itemId].join("|");
}

function getAffinityUpdatesForOutfit(outfit) {
  const updates = {};

  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    const sourceItemId = outfit?.[sourceSlot];
    const targetItemId = outfit?.[targetSlot];

    if (!sourceItemId || !targetItemId) {
      return;
    }

    const pairKey = buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId);
    updates[pairKey] = (updates[pairKey] ?? 0) + 1;
  });

  visibleSlots.forEach((slot) => {
    const itemId = outfit?.[slot];

    if (!itemId) {
      return;
    }

    const itemKey = buildAffinityItemKey(slot, itemId);
    updates[itemKey] = (updates[itemKey] ?? 0) + 1;
  });

  return updates;
}

export function applyOutfitAffinityDelta(currentAffinity, outfit, delta) {
  const nextAffinity = { ...normalizeAffinityMap(currentAffinity) };
  const updates = getAffinityUpdatesForOutfit(outfit);

  Object.entries(updates).forEach(([key, count]) => {
    const nextCount = Math.max(0, (nextAffinity[key] ?? 0) + count * delta);

    if (nextCount > 0) {
      nextAffinity[key] = nextCount;
    } else {
      delete nextAffinity[key];
    }
  });

  return nextAffinity;
}

function sanitizeRecentOutfitSlots(outfit) {
  return Object.fromEntries(visibleSlots.map((slot) => [slot, outfit?.[slot] ?? null]));
}

function normalizeRecentOutfitEntry(entry) {
  const outfit = sanitizeRecentOutfitSlots(entry?.outfit);
  const layering = Boolean(entry?.layering);

  return {
    key: typeof entry?.key === "string" ? entry.key : getOutfitKey(outfit, layering),
    outfit,
    layering,
    liked: Boolean(entry?.liked)
  };
}

export function normalizeRecentOutfits(value) {
  return Array.isArray(value) ? value.map(normalizeRecentOutfitEntry).slice(0, RECENT_OUTFIT_WINDOW) : [];
}

export function rememberRecentOutfit(currentRecentOutfits, outfit, layering, options = {}) {
  const { liked, preserveLiked = false } = options;
  const entry = normalizeRecentOutfitEntry({
    outfit,
    layering,
    liked: Boolean(liked)
  });
  const existing = normalizeRecentOutfits(currentRecentOutfits);
  const previous = existing.find((current) => current.key === entry.key);

  return [
    {
      ...entry,
      liked: typeof liked === "boolean" ? liked : preserveLiked ? previous?.liked || false : false
    },
    ...existing.filter((current) => current.key !== entry.key)
  ].slice(0, RECENT_OUTFIT_WINDOW);
}

function isEligibleForGeneration(item, excluded = {}, generationLists = defaultGenerationLists) {
  return !excluded[item.id] && generationLists[normalizeList(item.list)] !== false;
}

export function getPool(items, slot, excluded = {}, generationLists = defaultGenerationLists, layering = true) {
  return items.filter((item) => {
    if (!isEligibleForGeneration(item, excluded, generationLists)) {
      return false;
    }

    if (slot === "Headwear") return item.garmentType === "Headwear";
    if (slot === "Bottom") return item.garmentType === "Bottom";
    if (slot === "Footwear") return item.garmentType === "Footwear";

    if (slot === "TopInner") {
      if (!layering) {
        return item.garmentType === "Top" || item.garmentType === "Outerwear";
      }

      return item.garmentType === "Top" && (item.layerType === "Inner" || item.layerType === "Both");
    }

    if (slot === "TopOuter") {
      return (
        (item.garmentType === "Top" || item.garmentType === "Outerwear") &&
        (item.layerType === "Outer" || item.layerType === "Both")
      );
    }

    if (accessorySlots.includes(slot)) {
      return item.garmentType === "Accessory" && item.accessorySlot === slot;
    }

    return false;
  });
}

function inferStyleTags(item) {
  const manualTags = normalizeTagList(item.styleTags, styleTagOptions);

  if (manualTags.length) {
    return manualTags;
  }

  return normalizeTagList(resolveTypeDefaults(item.type).styleTags, styleTagOptions);
}

function inferClimateTags(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const garmentType = item.garmentType;
  const weight = normalizeWeight(item.weight);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  return climateTagOptions.filter((climate) => {
    if (climate === "Hot") {
      return (
        weight === "Light" ||
        hasType("shorts", "sandals", "t-shirt", "shirt", "casual shirt")
      ) && weight !== "Heavy" && garmentType !== "Outerwear" && !hasType("coat", "boots");
    }

    if (climate === "Warm") {
      return (
        weight === "Light" ||
        weight === "Medium" ||
        hasType("shorts", "sandals", "sneakers", "t-shirt", "shirt", "casual shirt", "trousers", "jeans")
      ) && weight !== "Heavy" && !hasType("coat", "boots", "beanie", "scarf");
    }

    if (climate === "Cold" || climate === "Snow") {
      return (
        weight === "Heavy" ||
        garmentType === "Outerwear" ||
        hasType("coat", "jacket", "knit", "sweatshirt", "hoodie", "boots", "beanie", "scarf")
      ) && !hasType("shorts", "sandals");
    }

    if (climate === "Rain") {
      return garmentType === "Outerwear" || hasType("coat", "jacket", "boots", "cap", "shell jacket");
    }

    if (climate === "Transitional") {
      return (
        weight === "Medium" ||
        hasType("jacket", "knit", "shirt", "casual shirt", "trousers", "jeans", "sneakers", "blazer")
      ) && weight !== "Heavy" && !hasType("shorts", "coat");
    }

    return false;
  });
}

export function getItemStyleTags(item) {
  return inferStyleTags(item);
}

export function getItemClimateTags(item) {
  return [...new Set([...inferClimateTags(item), ...normalizeTagList(item.climateTags, climateTagOptions)])];
}

export function hasActiveOutfitFilters(outfitFilters) {
  return Object.keys(outfitFilterOptions).some((group) => {
    const values = outfitFilters?.[group];
    return Array.isArray(values) && values.length > 0;
  });
}

export function normalizeGenerationMode(mode) {
  return generationModes.includes(mode) ? mode : defaultGenerationMode;
}

function getGenerationClimatePreferences(outfitFilters, weatherData) {
  if (Array.isArray(outfitFilters?.climate) && outfitFilters.climate.length) {
    return outfitFilters.climate;
  }

  return Array.isArray(weatherData?.suggestedFilters) ? weatherData.suggestedFilters : [];
}

function getPickedOutfitItems(outfit, itemsById) {
  return visibleSlots.map((slot) => itemsById[outfit[slot]]).filter(Boolean);
}

export function getCurrentOutfitClimateChip(outfitFilters, weatherData) {
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  return climatePreferences[0] ?? "Everyday";
}

function getDominantStyleTags(items) {
  const counts = new Map();

  items.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    });
  });

  const maxCount = Math.max(0, ...counts.values());
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count === maxCount && count > 0)
      .map(([style]) => style)
  );
}

function getDominantStyleCounts(items) {
  const counts = new Map();

  items.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    });
  });

  return counts;
}

export function getCurrentOutfitStyleChip(items, selectedStyles) {
  const counts = getDominantStyleCounts(items);
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);

  if (ranked.length) {
    const topScore = ranked[0][1];
    const tiedStyles = ranked.filter(([, score]) => score === topScore).map(([style]) => style);
    const selectedMatch = (selectedStyles ?? []).find((style) => tiedStyles.includes(style));
    return selectedMatch ?? tiedStyles[0];
  }

  return selectedStyles?.[0] ?? "Casual";
}

function getClimateScore(item, slot, climatePreferences) {
  if (!climatePreferences.length) return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const climateTags = new Set(getItemClimateTags(item));
  let score = 0;

  climatePreferences.forEach((climate) => {
    if (climateTags.has(climate)) score += 1.4;

    if (climate === "Hot") {
      if (slot === "TopInner") {
        if (hasType("t-shirt", "shirt")) score += 3;
        else if (hasType("ls t-shirt")) score += 1;
        else if (hasType("sweatshirt", "knit sweater", "hoodie", "wool shirt")) score -= 2;
      } else if (slot === "Bottom") {
        if (hasType("shorts", "trousers")) score += 2;
        else if (hasType("jeans")) score += 1;
      } else if (slot === "Footwear") {
        if (hasType("sneakers", "canvas sneakers")) score += 2;
        else if (hasType("slides", "sandals")) score += 1;
        else if (hasType("boots")) score -= 2;
      } else if (slot === "TopOuter") {
        if (item.garmentType === "Outerwear") score -= normalizeWeight(item.weight) === "Heavy" ? 4 : 2;
      }
    }

    if (climate === "Warm") {
      if (hasType("t-shirt", "shirt", "sneakers", "canvas sneakers", "trousers", "shorts")) score += 1;
      if (item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") score -= 2;
      if (hasType("scarf")) score -= 3;
    }

    if (climate === "Cold" || climate === "Snow") {
      if (slot === "TopInner") {
        if (hasType("knit sweater", "sweatshirt", "hoodie")) score += 3;
        else if (hasType("shirt", "wool shirt")) score += 1;
        else if (hasType("t-shirt")) score -= 2;
      } else if (slot === "TopOuter") {
        if (hasType("wool coat", "wool jacket")) score += 4;
        else if (hasType("jacket", "twill jacket", "denim jacket", "fleece jacket")) score += 2;
        else if (item.garmentType === "Outerwear") score += 1;
        else score -= 4;
      } else if (slot === "Footwear") {
        if (hasType("boots")) score += 3;
        else if (hasType("leather sneakers")) score += 1;
        else if (hasType("canvas sneakers")) score -= 1;
      }
    }

    if (climate === "Rain") {
      if (slot === "TopOuter" && item.garmentType === "Outerwear") score += 2;
      if (slot === "Footwear" && hasType("boots")) score += 2;
    }

    if (climate === "Transitional") {
      if (hasType("jacket", "twill jacket", "shirt", "trousers", "jeans", "sneakers", "blazer")) score += 1;
      if (normalizeWeight(item.weight) === "Heavy") score -= 1;
    }
  });

  if (climatePreferences.includes("Hot") && hasType("scarf")) score -= 5;
  return score;
}

function isAthleisureOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length === 1 && itemStyles[0] === "Athleisure";
}

function isFormalOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length > 0 && itemStyles.every((style) => style === "Formal");
}

function isAthleisureSneaker(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const itemStyles = getItemStyleTags(item);
  return typeMatches.has("sneakers") && itemStyles.includes("Athleisure");
}

function resolveSelectedStyleMode(selectedStyles) {
  const uniqueStyles = [...new Set((selectedStyles ?? []).filter(Boolean))];

  if (!uniqueStyles.length || uniqueStyles.every((style) => style === "Casual")) return "casual";

  const hasFormal = uniqueStyles.includes("Formal");
  const hasSmartCasual = uniqueStyles.includes("Smart Casual");
  const hasAthleisure = uniqueStyles.includes("Athleisure");

  if (hasFormal && hasSmartCasual && hasAthleisure) return "minimal";
  if (hasFormal && hasSmartCasual) return "formal-bridge";
  if (hasFormal && hasAthleisure) return "minimal";
  if (hasSmartCasual && hasAthleisure) return "minimal-bridge";
  if (hasFormal) return "formal";
  if (hasSmartCasual) return "smart-casual";
  if (hasAthleisure) return "athleisure";
  return "casual";
}

function getStyleBlockProfile(styleMode) {
  return {
    styleMode,
    blockFormalSet: styleMode === "formal",
    blockFormalBridgeSet: styleMode === "formal-bridge",
    blockSmartCasualSet: styleMode === "smart-casual",
    blockAthleisureSet: styleMode === "athleisure"
  };
}

function passesSelectedStyleRules(item, selectedStyles) {
  const styleMode = resolveSelectedStyleMode(selectedStyles);
  const profile = getStyleBlockProfile(styleMode);

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const isAthleisureOnly = isAthleisureOnlyItem(item);
  const isFormalOnly = isFormalOnlyItem(item);
  const hasFormalBridgeBlockedType = hasType(
    "shorts",
    "slides",
    "sandals",
    "sport cap",
    "beanie",
    "fleece jacket",
    "shell jacket",
    "hoodie",
    "sweatshirt",
    "sport t-shirt"
  );

  if (profile.blockFormalSet) {
    if (hasType("shorts", "slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "hoodie", "sweatshirt", "sport t-shirt")) {
      return false;
    }
    if (isAthleisureOnly || isAthleisureSneaker(item)) {
      return false;
    }
  }

  if (profile.blockFormalBridgeSet && hasFormalBridgeBlockedType) return false;

  if (profile.blockSmartCasualSet) {
    if (hasType("slides", "sandals", "sport cap", "fleece jacket", "shell jacket", "sport t-shirt", "sport ls t-shirt", "sport shorts")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (profile.blockAthleisureSet) {
    if (hasType("derby", "wool coat", "wool jacket") || isFormalOnly) {
      return false;
    }
  }

  return true;
}

function passesHardContextRules(item, slot, outfitFilters, weatherData) {
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const selectedStyles = outfitFilters.style ?? [];
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (climatePreferences.includes("Hot")) {
    if (slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") return false;
    if (hasType("wool coat")) return false;
  }

  if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
    if (hasType("shorts", "slides", "sandals")) return false;
  }

  if (climatePreferences.includes("Rain")) {
    if (hasType("slides", "sandals")) return false;
  }

  return passesSelectedStyleRules(item, selectedStyles);
}

function applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData) {
  const filtered = pool.filter((item) => passesHardContextRules(item, slot, outfitFilters, weatherData));
  return filtered.length ? filtered : pool;
}

function getDominantStyleMode(selectedStyles, pickedItems) {
  const selectedStyleMode = resolveSelectedStyleMode(selectedStyles);
  const counts = getDominantStyleCounts(pickedItems);

  if (pickedItems.length < 2) return selectedStyleMode;

  const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominantEntry || dominantEntry[1] < 2) return selectedStyleMode;

  const [dominantStyle] = dominantEntry;
  if (dominantStyle === "Formal") return "formal";
  if (dominantStyle === "Smart Casual") return "smart-casual";
  if (dominantStyle === "Athleisure") return "athleisure";
  return selectedStyleMode;
}

function getStyleCompletionScore(item, slot, styleMode) {
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  let score = 0;

  if (styleMode === "formal") {
    if (slot === "TopInner" && hasType("shirt")) score += 4;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 4;
    if (slot === "Footwear" && hasType("derby")) score += 4;
    if (slot === "TopOuter" && hasType("blazer", "wool coat")) score += 4;
    if (item.garmentType === "Accessory" && item.accessorySlot === "LeftHand" && hasType("watch")) score += 1.5;
    if (item.garmentType === "Accessory" && item.accessorySlot === "Belt" && hasType("belt")) score += 1.2;
    if (slot === "Headwear" && hasType("hat")) score += 1.5;
    if (slot === "Headwear" && hasType("cap")) score -= 1.5;
    if (slot === "Bottom" && hasType("jeans")) score -= 2;
  }

  if (styleMode === "formal-bridge") {
    if (slot === "TopInner" && hasType("shirt")) score += 3.5;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 3.5;
    if (slot === "Footwear" && hasType("derby", "leather sneakers")) score += hasType("derby") ? 3.5 : 2.2;
    if (slot === "TopOuter" && hasType("blazer", "wool coat", "jacket", "wool jacket")) score += hasType("blazer", "wool coat") ? 3.5 : 2;
    if (slot === "Headwear" && hasType("hat")) score += 1.2;
    if (slot === "Bottom" && hasType("jeans")) score -= 1;
  }

  if (styleMode === "smart-casual") {
    if (slot === "TopInner" && hasType("shirt", "knit", "knit sweater", "wool shirt")) score += 2.5;
    if (slot === "Footwear" && hasType("leather sneakers")) score += 2.5;
    if (slot === "TopOuter" && hasType("jacket", "blazer", "wool coat", "wool jacket")) score += 2.5;
    if (slot === "Headwear" && hasType("hat")) score += 1;
  }

  if (styleMode === "athleisure") {
    if (slot === "TopInner" && hasType("hoodie", "sweatshirt", "sport t-shirt", "sport ls t-shirt")) score += 3.5;
    if (slot === "Footwear" && hasType("sneakers", "sneakers (thin)", "canvas sneakers")) score += 3.5;
    if (slot === "Headwear" && hasType("cap", "sport cap")) score += 2.5;
    if (slot === "TopOuter" && hasType("shell jacket", "fleece jacket")) score += 3;
    if (slot === "Bottom" && hasType("sport shorts")) score += 3;
  }

  return score;
}

function getDominancePenaltyScore(item, pickedItems, styleMode) {
  if (pickedItems.length < 2) return 0;

  const counts = getDominantStyleCounts(pickedItems);
  const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominantEntry || dominantEntry[1] < 2) return 0;

  const [dominantStyle] = dominantEntry;
  const itemStyles = getItemStyleTags(item);

  if (dominantStyle === "Formal") {
    if (itemStyles.includes("Athleisure")) return -3.5;
    if (itemStyles.includes("Casual") && !itemStyles.includes("Formal") && !itemStyles.includes("Smart Casual")) return -2;
  }
  if (dominantStyle === "Athleisure" && itemStyles.includes("Formal")) return -3.5;
  if (dominantStyle === "Smart Casual" && isAthleisureOnlyItem(item)) return -2.5;
  return styleMode === "minimal" || styleMode === "minimal-bridge" ? 0 : 0;
}

function getWeightContrastScore(item, pickedItems) {
  const itemWeight = normalizeWeight(item.weight);
  if (!pickedItems.length) return 0;

  const hasHeavyPickedItem = pickedItems.some((pickedItem) => normalizeWeight(pickedItem.weight) === "Heavy");
  const hasLightPickedItem = pickedItems.some((pickedItem) => normalizeWeight(pickedItem.weight) === "Light");

  if ((itemWeight === "Heavy" && hasLightPickedItem) || (itemWeight === "Light" && hasHeavyPickedItem)) return -1.5;
  return 0;
}

function getCrossStyleConflictScore(item, pickedItems, selectedStyles) {
  const itemStyles = getItemStyleTags(item);
  const selectedStyleSet = new Set(selectedStyles ?? []);

  if (!selectedStyleSet.has("Formal") || !selectedStyleSet.has("Athleisure")) {
    const pickedHasFormal = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).includes("Formal"));
    const pickedHasAthleisure = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).includes("Athleisure"));
    const itemIsFormal = itemStyles.includes("Formal");
    const itemIsAthleisure = itemStyles.includes("Athleisure");

    if ((pickedHasFormal && itemIsAthleisure) || (pickedHasAthleisure && itemIsFormal)) return -2.2;
  }

  return 0;
}

function getHotOuterwearScore(item, slot, climatePreferences) {
  if (climatePreferences.includes("Hot") && slot === "TopOuter" && item.garmentType === "Outerwear") {
    return normalizeWeight(item.weight) === "Heavy" ? -2 : -1.25;
  }
  return 0;
}

function getLonelyExtremesScore(item, slot, outfit, itemsById) {
  if (!["TopInner", "TopOuter", "Bottom", "Footwear"].includes(slot)) return 0;

  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const heavyCount = nextItems.filter((candidate) => normalizeWeight(candidate.weight) === "Heavy").length;
  const lightCount = nextItems.filter((candidate) => normalizeWeight(candidate.weight) === "Light").length;

  if (heavyCount === 1 && lightCount >= 2) return -1.15;
  if (lightCount === 1 && heavyCount >= 2) return -1;
  return 0;
}

function getBaselineOutfitScore(item, slot) {
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopInner" && hasType("t-shirt", "shirt")) return 1.2;
  if (slot === "Bottom" && hasType("jeans", "trousers", "light trousers")) return 1.2;
  if (slot === "Footwear" && hasType("sneakers", "leather sneakers")) return 1.2;
  return 0;
}

function getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles) {
  if (pickedItems.length >= 2 || slot === "Headwear") return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const selectedStyleSet = new Set(selectedStyles ?? []);

  if (hasType("shirt")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 2.2 : 1.3;
  if (hasType("hoodie", "sport t-shirt", "sport ls t-shirt", "sweatshirt")) return selectedStyleSet.has("Athleisure") ? 2.2 : 1.3;
  if (hasType("trousers", "light trousers", "derby")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 1.4 : 0.8;
  if (hasType("sport shorts", "shell jacket", "fleece jacket")) return selectedStyleSet.has("Athleisure") ? 1.4 : 0.8;
  return 0;
}

function getRecentMemoryScore(item, slot, outfit, recentOutfits, layering) {
  const normalizedRecentOutfits = normalizeRecentOutfits(recentOutfits);
  const scores = { recentItemPenalty: 0, recentExactPenalty: 0, recentLikedBoost: 0 };

  if (!normalizedRecentOutfits.length) return scores;

  normalizedRecentOutfits.forEach((recentOutfit, index) => {
    const recencyWeight = RECENT_OUTFIT_WINDOW - index;
    const itemUsed = visibleSlots.some((recentSlot) => recentOutfit.outfit?.[recentSlot] === item.id);
    if (itemUsed) scores.recentItemPenalty -= 0.18 * recencyWeight;

    affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
      if (targetSlot !== slot || !recentOutfit.liked) return;
      const sourceItemId = outfit?.[sourceSlot];
      if (!sourceItemId) return;
      if (recentOutfit.outfit?.[sourceSlot] === sourceItemId && recentOutfit.outfit?.[targetSlot] === item.id) {
        scores.recentLikedBoost += 0.25 * recencyWeight;
      }
    });

    const completedOutfit = { ...outfit, [slot]: item.id };
    const isComplete = visibleSlots.every((visibleSlot) => completedOutfit[visibleSlot]);
    if (isComplete && recentOutfit.key === getOutfitKey(completedOutfit, layering)) {
      scores.recentExactPenalty -= 0.45 * recencyWeight;
    }
  });

  return scores;
}

function getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences) {
  return {
    weightContrast: getWeightContrastScore(item, pickedItems),
    styleConflict: getCrossStyleConflictScore(item, pickedItems, selectedStyles),
    hotOuterwear: getHotOuterwearScore(item, slot, climatePreferences),
    lonelyExtremes: getLonelyExtremesScore(item, slot, outfit, itemsById)
  };
}

function getStyleCoherenceScore(item, selectedStyles, preferredStyles) {
  const itemStyles = getItemStyleTags(item);
  const isAthleisureOnly = itemStyles.length === 1 && itemStyles[0] === "Athleisure";
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const styleMode = resolveSelectedStyleMode(selectedStyles);

  if (!itemStyles.length) return 0;

  let score = 0;

  if (selectedStyles.length) {
    if (selectedStyles.some((style) => itemStyles.includes(style))) {
      score += 4;
    } else {
      score -= isAthleisureOnly ? 4 : 1.5;
    }

    if ((styleMode === "formal" || styleMode === "formal-bridge") && hasType("t-shirt", "sport t-shirt", "ls t-shirt", "ls t-shirt (light)")) {
      score -= 3;
    }
  }

  if (preferredStyles.size) {
    const overlapCount = itemStyles.filter((style) => preferredStyles.has(style)).length;
    score += overlapCount * 2;
    if (!overlapCount && itemStyles.length) {
      score -= isAthleisureOnly && !preferredStyles.has("Athleisure") ? 3 : 1;
    }
  }

  return score;
}

function getAffinityScore(item, slot, outfit, outfitAffinity) {
  const affinity = normalizeAffinityMap(outfitAffinity);
  let score = 0;

  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    if (targetSlot !== slot) return;

    const sourceItemId = outfit?.[sourceSlot];
    if (!sourceItemId) return;

    const pairCount = affinity[buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, item.id)] ?? 0;
    score += Math.min(pairCount * 0.85, 3.4);
  });

  const itemCount = affinity[buildAffinityItemKey(slot, item.id)] ?? 0;
  score += Math.min(itemCount * 0.25, 1.5);

  return score;
}

export function getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  const pickedItems = getPickedOutfitItems(outfit, itemsById);
  const selectedStyles = outfitFilters.style ?? [];
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const preferredStyles = getDominantStyleTags(pickedItems);
  const styleMode = getDominantStyleMode(selectedStyles, pickedItems);
  const breakdown = {
    climate: getClimateScore(item, slot, climatePreferences),
    styleCoherence: getStyleCoherenceScore(item, selectedStyles, preferredStyles),
    styleCompletion: getStyleCompletionScore(item, slot, styleMode),
    dominance: getDominancePenaltyScore(item, pickedItems, styleMode),
    ...getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences),
    baseline: getBaselineOutfitScore(item, slot),
    earlyAnchor: getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles),
    selectedStyleBonus: 0,
    favorite: item.favorite ? 0.5 : 0,
    affinity: getAffinityScore(item, slot, outfit, outfitAffinity),
    recentItemPenalty: 0,
    recentExactPenalty: 0,
    recentLikedBoost: 0,
    coldOuterwear: 0
  };

  if (slot === "TopOuter") {
    if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
      breakdown.coldOuterwear += item.garmentType === "Outerwear" ? 3 : -4;
    }

    if (climatePreferences.includes("Hot")) {
      breakdown.hotOuterwear += item.garmentType === "Outerwear" ? -3 : 0;
    }
  }

  if ((slot === "TopInner" || slot === "Bottom" || slot === "Footwear") && selectedStyles.length) {
    breakdown.selectedStyleBonus += getItemStyleTags(item).some((style) => selectedStyles.includes(style)) ? 1 : 0;
  }

  const recentScores = getRecentMemoryScore(item, slot, outfit, recentOutfits, layering);
  breakdown.recentItemPenalty += recentScores.recentItemPenalty;
  breakdown.recentExactPenalty += recentScores.recentExactPenalty;
  breakdown.recentLikedBoost += recentScores.recentLikedBoost;

  const score = 1 + Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    score: Math.max(0.2, score),
    breakdown
  };
}

function scoreCandidateForGuidedGeneration(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering).score;
}

export function pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering) {
  if (!pool.length) return null;
  if (normalizeGenerationMode(generationMode) === "random") return pickRandom(pool);

  return pickWeightedRandom(
    pool.map((item) => ({
      item,
      weight: scoreCandidateForGuidedGeneration(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering)
    }))
  );
}

function isNonStackableTopType(item) {
  return (item.garmentType === "Top" || item.garmentType === "Outerwear") && nonStackableTopTypes.has(normalizeType(item.type));
}

function getOtherTopSlot(slot) {
  if (slot === "TopInner") return "TopOuter";
  if (slot === "TopOuter") return "TopInner";
  return null;
}

function filterPoolForLayeringRules(pool, slot, outfit, itemsById) {
  if (slot !== "TopInner" && slot !== "TopOuter") return pool;

  const otherTopSlot = getOtherTopSlot(slot);
  const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

  if (!otherItem || !isNonStackableTopType(otherItem)) return pool;

  const blockedType = normalizeType(otherItem.type);
  return pool.filter((item) => normalizeType(item.type) !== blockedType);
}

function isHeavyOuterwear(item) {
  return item?.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy";
}

function isWarmWeatherConflictItem(item) {
  const type = normalizeType(item?.type);

  if (item?.garmentType === "Bottom") return type === "shorts";
  if (item?.garmentType === "Footwear") return ["slide", "slides", "sandal", "sandals"].includes(type);
  return false;
}

function isOutfitCompatible(outfit, itemsById) {
  const selectedItems = visibleSlots
    .map((slot) => itemsById[outfit[slot]])
    .filter(Boolean);

  return !selectedItems.some(isHeavyOuterwear) || !selectedItems.some(isWarmWeatherConflictItem);
}

function filterPoolForCompatibilityRules(pool, slot, outfit, itemsById) {
  if (!pool.length || !["TopOuter", "Bottom", "Footwear"].includes(slot)) return pool;

  const filtered = pool.filter((item) =>
    isOutfitCompatible(
      {
        ...outfit,
        [slot]: item.id
      },
      itemsById
    )
  );

  return filtered.length ? filtered : pool;
}

export function buildNextOutfit(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = []
) {
  const nextOutfit = { ...currentOutfit };
  let usedTopBoth = false;
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));

  visibleSlots.forEach((slot) => {
    if (!locked[slot]) nextOutfit[slot] = null;
  });

  visibleSlots.forEach((slot) => {
    if (locked[slot]) {
      if (slot === "TopInner" || slot === "TopOuter") {
        const lockedItem = itemsById[nextOutfit[slot]];
        if ((lockedItem?.garmentType === "Top" || lockedItem?.garmentType === "Outerwear") && lockedItem.layerType === "Both") {
          usedTopBoth = true;
        }
      }
      return;
    }

    if (!layering && slot === "TopOuter") {
      nextOutfit[slot] = null;
      return;
    }

    let pool = getPool(items, slot, excluded, generationLists, layering);

    if (slot === "TopInner" || slot === "TopOuter") {
      if (layering && usedTopBoth) pool = pool.filter((item) => item.layerType !== "Both");
      if (layering) pool = filterPoolForLayeringRules(pool, slot, nextOutfit, itemsById);

      pool = applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData);
      pool = filterPoolForCompatibilityRules(pool, slot, nextOutfit, itemsById);

      const nextItem = pickNextItemForGeneration(pool, slot, nextOutfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering);
      nextOutfit[slot] = nextItem?.id ?? null;

      if (nextItem?.layerType === "Both") usedTopBoth = true;
      return;
    }

    pool = applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData);
    pool = filterPoolForCompatibilityRules(pool, slot, nextOutfit, itemsById);
    nextOutfit[slot] = pickNextItemForGeneration(pool, slot, nextOutfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering)?.id ?? null;
  });

  return nextOutfit;
}

export function summarizeGuidedExplanation(outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  const aggregated = {};
  const contextOutfit = {};

  visibleSlots.forEach((slot) => {
    const itemId = outfit?.[slot];
    const item = itemId ? itemsById[itemId] : null;
    if (!item) return;

    const { breakdown } = getGuidedScoreBreakdown(item, slot, contextOutfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering);

    Object.entries(breakdown).forEach(([key, value]) => {
      if (!value) return;
      aggregated[key] = (aggregated[key] ?? 0) + value;
    });

    contextOutfit[slot] = itemId;
  });

  return Object.entries(aggregated)
    .filter(([, value]) => Math.abs(value) >= 0.2)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

export function normalizeOutfitFilters(outfitFilters) {
  return Object.fromEntries(
    Object.entries(outfitFilterOptions).map(([group, options]) => [
      group,
      Array.isArray(outfitFilters?.[group])
        ? outfitFilters[group].filter((value) => options.includes(value))
        : []
    ])
  );
}

export function normalizeLikedOutfitKeys(value) {
  return normalizeBooleanLookup(value);
}

export function normalizeOutfitAffinity(value) {
  return normalizeAffinityMap(value);
}
