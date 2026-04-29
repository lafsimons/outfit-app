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
export const RECENT_OUTFIT_WINDOW = 8;
export const noFilterStyleWeights = {
  Casual: 0.35,
  "Smart Casual": 0.3,
  Athleisure: 0.2,
  Formal: 0.15
};
const GUIDED_BASE_SCORE = 0.8;
const GUIDED_SCORE_FLOOR = 0.3;
const MAX_RECENT_ITEM_PENALTY = -0.8;
const MAX_RECENT_EXACT_PENALTY = -0.5;
const MAX_STYLE_STREAK_PENALTY = -0.5;
const MAX_AFFINITY_BOOST = 0.5;
const recentItemPenaltySteps = [0.22, 0.11, 0.04, 0.02, 0.01];
const recentSlotPenaltySteps = [0.08, 0.04, 0.01, 0.005, 0.005];
const recentExactPenaltySteps = [0.4, 0.2, 0.1, 0.05];
const recentLikedBoostSteps = [0.12, 0.08, 0.04, 0.02];
const guidedScoreNormalizers = {
  climate: { scale: 0.45, min: -1.5, max: 2 },
  styleCoherence: { scale: 0.28, min: -3, max: 2.5 },
  styleCompletion: { scale: 0.4, min: 0, max: 2.5 },
  dominance: { scale: 0.6, min: -2, max: 0 },
  weightContrast: { scale: 0.6, min: -1, max: 0 },
  styleConflict: { scale: 0.65, min: -1.5, max: 0 },
  hotOuterwear: { scale: 0.65, min: -1.5, max: 0 },
  lonelyExtremes: { scale: 0.6, min: -0.8, max: 0 },
  baseline: { scale: 0.7, min: 0, max: 1 },
  earlyAnchor: { scale: 0.55, min: 0, max: 1.2 },
  selectedStyleBonus: { scale: 0.45, min: 0, max: 1.4 },
  favorite: { scale: 0.6, min: 0, max: 0.3 },
  affinity: { scale: 1, min: 0, max: MAX_AFFINITY_BOOST },
  recentItemPenalty: { scale: 1, min: MAX_RECENT_ITEM_PENALTY, max: 0 },
  recentExactPenalty: { scale: 1, min: MAX_RECENT_EXACT_PENALTY, max: 0 },
  recentLikedBoost: { scale: 1, min: 0, max: 0.35 },
  coldOuterwear: { scale: 0.45, min: -1.2, max: 1 },
  noFilterVariety: { scale: 0.14, min: -0.4, max: 1 },
  coldLightTopPenalty: { scale: 0.28, min: -1.2, max: 0 },
  mismatchedSeasonality: { scale: 0.32, min: -1.8, max: 0 },
  styleStreakPenalty: { scale: 1, min: MAX_STYLE_STREAK_PENALTY, max: 0 }
};

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
  coldOuterwear: "Outerwear added for cold",
  noFilterVariety: "No-filter style variety",
  coldLightTopPenalty: "Cold light-top penalty",
  mismatchedSeasonality: "Mixed-season penalty",
  styleStreakPenalty: "Style streak penalty"
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

export function pickRandom(items) {
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

export function isEligibleForGeneration(item, excluded = {}, generationLists = defaultGenerationLists) {
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

function getEligibleSlotPoolInternal(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  let pool = getPool(items, slot, excluded, generationLists, layering);

  if (layering && (slot === "TopInner" || slot === "TopOuter")) {
    const otherTopSlot = getOtherTopSlot(slot);
    const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

    if (otherItem?.layerType === "Both") {
      pool = pool.filter((item) => item.layerType !== "Both");
    }

    pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
  }

  pool = applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit, itemsById, {
    ...ruleOptions,
    excluded,
    generationLists,
    items,
    layering
  });
  return filterPoolForCompatibilityRules(pool, slot, outfit, itemsById);
}

export function getEligibleSlotPool(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  return getEligibleSlotPoolInternal(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById, ruleOptions);
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

  return [];
}

function getPickedOutfitItems(outfit, itemsById) {
  return visibleSlots.map((slot) => itemsById[outfit[slot]]).filter(Boolean);
}

const climateTieBreakPriority = {
  Transitional: 5,
  Warm: 4,
  Hot: 3,
  Cold: 2,
  Snow: 1,
  Rain: 0
};

function getOutfitClimateWeight(item, slot) {
  const weight = normalizeWeight(item.weight);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopOuter") {
    if (item.garmentType !== "Outerwear") return 1.9;
    if (weight === "Heavy") {
      return hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket") ? 4.6 : 4.1;
    }
    return weight === "Medium" ? 3.2 : 2.7;
  }
  if (slot === "TopInner") return weight === "Heavy" ? 1.8 : weight === "Medium" ? 1.45 : 1.1;
  if (slot === "Bottom") return weight === "Heavy" ? 2.1 : 1.9;
  if (slot === "Footwear") return weight === "Heavy" ? 2.8 : 2.2;
  if (slot === "Headwear") return 0.55;
  return 1;
}

function scoreOutfitClimate(items) {
  const scores = Object.fromEntries(climateTagOptions.map((climate) => [climate, 0]));
  let rainSignalCount = 0;
  let hasHeavyOuterwear = false;
  let hasHeavyColdOuterwear = false;
  let hasBoots = false;
  let hasColdHeadwear = false;
  let warmWeatherSignalCount = 0;

  items.forEach(({ item, slot }) => {
    const typeMatches = getTypeMatchKeys(item.type);
    const hasType = (...types) => types.some((type) => typeMatches.has(type));
    const itemClimateTags = new Set(getItemClimateTags(item));
    const baseWeight = getOutfitClimateWeight(item, slot);
    const itemWeight = normalizeWeight(item.weight);

    itemClimateTags.forEach((climate) => {
      scores[climate] += baseWeight;
    });

    if (slot === "TopOuter" && item.garmentType === "Outerwear") {
      if (itemWeight === "Heavy") {
        hasHeavyOuterwear = true;
        scores.Cold += 2.6;
        scores.Snow += 1.1;
        if (hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket")) {
          hasHeavyColdOuterwear = true;
          scores.Cold += 2.2;
          scores.Transitional -= 0.4;
        }
      } else if (itemWeight === "Medium") {
        scores.Transitional += 1.2;
        if (hasType("jacket", "wool jacket", "blazer")) {
          scores.Transitional += 0.5;
        }
      }

      if (hasType("shell jacket")) {
        scores.Rain += 2.2;
        scores.Transitional += 0.8;
        rainSignalCount += 2;
      }
    }

    if (slot === "TopInner") {
      if (hasType("hoodie", "sweatshirt", "knit sweater", "fleece sweater")) {
        scores.Cold += 0.65;
        scores.Transitional += 0.8;
      }
      if (hasType("sport t-shirt", "t-shirt")) {
        scores.Warm += 0.55;
        scores.Hot += 0.35;
        warmWeatherSignalCount += 1;
      }
      if (hasType("shirt")) {
        scores.Transitional += 0.45;
      }
    }

    if (slot === "Bottom") {
      if (hasType("shorts", "sport shorts")) {
        scores.Hot += 1.6;
        scores.Warm += 1.1;
        warmWeatherSignalCount += 1;
      }
      if (hasType("trousers", "jeans", "sport pants", "sweat pants")) {
        scores.Transitional += 0.7;
      }
    }

    if (slot === "Footwear") {
      if (hasType("boots")) {
        hasBoots = true;
        scores.Cold += 1.9;
        scores.Rain += 0.8;
        scores.Transitional += 0.35;
        rainSignalCount += 1;
      }
      if (hasType("slides", "sandals")) {
        scores.Hot += 1.4;
        scores.Warm += 0.8;
        warmWeatherSignalCount += 1;
      }
      if (hasType("sneakers", "canvas sneakers")) {
        scores.Warm += 0.5;
        scores.Transitional += 0.4;
      }
    }

    if (slot === "Headwear") {
      if (hasType("beanie")) {
        hasColdHeadwear = true;
        scores.Cold += itemWeight === "Light" ? 0.45 : 0.8;
      }
      if (hasType("cap", "sport cap")) {
        scores.Rain += 0.5;
        scores.Warm += 0.3;
        rainSignalCount += 1;
      }
    }
  });

  if (rainSignalCount >= 3) {
    scores.Rain += 1.8;
  }

  if (scores.Rain < 3.2) {
    scores.Rain -= 1.2;
  }

  if (scores.Hot > 0 && scores.Warm >= scores.Hot - 0.75) {
    scores.Warm += 0.6;
  }

  if (scores.Snow > 0 && scores.Cold >= scores.Snow - 0.9) {
    scores.Cold += 0.6;
  }

  if (scores.Transitional > 0 && scores.Warm > 0 && Math.abs(scores.Transitional - scores.Warm) <= 1.1) {
    scores.Transitional += 0.55;
  }

  if (hasHeavyOuterwear && hasBoots) {
    scores.Cold += 3.2;
    scores.Warm -= 1.8;
    scores.Hot -= 2.2;
  } else if (hasHeavyColdOuterwear && hasColdHeadwear) {
    scores.Cold += 2.2;
    scores.Warm -= 1.2;
  } else if (hasHeavyColdOuterwear) {
    scores.Cold += 1.5;
    scores.Warm -= 0.9;
  }

  if (hasHeavyOuterwear && warmWeatherSignalCount < 2) {
    scores.Warm -= 0.9;
    scores.Hot -= 1.4;
  }

  return scores;
}

export function getCurrentOutfitClimateChip(items) {
  if (!items?.length) {
    return "Everyday";
  }

  const slottedItems = items
    .map((entry) => (entry?.item ? entry : entry ? { item: entry, slot: "Unknown" } : null))
    .filter(Boolean);

  if (!slottedItems.length) {
    return "Everyday";
  }

  const scores = scoreOutfitClimate(slottedItems);
  const ranked = Object.entries(scores).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return (climateTieBreakPriority[right[0]] ?? -1) - (climateTieBreakPriority[left[0]] ?? -1);
  });

  if (!ranked.length || ranked[0][1] <= 0.75) {
    return "Everyday";
  }

  return ranked[0][0];
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

function rankStyleCounts(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function resolveDominantStyleFromCounts(counts, selectedStyles = []) {
  const ranked = rankStyleCounts(counts);

  if (!ranked.length) {
    return selectedStyles?.[0] ?? "Casual";
  }

  const topScore = ranked[0][1];
  const closeSelectedMatch = (selectedStyles ?? []).find((style) => (counts.get(style) ?? 0) >= topScore - 1);

  if (closeSelectedMatch) {
    return closeSelectedMatch;
  }

  const tiedStyles = ranked.filter(([, score]) => score === topScore).map(([style]) => style);
  const selectedMatch = (selectedStyles ?? []).find((style) => tiedStyles.includes(style));
  return selectedMatch ?? tiedStyles[0];
}

function styleToMode(style) {
  if (style === "Formal") return "formal";
  if (style === "Smart Casual") return "smart-casual";
  if (style === "Athleisure") return "athleisure";
  return "casual";
}

function modeToStyle(styleMode) {
  if (styleMode === "formal" || styleMode === "formal-bridge") return "Formal";
  if (styleMode === "smart-casual") return "Smart Casual";
  if (styleMode === "athleisure") return "Athleisure";
  return "Casual";
}

function clampScore(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuidedScoreComponent(key, value) {
  const config = guidedScoreNormalizers[key];
  if (!config) {
    return value;
  }

  const scaledValue = value * config.scale;
  return clampScore(scaledValue, config.min, config.max);
}

function normalizeGuidedBreakdown(breakdown) {
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, normalizeGuidedScoreComponent(key, value)])
  );
}

export function classifyOutfitStyle(items, selectedStyles = []) {
  return resolveDominantStyleFromCounts(getDominantStyleCounts(items), selectedStyles);
}

export function getOutfitDominantStyle(outfit, itemsById, selectedStyles = []) {
  return classifyOutfitStyle(getPickedOutfitItems(outfit, itemsById), selectedStyles);
}

function getRecentDominantStyles(recentOutfits, itemsById, selectedStyles = []) {
  return normalizeRecentOutfits(recentOutfits)
    .map((entry) => classifyOutfitStyle(getPickedOutfitItems(entry.outfit, itemsById), selectedStyles))
    .filter(Boolean);
}

export function getCurrentOutfitStyleChip(items, selectedStyles) {
  return classifyOutfitStyle(items, selectedStyles);
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
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.6;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 1.5 : 4.5;
      }
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
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.1;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 0.8 : 2.6;
      }
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

function getFormalCoreSlots(layering) {
  return layering ? ["TopInner", "Bottom", "Footwear", "TopOuter"] : ["TopInner", "Bottom", "Footwear"];
}

function isStrongFormalAnchor(item, slot) {
  if (!item) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopInner") {
    return hasType("shirt");
  }

  if (slot === "Bottom") {
    return hasType("trousers", "light trousers", "heavy wool trousers");
  }

  if (slot === "Footwear") {
    return hasType("derby");
  }

  if (slot === "TopOuter") {
    return hasType("blazer", "wool coat", "wool jacket");
  }

  return false;
}

function isFormalBridgeItem(item, slot) {
  if (!item || isStrongFormalAnchor(item, slot)) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const itemStyles = getItemStyleTags(item);
  const hasSmartCasual = itemStyles.includes("Smart Casual");
  const hasFormal = itemStyles.includes("Formal");
  const hasCasual = itemStyles.includes("Casual");
  const hasAthleisure = itemStyles.includes("Athleisure");

  if (hasAthleisure) return false;
  if (hasType("leather sneakers", "boots", "light boots", "boots (chunky, winter, lined)", "knit", "knit sweater", "thick knit sweater", "knit vest")) {
    return true;
  }

  return hasSmartCasual && !hasFormal && hasCasual;
}

function countFormalStructure(outfit, itemsById, layering) {
  return getFormalCoreSlots(layering).reduce(
    (counts, slot) => {
      const item = itemsById[outfit[slot]];

      if (isStrongFormalAnchor(item, slot)) counts.formal += 1;
      else if (isFormalBridgeItem(item, slot)) counts.bridge += 1;

      return counts;
    },
    { formal: 0, bridge: 0 }
  );
}

function hasPotentialFormalAnchorForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => isStrongFormalAnchor(candidate, slot));
}

function hasPotentialNonBridgeForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => !isFormalBridgeItem(candidate, slot));
}

function passesFormalStructureRules(item, currentOutfit, slot, itemsById, context = {}) {
  const layering = context.layering ?? true;
  const nextOutfit = {
    ...currentOutfit,
    [slot]: item.id
  };
  const topInner = itemsById[nextOutfit.TopInner];
  const bottom = itemsById[nextOutfit.Bottom];
  const footwear = itemsById[nextOutfit.Footwear];
  const counts = countFormalStructure(nextOutfit, itemsById, layering);
  const remainingSlots = getFormalCoreSlots(layering).filter((coreSlot) => !nextOutfit[coreSlot]);
  const potentialFormalAnchors = remainingSlots.filter((coreSlot) => hasPotentialFormalAnchorForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const forcedBridgeSlots = remainingSlots.filter((coreSlot) => !hasPotentialNonBridgeForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const topInnerNeedsFormalAnchor = !topInner ? hasPotentialFormalAnchorForSlot("TopInner", nextOutfit, itemsById, context) : isStrongFormalAnchor(topInner, "TopInner");
  const bottomNeedsFormalAnchor = !bottom ? hasPotentialFormalAnchorForSlot("Bottom", nextOutfit, itemsById, context) : isStrongFormalAnchor(bottom, "Bottom");

  if (counts.bridge > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < 2) {
    return false;
  }

  if (counts.bridge + forcedBridgeSlots > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < counts.bridge + forcedBridgeSlots) {
    return false;
  }

  if (footwear && isFormalBridgeItem(footwear, "Footwear")) {
    if (!topInnerNeedsFormalAnchor || !bottomNeedsFormalAnchor) {
      return false;
    }
  }

  if (bottom && !isStrongFormalAnchor(bottom, "Bottom")) {
    if (footwear) {
      if (!isStrongFormalAnchor(footwear, "Footwear")) {
        return false;
      }
    } else if (!hasPotentialFormalAnchorForSlot("Footwear", nextOutfit, itemsById, context)) {
      return false;
    }
  }

  return true;
}

function resolveSelectedStyleMode(selectedStyles) {
  const uniqueStyles = [...new Set((selectedStyles ?? []).filter(Boolean))];

  if (!uniqueStyles.length) return "no-filter";
  if (uniqueStyles.every((style) => style === "Casual")) return "casual";

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
    blockNoFilterSportCap: styleMode === "no-filter",
    blockFormalSet: styleMode === "formal",
    blockFormalBridgeSet: styleMode === "formal-bridge",
    blockSmartCasualSet: styleMode === "smart-casual",
    blockAthleisureSet: styleMode === "athleisure"
  };
}

function getAnchoredStyle(outfit, itemsById, selectedStyles = []) {
  const pickedItems = getPickedOutfitItems(outfit, itemsById);
  if (
    !(selectedStyles ?? []).length &&
    pickedItems.some((item) => {
      const typeMatches = getTypeMatchKeys(item.type);
      return typeMatches.has("sport cap") || typeMatches.has("sport t-shirt") || typeMatches.has("sport ls t-shirt") || typeMatches.has("sport shorts");
    })
  ) {
    return "Athleisure";
  }

  if (pickedItems.length < 2) return null;

  const counts = getDominantStyleCounts(pickedItems);
  const ranked = rankStyleCounts(counts);
  const dominantEntry = ranked[0];

  if (!dominantEntry || dominantEntry[1] < 2) return null;

  return dominantEntry[0];
}

function passesSelectedStyleRules(item, slot, selectedStyles, outfit = {}, itemsById = {}, context = {}) {
  const styleMode = resolveSelectedStyleMode(selectedStyles);
  const profile = getStyleBlockProfile(styleMode);
  const anchoredStyle = getAnchoredStyle(outfit, itemsById, selectedStyles);

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

  if (profile.blockNoFilterSportCap && hasType("sport cap") && anchoredStyle && anchoredStyle !== "Athleisure") {
    return false;
  }

  if (profile.blockFormalSet) {
    if (hasType("shorts", "slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "hoodie", "sweatshirt", "sport t-shirt", "fleece sweater")) {
      return false;
    }
    if (isAthleisureOnly || isAthleisureSneaker(item)) {
      return false;
    }
    if (slot === "Footwear") {
      const itemStyles = getItemStyleTags(item);
      const hasSmartCasual = itemStyles.includes("Smart Casual");
      const hasFormal = itemStyles.includes("Formal");
      const hasCasual = itemStyles.includes("Casual");
      const hasAthleisure = itemStyles.includes("Athleisure");
      const isBridgeFootwear =
        hasFormal ||
        hasSmartCasual ||
        (hasCasual && hasSmartCasual && !hasAthleisure) ||
        (hasType("leather sneakers") && !hasAthleisure);

      if (!isBridgeFootwear) {
        return false;
      }
    }
    if (!context.skipFormalStructure && !passesFormalStructureRules(item, outfit, slot, itemsById, context)) {
      return false;
    }
  }

  if (profile.blockFormalBridgeSet && hasFormalBridgeBlockedType) return false;

  if (profile.blockSmartCasualSet) {
    if (hasType("slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "sport t-shirt", "sport ls t-shirt", "sport shorts", "fleece sweater", "hoodie", "sweatshirt", "sneakers", "sneakers (thin)", "canvas sneakers")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (profile.blockAthleisureSet) {
    if (hasType("derby", "wool coat", "wool jacket", "blazer", "shirt", "wool shirt") || isFormalOnly) {
      return false;
    }
    if (getItemStyleTags(item).every((style) => style === "Smart Casual" || style === "Formal")) {
      return false;
    }
  }

  if (anchoredStyle === "Smart Casual" || anchoredStyle === "Formal") {
    if (hasType("sport cap", "sport t-shirt", "sport ls t-shirt", "sport shorts")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (anchoredStyle === "Athleisure") {
    if (hasType("derby", "jacket", "jeans", "boots") || isFormalOnly) {
      return false;
    }
  }

  return true;
}

function passesHardContextRules(item, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const selectedStyles = outfitFilters.style ?? [];
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const existingTopInner = itemsById[outfit.TopInner];
  const existingTopOuter = itemsById[outfit.TopOuter];
  const existingBottom = itemsById[outfit.Bottom];
  const existingTopInnerMatches = existingTopInner ? getTypeMatchKeys(existingTopInner.type) : new Set();
  const existingTopOuterWeight = normalizeWeight(existingTopOuter?.weight);
  const hasLightOrSportTop =
    existingTopInner &&
    normalizeWeight(existingTopInner.weight) === "Light" &&
    ["t-shirt", "ls t-shirt", "sport t-shirt", "sport ls t-shirt"].some((type) => existingTopInnerMatches.has(type));
  const hasSmartShirtTop =
    existingTopInner &&
    existingTopInner.garmentType === "Top" &&
    existingTopInnerMatches.has("shirt") &&
    getItemStyleTags(existingTopInner).some((style) => style === "Smart Casual" || style === "Formal");

  if (climatePreferences.includes("Hot")) {
    if (slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") return false;
    if (hasType("wool coat")) return false;
    if (slot === "Headwear" && hasType("beanie")) return false;
  }

  if (climatePreferences.includes("Warm")) {
    if (slot === "Headwear" && hasType("beanie") && normalizeWeight(item.weight) !== "Light") return false;
  }

  if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
    if (hasType("shorts", "slides", "sandals")) return false;
    if (slot === "TopInner" && hasType("sport t-shirt", "sport ls t-shirt")) return false;
    if (hasLightOrSportTop && ((slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") || (slot === "Footwear" && hasType("boots")))) {
      return false;
    }
  }

  if (climatePreferences.includes("Rain")) {
    if (hasType("slides", "sandals")) return false;
  }

  if (
    hasSmartShirtTop &&
    ((slot === "Bottom" && hasType("shorts")) ||
      (slot === "TopOuter" && item.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(normalizeWeight(item.weight)) && existingBottom && getTypeMatchKeys(existingBottom.type).has("shorts")) ||
      (slot === "Bottom" && hasType("shorts") && existingTopOuter && existingTopOuter.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(existingTopOuterWeight)))
  ) {
    return false;
  }

  return passesSelectedStyleRules(item, slot, selectedStyles, outfit, itemsById, {
    ...context,
    outfitFilters,
    weatherData
  });
}

export function applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const filtered = pool.filter((item) => passesHardContextRules(item, slot, outfitFilters, weatherData, outfit, itemsById, context));
  return filtered.length ? filtered : pool;
}

function getDominantStyleMode(selectedStyles, pickedItems, noFilterData = null) {
  const selectedStyleMode = resolveSelectedStyleMode(selectedStyles);
  const counts = getDominantStyleCounts(pickedItems);

  if (pickedItems.length < 2) {
    return selectedStyleMode === "no-filter" ? noFilterData?.targetMode ?? "casual" : selectedStyleMode;
  }

  const dominantEntry = rankStyleCounts(counts)[0];
  if (!dominantEntry || dominantEntry[1] < 2) return selectedStyleMode;

  return styleToMode(dominantEntry[0]);
}

function getPoolStyleSupport(pool) {
  const counts = {};
  let total = 0;

  pool.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts[style] = (counts[style] ?? 0) + 1;
      total += 1;
    });
  });

  return Object.fromEntries(
    Object.entries(noFilterStyleWeights).map(([style, weight]) => [
      style,
      total ? (counts[style] ?? 0) / total : weight
    ])
  );
}

function getAdjustedNoFilterWeights(recentStyles, support, anchoredStyle = null) {
  if (anchoredStyle) {
    return Object.fromEntries(
      Object.keys(noFilterStyleWeights).map((style) => [style, style === anchoredStyle ? 1 : 0.1])
    );
  }

  const recentWindow = Math.max(recentStyles.length, 4);
  const recentCounts = Object.fromEntries(Object.keys(noFilterStyleWeights).map((style) => [style, 0]));

  recentStyles.forEach((style) => {
    if (recentCounts[style] !== undefined) recentCounts[style] += 1;
  });

  const streakStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
  const lastStyle = recentStyles[0] ?? null;

  return Object.fromEntries(
    Object.entries(noFilterStyleWeights).map(([style, baseWeight]) => {
      const recentShare = recentCounts[style] / recentWindow;
      const absenceBoost = recentCounts[style] === 0 ? (style === "Athleisure" ? 0.24 : 0.16) : recentCounts[style] === 1 ? (style === "Athleisure" ? 0.1 : 0.06) : 0;
      const oversharePenalty = Math.max(0, recentShare - baseWeight) * 1.8;
      const streakPenalty = streakStyle === style ? 1.05 : lastStyle === style ? 0.24 : 0;
      const supportMultiplier = Math.max(0.2, Math.min(style === "Formal" ? 1.08 : 1.15, (support?.[style] ?? 0.25) * 1.6));
      const styleBias = style === "Smart Casual" ? 1.1 : style === "Formal" ? 0.82 : 1;
      return [style, Math.max(0.02, (baseWeight + absenceBoost - oversharePenalty - streakPenalty) * supportMultiplier * styleBias)];
    })
  );
}

function pickWeightedStyle(weights) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return "Casual";

  let remaining = Math.random() * totalWeight;
  for (const [style, weight] of entries) {
    remaining -= weight;
    if (remaining <= 0) return style;
  }

  return entries.at(-1)?.[0] ?? "Casual";
}

function getEligibleStyleSupport(items, excluded, generationLists) {
  return getPoolStyleSupport(
    items.filter((item) => isEligibleForGeneration(item, excluded, generationLists) && visibleSlots.some((slot) => getPool([item], slot, {}, generationLists).length))
  );
}

function buildNoFilterGenerationContext(items, excluded, generationLists, recentOutfits, itemsById) {
  const support = getEligibleStyleSupport(items, excluded, generationLists);
  const recentStyles = getRecentDominantStyles(recentOutfits, itemsById);
  const weights = getAdjustedNoFilterWeights(recentStyles, support, null);
  const repeatedRecentStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
  const targetCandidates = repeatedRecentStyle
    ? Object.fromEntries(
        Object.entries(weights).map(([style, weight]) => [
          style,
          style === repeatedRecentStyle && Object.entries(weights).some(([otherStyle, otherWeight]) => otherStyle !== style && otherWeight > 0.08)
            ? 0
            : weight
        ])
      )
    : weights;
  const targetStyle = pickWeightedStyle(targetCandidates);

  return {
    support,
    weights,
    targetStyle,
    targetMode: styleToMode(targetStyle),
    avoidStyle: repeatedRecentStyle
  };
}

function getNoFilterPreference(item, noFilterData) {
  const itemStyles = getItemStyleTags(item);
  if (!noFilterData || !itemStyles.length) return 0;

  const styleWeight = itemStyles.reduce((sum, style) => sum + (noFilterData.weights[style] ?? 0), 0) / itemStyles.length;
  const supportWeight = itemStyles.reduce((sum, style) => sum + (noFilterData.support[style] ?? 0.25), 0) / itemStyles.length;
  const anchoredStyle = noFilterData.anchoredStyle;
  const isFormalOnly = isFormalOnlyItem(item);
  const isAthleisureOnly = isAthleisureOnlyItem(item);

  let score = styleWeight * 4.4 + supportWeight * 1.2;
  const targetStyle = noFilterData.targetStyle;
  const avoidStyle = noFilterData.avoidStyle;

  if (anchoredStyle) {
    if (itemStyles.includes(anchoredStyle)) score += anchoredStyle === "Formal" ? 3.2 : 2.4;
    else if (anchoredStyle === "Formal" && itemStyles.includes("Athleisure")) score -= 4;
    else if (anchoredStyle === "Smart Casual" && isAthleisureOnly) score -= 3.5;
    else if (anchoredStyle === "Athleisure" && isFormalOnly) score -= 4;
  } else {
    if (itemStyles.includes("Smart Casual")) score += 0.85;
    if (isFormalOnly && (noFilterData.weights.Formal ?? 0) < 0.14) score -= 0.7;
    if (isFormalOnly) score -= 0.15;
    if (isAthleisureOnly && (noFilterData.weights.Athleisure ?? 0) < 0.22) score -= 1.2;
    if (isAthleisureOnly && (noFilterData.weights.Athleisure ?? 0) >= 0.22) score += 1.4;
    if (targetStyle && itemStyles.includes(targetStyle)) {
      score += targetStyle === "Formal" ? 2.9 : 1.8;
    }
    if (targetStyle === "Formal" && itemStyles.includes("Smart Casual")) {
      score += 1.1;
    }
    if (avoidStyle && itemStyles.includes(avoidStyle)) {
      score -= itemStyles.length === 1 ? 4.4 : 3.4;
    }
  }

  return score;
}

function getStyleCompletionScore(item, slot, styleMode) {
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  let score = 0;

  if (styleMode === "formal") {
    if (slot === "TopInner" && hasType("shirt")) score += 6;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 6;
    if (slot === "Footwear" && hasType("derby")) score += 6;
    if (slot === "Footwear" && getItemStyleTags(item).includes("Formal")) score += 2.4;
    if (slot === "TopOuter" && hasType("blazer", "wool coat")) score += 6;
    if (item.garmentType === "Accessory" && item.accessorySlot === "LeftHand" && hasType("watch")) score += 1.5;
    if (item.garmentType === "Accessory" && item.accessorySlot === "Belt" && hasType("belt")) score += 1.2;
    if (slot === "Headwear" && hasType("hat")) score += 1.5;
    if (slot === "Headwear" && hasType("cap")) score -= 2.6;
    if (slot === "Bottom" && hasType("jeans")) score -= 2.5;
    if (slot === "TopInner" && hasType("t-shirt", "ls t-shirt")) score -= 2.4;
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
    if (slot === "TopInner" && hasType("shirt", "casual shirt", "knit", "knit sweater", "wool shirt", "fleece sweater")) score += hasType("shirt", "wool shirt") ? 4.8 : 3.8;
    if (slot === "Footwear" && hasType("leather sneakers", "boots", "derby")) score += hasType("leather sneakers") ? 4.2 : hasType("boots") ? 2.8 : 1.6;
    if (slot === "TopOuter" && hasType("jacket", "twill jacket", "blazer", "wool coat", "wool jacket")) score += hasType("blazer", "wool coat") ? 4.2 : 3.2;
    if (slot === "Headwear" && hasType("hat")) score += 1;
    if (slot === "Bottom" && hasType("trousers", "light trousers")) score += 3.5;
    if (slot === "Bottom" && hasType("jeans")) score += 1.2;
  }

  if (styleMode === "athleisure") {
    if (slot === "TopInner" && hasType("hoodie", "sweatshirt", "sport t-shirt", "sport ls t-shirt", "fleece sweater")) score += hasType("sport t-shirt", "sport ls t-shirt") ? 5 : 4.4;
    if (slot === "Footwear" && hasType("sneakers", "sneakers (thin)", "canvas sneakers")) score += 4.8;
    if (slot === "Headwear" && hasType("cap", "sport cap")) score += hasType("sport cap") ? 4.8 : 3.8;
    if (slot === "TopOuter" && hasType("shell jacket", "fleece jacket")) score += 4.4;
    if (slot === "Bottom" && hasType("sport shorts", "sport pants", "sweat pants", "shorts")) score += hasType("sport shorts", "sport pants") ? 4.8 : hasType("sweat pants") ? 4.2 : 1.8;
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

  if (slot === "TopInner" && hasType("t-shirt", "shirt")) return hasType("shirt") ? 0.9 : 0.8;
  if (slot === "Bottom" && hasType("jeans", "trousers", "light trousers")) return 1.2;
  if (slot === "Footwear" && hasType("sneakers", "leather sneakers")) return 1.2;
  return 0;
}

function getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles, noFilterData) {
  if (pickedItems.length >= 2 || slot === "Headwear") return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const selectedStyleSet = new Set(selectedStyles ?? []);
  const noFilterWeights = noFilterData?.weights ?? noFilterStyleWeights;
  const isNoFilter = !selectedStyleSet.size;

  if (hasType("shirt")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 2.2 : isNoFilter ? 1.2 + noFilterWeights["Smart Casual"] * 1.8 : 1.3;
  if (hasType("hoodie", "sport t-shirt", "sport ls t-shirt", "sweatshirt")) return selectedStyleSet.has("Athleisure") ? 2.2 : isNoFilter ? 1.25 + noFilterWeights.Athleisure * 2.6 : 1.3;
  if (hasType("trousers", "light trousers", "derby")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 1.4 : isNoFilter ? 0.8 + (noFilterWeights["Smart Casual"] + noFilterWeights.Formal) * 1.1 : 0.8;
  if (hasType("sport shorts", "shell jacket", "fleece jacket")) return selectedStyleSet.has("Athleisure") ? 1.4 : isNoFilter ? 0.9 + noFilterWeights.Athleisure * 1.8 : 0.8;
  return 0;
}

function getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById) {
  const normalizedRecentOutfits = normalizeRecentOutfits(recentOutfits);
  const scores = { recentItemPenalty: 0, recentExactPenalty: 0, recentLikedBoost: 0, styleStreakPenalty: 0 };

  if (!normalizedRecentOutfits.length) return scores;

  const completedOutfit = { ...outfit, [slot]: item.id };
  const isComplete = visibleSlots.every((visibleSlot) => completedOutfit[visibleSlot]);
  const completedStyle = isComplete ? getOutfitDominantStyle(completedOutfit, itemsById) : null;

  normalizedRecentOutfits.forEach((recentOutfit, index) => {
    const itemPenalty = recentItemPenaltySteps[index] ?? 0;
    const slotPenalty = recentSlotPenaltySteps[index] ?? 0;
    const exactPenalty = recentExactPenaltySteps[index] ?? 0;
    const likedBoost = recentLikedBoostSteps[index] ?? 0;
    const itemUsed = visibleSlots.some((recentSlot) => recentOutfit.outfit?.[recentSlot] === item.id);
    if (itemUsed) {
      scores.recentItemPenalty -= itemPenalty;
      if (recentOutfit.outfit?.[slot] === item.id) {
        scores.recentItemPenalty -= slotPenalty;
      }
    }

    affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
      if (targetSlot !== slot || !recentOutfit.liked) return;
      const sourceItemId = outfit?.[sourceSlot];
      if (!sourceItemId) return;
      if (recentOutfit.outfit?.[sourceSlot] === sourceItemId && recentOutfit.outfit?.[targetSlot] === item.id) {
        scores.recentLikedBoost += likedBoost;
      }
    });

    if (isComplete && recentOutfit.key === getOutfitKey(completedOutfit, layering)) {
      scores.recentExactPenalty -= exactPenalty;
    }
  });

  if (completedStyle && normalizedRecentOutfits.length >= 2) {
    const recentStyles = getRecentDominantStyles(normalizedRecentOutfits, itemsById);
    if (recentStyles[0] === completedStyle && recentStyles[1] === completedStyle) {
      scores.styleStreakPenalty -= 0.5;
    } else if (recentStyles[0] === completedStyle) {
      scores.styleStreakPenalty -= 0.2;
    }
  }

  scores.recentItemPenalty = clampScore(scores.recentItemPenalty, MAX_RECENT_ITEM_PENALTY, 0);
  scores.recentExactPenalty = clampScore(scores.recentExactPenalty, MAX_RECENT_EXACT_PENALTY, 0);
  scores.styleStreakPenalty = clampScore(scores.styleStreakPenalty, MAX_STYLE_STREAK_PENALTY, 0);

  return scores;
}

function getColdLightTopPenalty(item, slot, outfit, itemsById, climatePreferences) {
  if (!climatePreferences.some((climate) => climate === "Cold" || climate === "Snow")) return 0;
  if (!["TopInner", "TopOuter", "Footwear"].includes(slot)) return 0;

  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const hasHeavyOuterwear = nextItems.some((candidate) => candidate.garmentType === "Outerwear" && normalizeWeight(candidate.weight) === "Heavy");
  const hasBoots = nextItems.some((candidate) => getTypeMatchKeys(candidate.type).has("boots"));
  const lightOrSportTop = nextItems.some((candidate) => {
    const typeMatches = getTypeMatchKeys(candidate.type);
    const hasType = (...types) => types.some((type) => typeMatches.has(type));
    if (candidate.garmentType !== "Top" && candidate.garmentType !== "Outerwear") return false;
    return normalizeWeight(candidate.weight) === "Light" && hasType("t-shirt", "ls t-shirt", "sport t-shirt", "sport ls t-shirt");
  });

  if (!lightOrSportTop) return 0;
  if (hasHeavyOuterwear && hasBoots) return -4.2;
  if (hasHeavyOuterwear || hasBoots) return -2.6;
  return 0;
}

function getMismatchedSeasonalityScore(item, slot, outfit, itemsById) {
  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const hasSmartInner = nextItems.some((candidate) => {
    const typeMatches = getTypeMatchKeys(candidate.type);
    return candidate.garmentType === "Top" && typeMatches.has("shirt") && getItemStyleTags(candidate).some((style) => style === "Smart Casual" || style === "Formal");
  });
  const hasShorts = nextItems.some((candidate) => candidate.garmentType === "Bottom" && getTypeMatchKeys(candidate.type).has("shorts"));
  const hasMediumOuterwear = nextItems.some((candidate) => candidate.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(normalizeWeight(candidate.weight)));

  if (hasSmartInner && hasShorts && hasMediumOuterwear) return -5.5;
  return 0;
}

function getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences) {
  return {
    weightContrast: getWeightContrastScore(item, pickedItems),
    styleConflict: getCrossStyleConflictScore(item, pickedItems, selectedStyles),
    hotOuterwear: getHotOuterwearScore(item, slot, climatePreferences),
    lonelyExtremes: getLonelyExtremesScore(item, slot, outfit, itemsById),
    coldLightTopPenalty: getColdLightTopPenalty(item, slot, outfit, itemsById, climatePreferences),
    mismatchedSeasonality: getMismatchedSeasonalityScore(item, slot, outfit, itemsById)
  };
}

function getStyleCoherenceScore(item, slot, selectedStyles, preferredStyles, noFilterData) {
  const itemStyles = getItemStyleTags(item);
  const isAthleisureOnly = itemStyles.length === 1 && itemStyles[0] === "Athleisure";
  const isFormalOnly = isFormalOnlyItem(item);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const styleMode = resolveSelectedStyleMode(selectedStyles);

  if (!itemStyles.length) return 0;

  let score = 0;

  if (selectedStyles.length) {
    if (selectedStyles.some((style) => itemStyles.includes(style))) {
      score += styleMode === "casual" ? 4 : 6;
    } else {
      score -= isAthleisureOnly || isFormalOnly ? 5.5 : 3;
    }

    if ((styleMode === "formal" || styleMode === "formal-bridge") && hasType("t-shirt", "sport t-shirt", "ls t-shirt", "ls t-shirt (light)")) {
      score -= 4.8;
    }

    if (styleMode === "formal" && hasType("cap", "jeans")) {
      score -= hasType("cap") ? 2.6 : 2;
    }

    if (styleMode === "formal" && slot === "Footwear" && !itemStyles.includes("Formal")) {
      score -= hasType("leather sneakers") ? 5.4 : 6;
    }

    if (styleMode === "smart-casual" && hasType("sport t-shirt", "sport ls t-shirt", "sport shorts", "sport cap", "slides", "sandals", "fleece jacket", "shell jacket")) {
      score -= 4.5;
    }

    if (styleMode === "smart-casual" && hasType("hoodie", "sweatshirt")) {
      score -= 2.6;
    }

    if (styleMode === "athleisure") {
      if (hasType("wool shirt", "shirt", "blazer", "derby", "wool coat", "wool jacket")) {
        score -= 6;
      }
      if (itemStyles.every((style) => style === "Smart Casual" || style === "Formal")) {
        score -= 5.4;
      }
    }
  }

  if (preferredStyles.size) {
    const overlapCount = itemStyles.filter((style) => preferredStyles.has(style)).length;
    score += overlapCount * 2;
    if (!overlapCount && itemStyles.length) {
      score -= isAthleisureOnly && !preferredStyles.has("Athleisure") ? 3 : 1;
    }
  }

  if (styleMode === "no-filter") {
    score += getNoFilterPreference(item, noFilterData) * 0.4;
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
    score += Math.min(pairCount * 0.14, 0.35);
  });

  const itemCount = affinity[buildAffinityItemKey(slot, item.id)] ?? 0;
  score += Math.min(itemCount * 0.05, 0.2);

  return Math.min(score, MAX_AFFINITY_BOOST);
}

function buildNoFilterData(pool, outfit, itemsById, recentOutfits, generationContext = null) {
  const support = getPoolStyleSupport(pool);
  const anchoredStyle = getAnchoredStyle(outfit, itemsById);
  const baseWeights = generationContext?.weights ?? getAdjustedNoFilterWeights(getRecentDominantStyles(recentOutfits, itemsById), support, anchoredStyle);
  const targetStyle = anchoredStyle ?? generationContext?.targetStyle ?? pickWeightedStyle(baseWeights);
  return {
    support,
    anchoredStyle,
    weights: anchoredStyle ? getAdjustedNoFilterWeights(getRecentDominantStyles(recentOutfits, itemsById), support, anchoredStyle) : baseWeights,
    targetStyle,
    targetMode: styleToMode(targetStyle)
  };
}

export function getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool = [], generationContext = null) {
  const pickedItems = getPickedOutfitItems(outfit, itemsById);
  const selectedStyles = outfitFilters.style ?? [];
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const preferredStyles = getDominantStyleTags(pickedItems);
  const noFilterData = !selectedStyles.length ? buildNoFilterData(pool, outfit, itemsById, recentOutfits, generationContext) : null;
  const styleMode = getDominantStyleMode(selectedStyles, pickedItems, noFilterData);
  const breakdown = {
    climate: getClimateScore(item, slot, climatePreferences),
    styleCoherence: getStyleCoherenceScore(item, slot, selectedStyles, preferredStyles, noFilterData),
    styleCompletion: getStyleCompletionScore(item, slot, styleMode),
    dominance: getDominancePenaltyScore(item, pickedItems, styleMode),
    ...getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences),
    baseline: getBaselineOutfitScore(item, slot),
    earlyAnchor: getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles, noFilterData),
    selectedStyleBonus: 0,
    favorite: item.favorite ? 0.5 : 0,
    affinity: getAffinityScore(item, slot, outfit, outfitAffinity),
    recentItemPenalty: 0,
    recentExactPenalty: 0,
    recentLikedBoost: 0,
    coldOuterwear: 0,
    noFilterVariety: 0,
    styleStreakPenalty: 0
  };

  if (slot === "TopOuter") {
    if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
      breakdown.coldOuterwear += item.garmentType === "Outerwear" ? 3 : -4;
    }

    if (climatePreferences.includes("Hot")) {
      breakdown.hotOuterwear += item.garmentType === "Outerwear" ? -3 : 0;
    }
  }

  if ((slot === "TopInner" || slot === "Bottom" || slot === "Footwear" || slot === "TopOuter") && selectedStyles.length) {
    const styleModeBonus = styleMode === "formal" ? 2.8 : styleMode === "athleisure" ? 2.6 : styleMode === "smart-casual" ? 2.2 : 1.2;
    breakdown.selectedStyleBonus += getItemStyleTags(item).some((style) => selectedStyles.includes(style)) ? styleModeBonus : 0;
  }

  if (!selectedStyles.length) {
    breakdown.noFilterVariety += getNoFilterPreference(item, noFilterData) * 0.65;
  }

  const recentScores = getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById);
  breakdown.recentItemPenalty += recentScores.recentItemPenalty;
  breakdown.recentExactPenalty += recentScores.recentExactPenalty;
  breakdown.recentLikedBoost += recentScores.recentLikedBoost;
  breakdown.styleStreakPenalty += recentScores.styleStreakPenalty;

  const normalizedBreakdown = normalizeGuidedBreakdown(breakdown);
  const score = GUIDED_BASE_SCORE + Object.values(normalizedBreakdown).reduce((sum, value) => sum + value, 0);
  return {
    score: Math.max(GUIDED_SCORE_FLOOR, score),
    breakdown: normalizedBreakdown
  };
}

function scoreCandidateForGuidedGeneration(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool, generationContext) {
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool, generationContext).score;
}

function selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  if (!pool.length) return null;
  if (normalizeGenerationMode(generationMode) === "random") {
    const item = pickRandom(pool);
    return item ? { item, score: null, breakdown: null } : null;
  }

  let candidatePool = pool;
  const selectedStyles = outfitFilters.style ?? [];

  if (!selectedStyles.length) {
    const recentStyles = getRecentDominantStyles(recentOutfits, itemsById);
    const repeatedRecentStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
    const completesOutfit = visibleSlots.every((visibleSlot) => visibleSlot === slot || Boolean(outfit[visibleSlot]));

    if (repeatedRecentStyle && completesOutfit) {
      const streakSafePool = pool.filter((item) => getOutfitDominantStyle({ ...outfit, [slot]: item.id }, itemsById) !== repeatedRecentStyle);
      if (streakSafePool.length) {
        candidatePool = streakSafePool;
      }
    }
  }

  const weightedCandidates = candidatePool.map((item) => {
    const result = getGuidedScoreBreakdown(
      item,
      slot,
      outfit,
      itemsById,
      outfitFilters,
      weatherData,
      outfitAffinity,
      recentOutfits,
      layering,
      candidatePool,
      generationContext
    );

    return {
      item,
      weight: result.score,
      score: result.score,
      breakdown: result.breakdown
    };
  });
  const pickedItem = pickWeightedRandom(weightedCandidates);
  return pickedItem ? weightedCandidates.find((entry) => entry.item.id === pickedItem.id) ?? null : null;
}

export function pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  return selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext)?.item ?? null;
}

function summarizeGuidedReasonEntries(entries = []) {
  const aggregated = {};
  const seenKeys = new Set();

  entries.forEach((entry) => {
    Object.entries(entry.breakdown ?? {}).forEach(([key, value]) => {
      seenKeys.add(key);
      if (!value) return;
      const current = aggregated[key] ?? { total: 0, count: 0 };
      current.total += value;
      current.count += 1;
      aggregated[key] = current;
    });
  });

  const averagedEntries = Object.entries(aggregated)
    .map(([key, entry]) => [key, entry.total / entry.count])
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
  const thresholdedEntries = averagedEntries.filter(([, value]) => Math.abs(value) >= 0.2);
  const fallbackZeroEntries =
    !averagedEntries.length && seenKeys.size
      ? [...seenKeys].map((key) => [key, 0])
      : averagedEntries;
  const displayEntries = (thresholdedEntries.length ? thresholdedEntries : fallbackZeroEntries).slice(0, 6);

  return displayEntries.map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

export function isNonStackableTopType(item) {
  return (item.garmentType === "Top" || item.garmentType === "Outerwear") && nonStackableTopTypes.has(normalizeType(item.type));
}

export function getOtherTopSlot(slot) {
  if (slot === "TopInner") return "TopOuter";
  if (slot === "TopOuter") return "TopInner";
  return null;
}

export function filterPoolForLayeringRules(pool, slot, outfit, itemsById) {
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

export function filterPoolForCompatibilityRules(pool, slot, outfit, itemsById) {
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

function buildNextOutfitResult(
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
  recentOutfits = [],
  options = {}
) {
  const nextOutfit = { ...currentOutfit };
  const guidedDebugPayload = [];
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const generationContext = !(outfitFilters.style ?? []).length
    ? buildNoFilterGenerationContext(items, excluded, generationLists, recentOutfits, itemsById)
    : null;

  visibleSlots.forEach((slot) => {
    if (!locked[slot]) nextOutfit[slot] = null;
  });

  visibleSlots.forEach((slot) => {
    if (locked[slot]) {
      return;
    }

    if (!layering && slot === "TopOuter") {
      nextOutfit[slot] = null;
      return;
    }

    const pool = getEligibleSlotPool(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, nextOutfit, itemsById);
    const selection = selectNextItemForGeneration(pool, slot, nextOutfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext);
    nextOutfit[slot] = selection?.item?.id ?? null;

    if (options.includeGuidedDebug && normalizeGenerationMode(generationMode) === "guided" && selection?.item && selection?.breakdown) {
      guidedDebugPayload.push({
        slot,
        itemId: selection.item.id,
        breakdown: selection.breakdown,
        score: selection.score
      });
    }
  });

  return {
    outfit: nextOutfit,
    guidedDebugPayload
  };
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
  return buildNextOutfitResult(items, currentOutfit, locked, layering, excluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits).outfit;
}

export function buildNextOutfitWithDebug(
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
  return buildNextOutfitResult(
    items,
    currentOutfit,
    locked,
    layering,
    excluded,
    generationLists,
    outfitFilters,
    weatherData,
    generationMode,
    outfitAffinity,
    recentOutfits,
    {
      includeGuidedDebug: true
    }
  );
}

export function summarizeGuidedExplanation(outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  const contextOutfit = {};
  const breakdownEntries = [];

  visibleSlots.forEach((slot) => {
    const itemId = outfit?.[slot];
    const item = itemId ? itemsById[itemId] : null;
    if (!item) return;

    const pool = getEligibleSlotPool(
      Object.values(itemsById),
      slot,
      {},
      defaultGenerationLists,
      layering,
      outfitFilters,
      weatherData,
      contextOutfit,
      itemsById
    );
    const { breakdown } = getGuidedScoreBreakdown(item, slot, contextOutfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool);
    breakdownEntries.push({ slot, itemId, breakdown });

    contextOutfit[slot] = itemId;
  });

  return summarizeGuidedReasonEntries(breakdownEntries);
}

export function summarizeGuidedDebugPayload(guidedDebugPayload = []) {
  return summarizeGuidedReasonEntries(guidedDebugPayload);
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
